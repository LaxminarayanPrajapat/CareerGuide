import type { Request, Response } from 'express';
import { z } from 'zod';
import { ROLES, type Role } from '../config/constants.js';
import { permissionMatrix, permissionsForRole } from '../config/permissions.js';
import { UserModel } from '../models/User.js';
import { AttemptModel } from '../models/Attempt.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { created, ok, paginationMeta } from '../utils/response.js';
import { escapeRegExp } from '../utils/pagination.js';
import { hashPassword } from '../utils/password.js';
import { recordAudit, auditFromRequest } from '../services/audit/auditService.js';
import { serialiseUser } from './auth.controller.js';
import type { CreateUserInput, UpdateUserInput } from '../services/auth/authService.types.js';

const userListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(ROLES).optional(),
  isActive: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((v) => v === true || v === 'true')
    .optional(),
  batch: z.string().trim().max(60).optional(),
  search: z.string().trim().max(120).optional(),
  assignedCounsellor: z.string().regex(/^[a-fA-F0-9]{24}$/).optional(),
});

/**
 * Restricts a list query to the caller's scope.
 * Counsellors only ever see students assigned to them; management sees
 * aggregate-level accounts only.
 */
function applyScope(filter: Record<string, unknown>, req: Request) {
  if (req.user!.role === 'counsellor') {
    filter.role = 'student';
    filter.assignedCounsellor = req.user!.id;
  }
  if (req.user!.role === 'management') {
    // Management is read-only and does not need other staff accounts.
    delete filter.role;
  }
}

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as import('zod').infer<typeof userListQuerySchema>;
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.batch) filter['studentProfile.batch'] = query.batch;
  if (query.assignedCounsellor) filter.assignedCounsellor = query.assignedCounsellor;
  if (query.search) {
    const rx = { $regex: escapeRegExp(query.search), $options: 'i' };
    filter.$or = [{ fullName: rx }, { email: rx }, { 'studentProfile.rollNumber': rx }];
  }
  applyScope(filter, req);

  const [items, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
    UserModel.countDocuments(filter),
  ]);

  return ok(
    res,
    {
      users: items.map((u) => serialiseUser(u as never)),
    },
    'Users.',
    paginationMeta(query.page, query.limit, total),
  );
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  if (req.user!.role === 'counsellor') {
    if (user.role !== 'student' || String(user.assignedCounsellor) !== req.user!.id) {
      throw ApiError.forbidden('This candidate is not assigned to you.');
    }
  }
  if (req.user!.role === 'management' && user.role === 'student') {
    // Management receives aggregates, not individual candidate records.
    throw ApiError.forbidden('Individual candidate records are not available to the management role.');
  }

  const [attemptCount, reportCount] = await Promise.all([
    AttemptModel.countDocuments({ candidate: user._id }),
    import('../models/CareerReport.js').then((m) => m.CareerReportModel.countDocuments({ candidate: user._id })),
  ]);

  return ok(res, { user: serialiseUser(user), activity: { attemptCount, reportCount } }, 'User.');
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateUserInput;

  const existing = await UserModel.findOne({ email: body.email }).select('_id').lean();
  if (existing) throw ApiError.conflict('An account with this email address already exists.');

  if (body.assignedCounsellor) {
    const counsellor = await UserModel.findById(body.assignedCounsellor).select('role isActive');
    if (!counsellor || counsellor.role !== 'counsellor') {
      throw ApiError.validation('Invalid counsellor assignment.', [
        { field: 'assignedCounsellor', message: 'The referenced user is not a counsellor.' },
      ]);
    }
  }

  const user = await UserModel.create({
    fullName: body.fullName,
    email: body.email,
    passwordHash: await hashPassword(body.password),
    role: body.role,
    isActive: body.isActive,
    phone: body.phone,
    mustChangePassword: body.mustChangePassword,
    assignedCounsellor: body.assignedCounsellor as never,
    studentProfile: body.studentProfile ?? {},
    createdBy: req.user!.id,
  });

  await recordAudit(
    auditFromRequest(req, {
      action: 'user.create',
      category: 'admin',
      targetType: 'User',
      targetId: String(user._id),
      message: `Created ${body.role} account for ${user.email}.`,
      metadata: { userId: String(user._id), role: body.role },
    }),
  );

  return created(res, { user: serialiseUser(user) }, 'User created.');
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  const body = req.body as UpdateUserInput;
  const previousRole = user.role;

  if (body.role && body.role !== user.role) {
    if (!req.user!.permissions.includes('users:manage-role')) {
      throw ApiError.forbidden('You are not permitted to change roles.');
    }
    if (String(user._id) === req.user!.id) {
      throw ApiError.badRequest('You cannot change your own role.');
    }
    if (user.role === 'admin' && body.role !== 'admin') {
      const adminCount = await UserModel.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1) throw ApiError.conflict('At least one active administrator must remain.');
    }
    // Changing role invalidates existing sessions for that account.
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    user.role = body.role as Role;
  }

  if (body.fullName) user.fullName = body.fullName;
  if (body.phone !== undefined) user.phone = body.phone;
  if (body.notes !== undefined) user.notes = body.notes;
  if (body.assignedCounsellor !== undefined) user.assignedCounsellor = body.assignedCounsellor as never;
  if (body.studentProfile) {
    user.studentProfile = { ...(user.studentProfile ?? {}), ...body.studentProfile } as never;
  }

  await user.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'user.update',
      category: 'admin',
      targetType: 'User',
      targetId: String(user._id),
      message: `Updated user ${user.email}.`,
      metadata: {
        userId: String(user._id),
        role: user.role,
        previousRole,
        field: Object.keys(body).join(','),
      },
      severity: body.role ? 'warning' : 'info',
    }),
  );

  return ok(res, { user: serialiseUser(user) }, 'User updated.');
});

