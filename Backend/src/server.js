/** Local development entry point. Production runs through api/index.js on Vercel. */
import app from './app.js';
import env from './config/env.js';
import logger from './lib/logger.js';

const server = app.listen(env.port, () => {
  logger.info('server.started', {
    port: env.port,
    environment: env.nodeEnv,
    docs: `http://localhost:${env.port}/docs`,
  });
});

const shutdown = (signal) => {
  logger.info('server.shutdown', { signal });
  server.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
