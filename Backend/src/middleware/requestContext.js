import crypto from 'node:crypto';
import logger from '../lib/logger.js';

/** Attaches a request id and emits one access log line per request. */
export const requestContext = (req, res, next) => {
  req.id = req.headers['x-request-id'] ?? crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const startedAt = Date.now();

  res.on('finish', () => {
    logger.info('request', {
      id: req.id,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.auth?.id ?? null,
    });
  });

  next();
};
