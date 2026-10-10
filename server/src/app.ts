import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';

import { env } from './config/env.js';
import { isDatabaseReady } from './config/database.js';
import v1Routes from './routes/v1.routes.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { ApiError } from './utils/ApiError.js';

export function createApp(): Application {
  const app = express();

  // Required for correct client IPs and secure cookies behind a proxy.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: env.isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const allowedOrigins = new Set(env.clientOrigins);
  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin / server-to-server requests have no Origin header.
        if (!origin || allowedOrigins.has(origin)) return callback(null, true);
        return callback(new Error('Origin not allowed by CORS policy.'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Authorization'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'Service is healthy.',
      data: {
        status: 'ok',
        database: isDatabaseReady() ? 'connected' : 'disconnected',
        uptimeSeconds: Math.round(process.uptime()),
        environment: env.nodeEnv,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use('/api', apiLimiter);
  app.use('/api', csrfProtection);
  app.use('/api/v1', v1Routes);

  app.get('/api/v1', (_req, res) => {
    res.status(200).json({
      success: true,
      message: 'AI Career Path & Skill Recommendation System API',
      data: {
        version: '1.0.0',
        documentation: '/docs/API.md in the repository',
        authentication: 'HTTP-only session cookie obtained from POST /api/v1/auth/login',
        csrf: 'Send the cgs_csrf cookie value in the X-CSRF-Token header for state-changing requests.',
      },
    });
  });

  app.use(notFoundHandler);
  app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof Error && err.message === 'Origin not allowed by CORS policy.') {
      return next(ApiError.forbidden('This origin is not allowed to call the API.'));
    }
    return errorHandler(err, req, res, next);
  });

  return app;
}

/**
 * Mongoose hardening.
 *
 * `sanitizeFilter` is deliberately NOT enabled: it strips MongoDB operators from
 * *all* filters, including the trusted `$lte`/`$in` queries the attempt sweep and
 * aggregations rely on. Protection against query-operator injection comes from
 * the `validate` middleware instead - every value that reaches a filter has
 * already been parsed by a Zod schema, so no user-supplied object is ever used
 * as a filter.
 */
export function configureMongoose(): void {
  mongoose.set('strictQuery', true);
}
