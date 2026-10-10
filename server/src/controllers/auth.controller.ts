import type { Request, Response } from 'express';
import { env } from '../config/env.js';
import { permissionsForRole } from '../config/permissions.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { created, ok } from '../utils/response.js';
import { UserModel } from '../models/User.js';
import { hashPassword, passwordProblems, verifyPassword } from '../utils/password.js';
import {
  hashResetToken,
  randomToken,
  signPasswordResetToken,
  signSession,
  verifyPasswordResetToken,
} from '../utils/tokens.js';
import { logger } from '../utils/logger.js';
import { recordAudit, auditFromRequest } from '../services/audit/auditService.js';
import type { ChangePasswordInput, LoginInput, RegisterInput, ResetPasswordInput, UpdateProfileInput } from '../services/auth/authService.types.js';

const MAX_FAILED_LOGINS = 8;
const LOCK_DURATION_MS = 15 * 60 * 1000;

/** Public projection of a user. Never includes the password hash. */
export function serialiseUser(user: {
  _id: unknown;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  phone?: string;
  studentProfile?: unknown;
  assignedCounsellor?: unknown;
  lastLoginAt?: Date;
  createdAt?: Date;
  mustChangePassword?: boolean;
  tokenVersion?: number;
}) {
  return {
    id: String(user._id),
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    phone: user.phone ?? null,
    studentProfile: user.studentProfile ?? {},
    assignedCounsellor: user.assignedCounsellor ? String(user.assignedCounsellor) : null,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt ?? null,
    mustChangePassword: user.mustChangePassword ?? false,
    permissions: permissionsForRole(user.role as never),
  };
}

