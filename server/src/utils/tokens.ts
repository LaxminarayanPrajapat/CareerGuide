import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface SessionClaims {
  sub: string;
  role: string;
  email: string;
  /** Session id used for CSRF double-submit binding. */
  sid: string;
  tokenVersion: number;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function signSession(claims: SessionClaims): { token: string; expiresAt: Date; expiresInSeconds: number } {
  const options: SignOptions = {
    expiresIn: env.jwtExpiresIn as SignOptions['expiresIn'],
  };
  const token = jwt.sign(
    { role: claims.role, email: claims.email, sid: claims.sid, tokenVersion: claims.tokenVersion },
    env.jwtSecret,
    { ...options, subject: claims.sub },
  );
  const decoded = jwt.decode(token) as { exp: number } | null;
  const expiresAt = new Date((decoded?.exp ?? Math.floor(Date.now() / 1000) + 3600) * 1000);
  return {
    token,
    expiresAt,
    expiresInSeconds: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export function verifySession(token: string): SessionClaims | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    if (!decoded.sub || typeof decoded.role !== 'string' || typeof decoded.sid !== 'string') return null;
    return {
      sub: decoded.sub,
      role: decoded.role,
      email: typeof decoded.email === 'string' ? decoded.email : '',
      sid: decoded.sid,
      tokenVersion: typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0,
    };
  } catch {
    return null;
  }
}

/** Short-lived token for password reset emails. */
export function signPasswordResetToken(userId: string, tokenVersion: number): string {
  return jwt.sign({ tokenVersion, purpose: 'password-reset' }, env.jwtSecret, {
    subject: userId,
    expiresIn: '30m',
  });
}

export function verifyPasswordResetToken(
  token: string,
): { userId: string; tokenVersion: number } | null {
  try {
    const decoded = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    if (decoded.purpose !== 'password-reset' || !decoded.sub) return null;
    return {
      userId: decoded.sub,
      tokenVersion: typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0,
    };
  } catch {
    return null;
  }
}

/** One-way hash used to store password-reset tokens in the database. */
export function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