export const setUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const { isActive, reason } = req.body as { isActive: boolean; reason?: string };
  const user = await UserModel.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  if (String(user._id) === req.user!.id && !isActive) {
    throw ApiError.badRequest('You cannot deactivate your own account.');
  }
  if (!isActive && user.role === 'admin') {
    const adminCount = await UserModel.countDocuments({ role: 'admin', isActive: true });
    if (adminCount <= 1) throw ApiError.conflict('At least one active administrator must remain.');
  }
  if (!isActive) {
    const liveAttempts = await AttemptModel.countDocuments({ candidate: user._id, status: 'in_progress' });
    if (liveAttempts > 0) {
      throw ApiError.conflict(
        `This candidate has ${liveAttempts} assessment attempt(s) in progress. Let them finish or expire before deactivating the account.`,
      );
    }
  }

  user.isActive = isActive;
  if (!isActive) user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  if (reason) user.notes = reason;
  await user.save();

  await recordAudit(
    auditFromRequest(req, {
      action: isActive ? 'user.activate' : 'user.deactivate',
      category: 'admin',
      targetType: 'User',
      targetId: String(user._id),
      message: `${isActive ? 'Activated' : 'Deactivated'} account ${user.email}.${reason ? ` Reason: ${reason}` : ''}`,
      severity: isActive ? 'info' : 'warning',
      metadata: { userId: String(user._id), reason },
    }),
  );

  return ok(res, { user: serialiseUser(user) }, isActive ? 'Account activated.' : 'Account deactivated.');
});

export const adminResetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { newPassword, mustChangePassword } = req.body as { newPassword: string; mustChangePassword: boolean };
  const user = await UserModel.findById(req.params.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('User not found.');

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = mustChangePassword;
  user.passwordChangedAt = new Date();
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  await user.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'user.reset_password',
      category: 'security',
      targetType: 'User',
      targetId: String(user._id),
      message: `Administrator reset the password for ${user.email}. All sessions invalidated.`,
      severity: 'warning',
      metadata: { userId: String(user._id) },
    }),
  );

  return ok(res, { reset: true }, 'Password reset. The user must sign in again.');
});

export const assignCounsellor = asyncHandler(async (req: Request, res: Response) => {
  const { counsellorId } = req.body as { counsellorId: string | null };
  const user = await UserModel.findById(req.params.id);
  if (!user) throw ApiError.notFound('Candidate not found.');

  if (counsellorId) {
    const counsellor = await UserModel.findById(counsellorId).select('role isActive');
    if (!counsellor || counsellor.role !== 'counsellor' || !counsellor.isActive) {
      throw ApiError.validation('Invalid counsellor.', [
        { field: 'counsellorId', message: 'Select an active counsellor account.' },
      ]);
    }
  }

  const previous = user.assignedCounsellor ? String(user.assignedCounsellor) : null;
  user.assignedCounsellor = (counsellorId ?? undefined) as never;
  await user.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'user.assign_counsellor',
      category: 'admin',
      targetType: 'User',
      targetId: String(user._id),
      message: `Assigned counsellor for ${user.email}.`,
      metadata: { userId: String(user._id), previousRole: previous ?? 'none' },
    }),
  );

  return ok(res, { user: serialiseUser(user) }, 'Counsellor assignment updated.');
});

/** Permission matrix endpoint - the source of truth used by the admin UI. */
export const getPermissionMatrix = asyncHandler(async (_req: Request, res: Response) => {
  return ok(
    res,
    {
      matrix: permissionMatrix(),
      roles: ROLES,
      rolePermissions: Object.fromEntries(ROLES.map((r) => [r, permissionsForRole(r)])),
    },
    'Permission matrix.',
  );
});
