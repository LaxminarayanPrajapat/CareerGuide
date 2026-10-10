import type { NextFunction, Request, Response } from 'express';
import { UserModel } from '../models/User.js';
import { verifySession, type SessionClaims } from '../utils/tokens.js';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { permissionsForRole } from '../config/permissions.js';
import type { Permission, Role } from '../config/constants.js';
import { logger } from '../utils/logger.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  permissions: Permission[];
  assignedCounsellor?: string;
  tokenVersion: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionClaims?: SessionClaims;
    }
  }
}

function readSessionToken(req: Request): string | null {
  const fromCookie = (req.cookies as Record<string, string> | undefined)?.[env.cookieName];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  return null;
}

/**
 * Validates the session and loads a minimal, always-current user projection.
 * Role changes and deactivations therefore take effect on the next request
 * instead of waiting for the token to expire.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = readSessionToken(req);
    if (!token) throw ApiError.unauthorized('Authentication required.');

    const claims = verifySession(token);
    if (!claims) throw ApiError.unauthorized('Session is invalid or has expired.');

    const user = await UserModel.findById(claims.sub).select(
      'fullName email role isActive tokenVersion assignedCounsellor studentProfile.batch',
    );
    if (!user) throw ApiError.unauthorized('Account no longer exists.');
    if (!user.isActive) throw ApiError.forbidden('This account has been deactivated.');
    if (user.tokenVersion !== claims.tokenVersion) {
      throw ApiError.unauthorized('Session is no longer valid. Please sign in again.');
    }

    const role = user.role as Role;
    req.user = {
      id: String(user._id),
      email: user.email,
      fullName: user.fullName,
      role,
      permissions: permissionsForRole(role),
      assignedCounsellor: user.assignedCounsellor ? String(user.assignedCounsellor) : undefined,
      tokenVersion: user.tokenVersion,
    };
    req.sessionClaims = claims;
    return next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    logger.error('auth.authenticate_failed', { message: (error as Error).message });
    return next(ApiError.unauthorized());
  }
}

/** Attaches the user when a valid session exists, but never rejects. */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readSessionToken(req);
  if (!token) return next();
  const claims = verifySession(token);
  if (!claims) return next();
  const user = await UserModel.findById(claims.sub)
    .select('fullName email role isActive tokenVersion assignedCounsellor')
    .lean();
  if (!user || !user.isActive || user.tokenVersion !== claims.tokenVersion) return next();
  const role = user.role as Role;
  req.user = {
    id: String(user._id),
    email: user.email,
    fullName: user.fullName,
    role,
    permissions: permissionsForRole(role),
    assignedCounsellor: user.assignedCounsellor ? String(user.assignedCounsellor) : undefined,
    tokenVersion: user.tokenVersion,
  };
  return next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires one of the roles: ${roles.join(', ')}.`));
    }
    return next();
  };
}

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    const missing = permissions.filter((p) => !req.user!.permissions.includes(p));
    if (missing.length > 0) {
      return next(ApiError.forbidden(`Missing required permission: ${missing.join(', ')}.`));
    }
    return next();
  };
}

/**
 * Ownership / scope guard for candidate-owned resources.
 * Counsellors and administrators may reach the resource when explicitly allowed.
 */
export function requireSelfOrPermission(permission: Permission, ownerField = 'candidate') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.permissions.includes(permission)) return next();

    const resourceOwner = (req.params as Record<string, string | undefined>)[ownerField];
    if (!resourceOwner) return next(ApiError.forbidden());
    if (String(req.user.id) === String(resourceOwner)) return next();
    return next(ApiError.forbidden('You may only access your own records.'));
  };
}