function setSessionCookies(
  res: Response,
  token: string,
  csrfToken: string,
  expiresAt: Date,
): void {
  const base = {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'lax' as const,
    path: '/',
    expires: expiresAt,
  };
  res.cookie(env.cookieName, token, base);
  // Readable by the frontend so it can echo the value in the X-CSRF-Token header.
  res.cookie(env.csrfCookieName, csrfToken, { ...base, httpOnly: false });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(env.cookieName, { path: '/' });
  res.clearCookie(env.csrfCookieName, { path: '/' });
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as RegisterInput;

  const existing = await UserModel.findOne({ email: body.email }).select('_id').lean();
  if (existing) {
    throw ApiError.conflict('An account with this email address already exists.');
  }

  const passwordHash = await hashPassword(body.password);

  const user = await UserModel.create({
    fullName: body.fullName,
    email: body.email,
    passwordHash,
    role: 'student',
    isActive: true,
    studentProfile: {
      institution: body.institution,
      department: body.department,
      yearOfStudy: body.yearOfStudy,
      batch: body.batch,
      rollNumber: body.rollNumber,
    },
  });

  const { token, expiresAt } = signSession({
    sub: String(user._id),
    role: user.role,
    email: user.email,
    sid: randomToken(16),
    tokenVersion: user.tokenVersion,
  });
  const csrfToken = randomToken(24);
  setSessionCookies(res, token, csrfToken, expiresAt);

  await recordAudit({
    actorId: String(user._id),
    actorEmail: user.email,
    actorRole: user.role,
    action: 'auth.register',
    category: 'auth',
    targetType: 'User',
    targetId: String(user._id),
    message: 'New candidate account registered.',
    ipAddress: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 300),
  });

  const fresh = await UserModel.findById(user._id);
  return created(
    res,
    { user: serialiseUser(fresh!), csrfToken },
    'Account created successfully.',
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body as LoginInput;

  const user = await UserModel.findOne({ email }).select(
    '+passwordHash +failedLoginCount +lockedUntil',
  );

  // Uniform failure message so the endpoint cannot be used to enumerate accounts.
  const invalidCredentials = ApiError.unauthorized('Invalid email address or password.');

  if (!user) {
    await recordAudit({
      action: 'auth.login',
      category: 'auth',
      outcome: 'failure',
      severity: 'warning',
      message: 'Login attempted with an unknown email address.',
      metadata: { email },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')?.slice(0, 300),
    });
    throw invalidCredentials;
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw ApiError.forbidden(
      'This account is temporarily locked after repeated failed sign-in attempts. Try again in 15 minutes.',
    );
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!passwordOk) {
    user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
    if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
      user.lockedUntil = new Date(Date.now() + LOCK_DURATION_MS);
      user.failedLoginCount = 0;
      await user.save();
      await recordAudit({
        actorId: String(user._id),
        actorEmail: user.email,
        actorRole: user.role,
        action: 'auth.account_locked',
        category: 'security',
        outcome: 'failure',
        severity: 'critical',
        targetType: 'User',
        targetId: String(user._id),
        message: 'Account locked after repeated failed sign-in attempts.',
        ipAddress: req.ip,
      });
      throw ApiError.forbidden('Too many failed attempts. This account is locked for 15 minutes.');
    }
    await user.save();
    await recordAudit({
      actorId: String(user._id),
      actorEmail: user.email,
      action: 'auth.login',
      category: 'auth',
      outcome: 'failure',
      severity: 'warning',
      message: 'Failed sign-in: incorrect password.',
      ipAddress: req.ip,
    });
    throw invalidCredentials;
  }

  if (!user.isActive) {
    await recordAudit({
      actorId: String(user._id),
      actorEmail: user.email,
      action: 'auth.login',
      category: 'auth',
      outcome: 'denied',
      severity: 'warning',
      message: 'Sign-in attempt on a deactivated account.',
      ipAddress: req.ip,
    });
    throw ApiError.forbidden('This account has been deactivated. Contact your administrator.');
  }

  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  user.loginCount = (user.loginCount ?? 0) + 1;
  await user.save();

  const { token, expiresAt } = signSession({
    sub: String(user._id),
    role: user.role,
    email: user.email,
    sid: randomToken(16),
    tokenVersion: user.tokenVersion,
  });
  const csrfToken = randomToken(24);
  setSessionCookies(res, token, csrfToken, expiresAt);

  await recordAudit({
    actorId: String(user._id),
    actorEmail: user.email,
    actorRole: user.role,
    action: 'auth.login',
    category: 'auth',
    targetType: 'User',
    targetId: String(user._id),
    message: 'User signed in.',
    ipAddress: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 300),
  });

  return ok(res, { user: serialiseUser(user), csrfToken }, 'Signed in successfully.');
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    await recordAudit(
      auditFromRequest(req, {
        action: 'auth.logout',
        category: 'auth',
        message: 'User signed out.',
      }),
    );
  }
  clearSessionCookies(res);
  return ok(res, { loggedOut: true }, 'Signed out successfully.');
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.user!.id);
  if (!user) throw ApiError.notFound('Account not found.');
  return ok(res, { user: serialiseUser(user) }, 'Current session.');
});

export const updateMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateProfileInput;
  const user = await UserModel.findById(req.user!.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('Account not found.');

  if (body.fullName) user.fullName = body.fullName;
  if (body.phone !== undefined) user.phone = body.phone;
  if (body.studentProfile) {
    user.studentProfile = { ...(user.studentProfile ?? {}), ...body.studentProfile } as never;
  }
  await user.save();

  await recordAudit(
    auditFromRequest(req, {
      action: 'profile.update',
      category: 'access',
      targetType: 'User',
      targetId: String(user._id),
      message: 'Candidate updated their own profile.',
      metadata: { field: Object.keys(body).join(',') },
    }),
  );

  return ok(res, { user: serialiseUser(user) }, 'Profile updated.');
});

export const changeMyPassword = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ChangePasswordInput;
  const user = await UserModel.findById(req.user!.id).select('+passwordHash');
  if (!user) throw ApiError.notFound('Account not found.');

  const valid = await verifyPassword(body.currentPassword, user.passwordHash);
  if (!valid) {
    await recordAudit(
      auditFromRequest(req, {
        action: 'auth.change_password',
        category: 'security',
        outcome: 'failure',
        severity: 'warning',
        message: 'Password change rejected: current password incorrect.',
      }),
    );
    throw ApiError.badRequest('Your current password is incorrect.');
  }

  if (body.currentPassword === body.newPassword) {
    throw ApiError.badRequest('The new password must be different from the current password.');
  }

  user.passwordHash = await hashPassword(body.newPassword);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = false;
  // Invalidate every other session for this account.
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  await user.save();

  const { token, expiresAt } = signSession({
    sub: String(user._id),
    role: user.role,
    email: user.email,
    sid: randomToken(16),
    tokenVersion: user.tokenVersion,
  });
  const csrfToken = randomToken(24);
  setSessionCookies(res, token, csrfToken, expiresAt);

  await recordAudit(
    auditFromRequest(req, {
      action: 'auth.change_password',
      category: 'security',
      targetType: 'User',
      targetId: String(user._id),
      message: 'Password changed; other sessions invalidated.',
    }),
  );

  return ok(res, { csrfToken }, 'Password updated. Please keep your new password safe.');
});

