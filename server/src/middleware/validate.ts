import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ApiError } from '../utils/ApiError.js';

export interface ValidationTargets {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

function formatIssues(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

function apply(schema: ZodSchema, data: unknown, label: string): unknown {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw ApiError.validation(`Invalid request ${label}.`, formatIssues(result.error));
  }
  return result.data;
}

/**
 * Validates and *replaces* the request parts with the parsed values, so
 * controllers only ever see coerced, whitelisted data.
 */
export function validate(targets: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (targets.params) req.params = apply(targets.params, req.params, 'parameters') as typeof req.params;
      if (targets.query) {
        const parsed = apply(targets.query, req.query, 'query parameters');
        Object.defineProperty(req, 'validatedQuery', { value: parsed, writable: true, configurable: true });
        req.query = parsed as typeof req.query;
      }
      if (targets.body) req.body = apply(targets.body, req.body, 'body');
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
    }
  }
}
