/**
 * Operational error with an HTTP status code and a stable machine code.
 * Only these errors may reach the client with their message intact.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly isOperational = true;

  constructor(statusCode: number, message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace?.(this, ApiError);
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, message, 'BAD_REQUEST', details);
  }
  static validation(message: string, details?: unknown) {
    return new ApiError(422, message, 'VALIDATION_ERROR', details);
  }
  static unauthorized(message = 'Authentication required.') {
    return new ApiError(401, message, 'UNAUTHORIZED');
  }
  static forbidden(message = 'You do not have permission to perform this action.') {
    return new ApiError(403, message, 'FORBIDDEN');
  }
  static notFound(message = 'Resource not found.') {
    return new ApiError(404, message, 'NOT_FOUND');
  }
  static conflict(message: string, details?: unknown) {
    return new ApiError(409, message, 'CONFLICT', details);
  }
  static gone(message: string) {
    return new ApiError(410, message, 'GONE');
  }
  static unprocessable(message: string, details?: unknown) {
    return new ApiError(422, message, 'UNPROCESSABLE_ENTITY', details);
  }
  static tooManyRequests(message = 'Too many requests. Please slow down.') {
    return new ApiError(429, message, 'TOO_MANY_REQUESTS');
  }
  static internal(message = 'An unexpected error occurred.') {
    return new ApiError(500, message, 'INTERNAL_ERROR');
  }
  static serviceUnavailable(message: string, details?: unknown) {
    return new ApiError(503, message, 'SERVICE_UNAVAILABLE', details);
  }
}
