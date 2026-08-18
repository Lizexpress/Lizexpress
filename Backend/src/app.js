/**
 * Express application.
 * Kept free of any server/listener concern so the exact same app object runs
 * under `node src/server.js` locally and inside a Vercel Function in production.
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import swaggerUi from 'swagger-ui-express';

import env from './config/env.js';
import routes from './routes/index.js';
import { webhook } from './controllers/payment.controller.js';
import { requestContext } from './middleware/requestContext.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './lib/logger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Vercel terminates TLS and proxies upstream; trust one hop so req.ip and
// the forwarded-for chain resolve correctly (see lib/clientIp.js).
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false, // the API returns JSON; Swagger UI needs inline styles
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(requestContext);

/**
 * CORS. Explicit allowlist — a wildcard would let any site drive the API using
 * a logged-in user's browser session.
 */
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true); // mobile apps and server-to-server send no Origin
      if (env.corsOrigins.length === 0 || env.corsOrigins.includes(origin)) return callback(null, true);
      logger.warn('cors.blocked', { origin });
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining'],
  }),
);

/**
 * The webhook is mounted BEFORE the JSON parser, because its signature is
 * verified against the raw bytes. Parsing first would invalidate the check.
 */
app.post('/api/v1/payments/webhook', express.raw({ type: '*/*' }), webhook);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/api', globalLimiter);

/**
 * Interactive docs.
 * The spec is authored as YAML under /docs and loaded at runtime — no OpenAPI
 * annotations are embedded in application code, so the contract can be reviewed
 * and versioned on its own.
 */
const loadSpec = () => {
  const candidates = [
    path.resolve(here, '../docs/openapi.bundled.yaml'),
    path.resolve(here, '../docs/openapi.yaml'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      return yaml.load(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      logger.error('docs.parse_failed', { file, error: error.message });
    }
  }
  return null;
};

const spec = loadSpec();
if (spec) {
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customSiteTitle: 'LizExpress API v2',
      customCss: '.swagger-ui .topbar{background:#4A0E67}.swagger-ui .topbar .download-url-wrapper{display:none}',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'none', filter: true },
    }),
  );
  app.get('/openapi.json', (_req, res) => res.json(spec));
} else {
  logger.warn('docs.unavailable', { reason: 'openapi.yaml not found' });
}

app.get('/', (_req, res) =>
  res.json({
    name: 'LizExpress API',
    version: '2.0.0',
    documentation: `${env.apiBaseUrl}/docs`,
    health: `${env.apiBaseUrl}/api/v1/health`,
  }),
);

app.use('/api/v1', routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
