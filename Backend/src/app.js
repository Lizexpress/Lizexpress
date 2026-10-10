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

import env from './config/env.js';
import routes from './routes/index.js';
import { webhook, webhookHealth } from './controllers/payment.controller.js';
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
app.get('/api/v1/payments/webhook', webhookHealth);

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
  /**
   * Swagger UI is served as one self-contained page that pulls the viewer from
   * a CDN, rather than through swagger-ui-express.
   *
   * swagger-ui-express serves its assets with express.static over
   * node_modules/swagger-ui-dist. A serverless bundler cannot see those files —
   * they are read from disk by path at runtime, not imported — so they are
   * absent from the deployment. The static handler then falls through and
   * swaggerUi.setup answers EVERY /docs/* path with the HTML shell, so the
   * browser receives text/html for swagger-ui.css and refuses it under strict
   * MIME checking. The page renders blank with console errors.
   *
   * Serving one page and letting the CDN supply the viewer removes the whole
   * class of problem, and the spec itself is still served from this deployment.
   */
  const DOCS_VERSION = '5.17.14';

  const docsPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>LizExpress API v2</title>
    <link rel="icon" href="${env.appUrl}/favicon.ico" />
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@${DOCS_VERSION}/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
      .swagger-ui .topbar { background: #4A0E67; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title small.version-stamp { background: #F7941D; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@${DOCS_VERSION}/swagger-ui-bundle.js" crossorigin></script>
    <script src="https://unpkg.com/swagger-ui-dist@${DOCS_VERSION}/swagger-ui-standalone-preset.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          docExpansion: 'none',
          filter: true,
          persistAuthorization: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout',
        });
      };
    </script>
  </body>
</html>`;

  // Both /docs and /docs/ resolve; no sub-paths exist, so nothing can be
  // mistakenly answered with HTML.
  app.get(['/docs', '/docs/'], (_req, res) => {
    res.type('html').send(docsPage);
  });

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
