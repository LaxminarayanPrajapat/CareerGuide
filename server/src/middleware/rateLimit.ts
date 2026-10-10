import type { Request } from 'express';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { env } from '../config/env.js';

function build(options: { windowMs: number; max: number; message: string; keyPrefix: string }): RateLimitRequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Rate limit per account when signed in, per IP otherwise.
      const userId = (req as Request & { user?: { id: string } }).user?.id;
      return userId ? `u:${userId}` : `ip:${req.ip ?? 'unknown'}`;
    },
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        message: options.message,
        data: null,
        meta: { code: 'TOO_MANY_REQUESTS' },
      });
    },
    // Rate limiting must not interfere with the automated test suite.
    skip: () => env.isTest,
  });
}

export const apiLimiter = build({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  message: 'Too many requests. Please wait a moment and try again.',
  keyPrefix: 'api',
});

/** Strict limit on credential endpoints to slow down brute-force attempts. */
export const authLimiter = build({
  windowMs: 15 * 60 * 1000,
  max: env.authRateLimitMax,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
  keyPrefix: 'auth',
});

/** Expensive operations: report generation with an external AI provider. */
export const aiLimiter = build({
  windowMs: 60 * 1000,
  max: 6,
  message: 'You are generating reports too quickly. Please wait a minute before requesting another.',
  keyPrefix: 'ai',
});
