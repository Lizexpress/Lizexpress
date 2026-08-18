/**
 * A single error shape for the whole API.
 * Services throw AppError; the error middleware is the only place that formats a response.
 */
export class AppError extends Error {
  constructor(message, { status = 500, code = 'internal_error', details = null, cause } = {}) {
    super(message, { cause });
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }
}

const make = (status, code) => (message, details) => new AppError(message, { status, code, details });

export const BadRequest = make(400, 'bad_request');
export const Unauthorized = make(401, 'unauthorized');
export const Forbidden = make(403, 'forbidden');
export const NotFound = make(404, 'not_found');
export const Conflict = make(409, 'conflict');
export const UnprocessableEntity = make(422, 'validation_error');
export const TooManyRequests = make(429, 'rate_limited');
export const ServiceUnavailable = make(503, 'service_unavailable');

/** Wraps async route handlers so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
