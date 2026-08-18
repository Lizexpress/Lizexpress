/**
 * Structured JSON logger. Serverless log drains parse JSON far better than pretty text.
 * Deliberately dependency-free — one less cold-start import.
 */
import env from '../config/env.js';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[env.logLevel] ?? LEVELS.info;

const REDACT = /(password|token|secret|authorization|api[-_]?key|otp|code)/i;

const redact = (value) => {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redact);
  return Object.fromEntries(
    Object.entries(value).map(([key, val]) => [key, REDACT.test(key) ? '[redacted]' : redact(val)]),
  );
};

const emit = (level, message, meta = {}) => {
  if (LEVELS[level] > threshold) return;
  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...redact(meta),
  };
  const stream = level === 'error' ? console.error : console.log;
  stream(JSON.stringify(line));
};

export const logger = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
};

export default logger;
