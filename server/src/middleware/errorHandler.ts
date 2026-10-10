import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { isDatabaseReady } from '../config/database.js';

interface BodyParserError extends Error {
  status?: number;
  statusCode?: number;
  type?: string;
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'An unexpected error occurred.';
  let details: unknown;
  let logLevel: 'warn' | 'error' = 'error';

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
    logLevel = statusCode >= 500 ? 'error' : 'warn';
  } else if (isBodyParserError(err)) {
    statusCode = err.status === 400 || err.statusCode === 400 ? 400 : 500;
    code = err.type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST';
    message =
      err.type === 'entity.too.large'
        ? 'Request payload is too large.'
        : 'Malformed JSON request body.';
    logLevel = 'warn';
  } else if (err instanceof Error && err.name === 'ValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'The submitted data failed validation.';
    details = (err as Error & { errors?: Record<string, { message: string }> }).errors;
    logLevel = 'warn';
  } else if (err instanceof Error && err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_IDENTIFIER';
    message = 'One of the supplied identifiers is not valid.';
    logLevel = 'warn';
  } else if (isDuplicateKeyError(err)) {
    statusCode = 409;
    code = 'DUPLICATE_RESOURCE';
    message = duplicateKeyMessage(err);
    logLevel = 'warn';
  }

  const context = {
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    userId: req.user?.id,
    stack: err instanceof Error ? err.stack?.split('\n').slice(0, 4).join(' | ') : undefined,
  };
  logger[logLevel](`http.${statusCode}.${code}`, context);

  // Never leak stack traces or internal messages to the client in production.
  const safeMessage =
    statusCode >= 500 && env.isProduction
      ? 'An unexpected error occurred. The incident has been logged.'
      : message;

  res.status(statusCode).json({
    success: false,
    message: safeMessage,
    data: null,
    ...(details ? { errors: details } : {}),
    meta: {
      code,
      ...(statusCode >= 500 && env.isProduction ? {} : { detail: err instanceof Error ? err.message : String(err) }),
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
    },
  });
}

function isBodyParserError(err: unknown): err is BodyParserError {
  return (
    err instanceof Error &&
    ((err as BodyParserError).type === 'entity.parse.failed' ||
      (err as BodyParserError).type === 'entity.too.large')
  );
}

interface DuplicateKeyError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

function isDuplicateKeyError(err: unknown): err is DuplicateKeyError {
  return typeof err === 'object' && err !== null && (err as DuplicateKeyError).code === 11000;
}

function duplicateKeyMessage(err: DuplicateKeyError): string {
  const field = Object.keys(err.keyValue ?? {})[0] ?? 'value';
  if (field.toLowerCase() === 'email') return 'An account with this email address already exists.';
  return `A record with this ${field} already exists.`;
}

/** Guards against a database outage producing confusing 500s. */
export function databaseGuard(req: Request, _res: Response, next: NextFunction): void {
  if (!isDatabaseReady() && !req.path.startsWith('/health')) {
    return next(ApiError.serviceUnavailable('The database is currently unavailable. Please retry shortly.'));
  }
  return next();
}
