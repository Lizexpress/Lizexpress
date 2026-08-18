import logger from '../lib/logger.js';
import { NotFound } from '../lib/errors.js';
import env from '../config/env.js';

export const notFoundHandler = (req, _res, next) => {
  next(NotFound(`No route matches ${req.method} ${req.originalUrl}`));
};

/**
 * The only place in the codebase that writes an error response.
 * Unexpected errors are logged with full context but return a generic message —
 * stack traces and database internals never reach a client.
 */
export const errorHandler = (error, req, res, _next) => {
  const status = error.status ?? 500;
  const code = error.code ?? 'internal_error';
  const isServerError = status >= 500;

  const log = isServerError ? logger.error : logger.warn;
  log('request.failed', {
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    userId: req.auth?.id ?? null,
    message: error.message,
    stack: isServerError ? error.stack : undefined,
  });

  res.status(status).json({
    success: false,
    error: {
      code,
      message: isServerError
        ? 'Something went wrong on our end. Please try again.'
        : error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(isServerError && !env.isProduction ? { debug: error.message } : {}),
    },
  });
};
