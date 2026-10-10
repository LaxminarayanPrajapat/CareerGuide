import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

const SENSITIVE_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password'];

/**
 * Minimal request logger. Records method, path, status and duration only -
 * never request bodies, cookies or headers, which may carry credentials.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    logger[level]('http.request', {
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      userId: req.user?.id,
      role: req.user?.role,
      authRoute: SENSITIVE_PATHS.some((p) => req.originalUrl.includes(p)),
    });
  });
  next();
}
