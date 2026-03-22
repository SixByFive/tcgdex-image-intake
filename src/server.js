'use strict';

const { validateConfig, config } = require('./config/env');
const { ensureTempDirs } = require('./utils/tempDirs');
const logger = require('./utils/logger');

// Validate required environment variables before doing anything else
try {
  validateConfig();
} catch (err) {
  console.error(`[startup] Configuration error: ${err.message}`);
  process.exit(1);
}

// Ensure temp directories exist on disk
try {
  ensureTempDirs();
} catch (err) {
  console.error(`[startup] Failed to create temp directories: ${err.message}`);
  process.exit(1);
}

const app = require('./app');

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    'tcgdex-image-intake started'
  );
});

// Graceful shutdown
function shutdown(signal) {
  logger.info({ signal }, 'Shutdown signal received');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force exit if server hasn't closed within 10 seconds
  setTimeout(() => {
    logger.warn('Forcing exit after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled rejection');
  process.exit(1);
});