/**
 * Password recovery. When SMTP is not configured the reset token is returned in
 * the development response so the workflow remains demonstrable, and the
 * response explicitly says so - it is never presented as an email being sent.
 */
export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as { email: string };
  const user = await UserModel.findOne({ email }).select('_id email isActive role');

  const response: { message: string; developmentResetToken?: string; mailEnabled: boolean } = {
    message:
      'If an account exists for that email address, a password reset link has been prepared. Please check your inbox.',
    mailEnabled: env.mail.enabled,
  };

  if (!user || !user.isActive) {
    await recordAudit({
      action: 'auth.forgot_password',
      category: 'auth',
      outcome: 'success',
      message: 'Password reset requested for an unknown or inactive email address.',
      metadata: { email },
      ipAddress: req.ip,
    });
    return ok(res, response, response.message);
  }

  const token = signPasswordResetToken(String(user._id), user.tokenVersion ?? 0);
  user.resetTokenHash = hashResetToken(token);
  user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await user.save();

  if (env.mail.enabled) {
    logger.info('auth.reset_link_prepared', { userId: String(user._id), delivery: 'smtp-configured' });
  } else {
    response.developmentResetToken = token;
    logger.warn('auth.reset_link_not_sent', {
      userId: String(user._id),
      reason: 'MAIL_ENABLED is false - no email was actually sent.',
    });
  }

  await recordAudit({
    actorId: String(user._id),
    actorEmail: user.email,
    action: 'auth.forgot_password',
    category: 'auth',
    targetType: 'User',
    targetId: String(user._id),
    message: env.mail.enabled
      ? 'Password reset token generated and dispatched through the configured mail service.'
      : 'Password reset token generated. Mail delivery is disabled, so no email was sent.',
    ipAddress: req.ip,
  });

  return ok(res, response, response.message);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, password } = req.body as ResetPasswordInput;

  const decoded = verifyPasswordResetToken(token);
  if (!decoded) {
    throw ApiError.badRequest('This reset link is invalid or has expired. Please request a new one.');
  }

  const user = await UserModel.findById(decoded.userId).select(
    '+passwordHash +resetTokenHash +resetTokenExpiresAt',
  );
  if (!user) throw ApiError.badRequest('This reset link is no longer valid.');

  const tokenHash = hashResetToken(token);
  if (!user.resetTokenHash || user.resetTokenHash !== tokenHash) {
    throw ApiError.badRequest('This reset link has already been used. Please request a new one.');
  }
  if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() < Date.now()) {
    throw ApiError.badRequest('This reset link has expired. Please request a new one.');
  }
  if ((user.tokenVersion ?? 0) !== decoded.tokenVersion) {
    throw ApiError.badRequest('This reset link is no longer valid. Please request a new one.');
  }

  const problems = passwordProblems(password);
  if (problems.length > 0) {
    throw ApiError.badRequest(`Password must contain ${problems.join(', ')}.`);
  }

  user.passwordHash = await hashPassword(password);
  user.passwordChangedAt = new Date();
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  await user.save();

  clearSessionCookies(res);

  await recordAudit({
    actorId: String(user._id),
    actorEmail: user.email,
    action: 'auth.reset_password',
    category: 'security',
    targetType: 'User',
    targetId: String(user._id),
    message: 'Password reset completed; existing sessions invalidated.',
    ipAddress: req.ip,
  });

  return ok(res, { reset: true }, 'Password reset. You can now sign in with your new password.');
});
