import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/** Methods that do not change state and therefore do not need a CSRF token. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookie(req: Request, name: string): string | undefined {
  return (req.cookies as Record<string, string> | undefined)?.[name];
}

/**
 * Double-submit-cookie CSRF protection for cookie-authenticated requests.
 *
 * The session cookie is `httpOnly`, so the frontend cannot read it. A readable
 * `cgs_csrf` cookie is issued at sign-in; the client must echo it back in the
 * `X-CSRF-Token` header. A cross-site attacker can force the cookie to be sent
 * but cannot read it, so it cannot produce a matching header.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!req.cookies || !(req.cookies as Record<string, unknown>)[env.cookieName]) return next();

  const cookieToken = readCookie(req, env.csrfCookieName);
  const headerToken = req.get('x-csrf-token');

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    logger.warn('security.csrf_rejected', { path: req.originalUrl, method: req.method });
    return next(
      new ApiError(403, 'CSRF validation failed. Reload the page and try again.', 'CSRF_TOKEN_INVALID'),
    );
  }
  return next();
}
