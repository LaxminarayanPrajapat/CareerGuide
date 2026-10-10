import { createApp, configureMongoose } from './app.js';
import { env, assertValidConfig } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { bootstrapAdmin } from './services/auth/bootstrapService.js';
import { logger } from './utils/logger.js';
import { runAttemptSweep } from './jobs/attemptSweep.js';

async function main(): Promise<void> {
  if (env.startupErrors.length > 0) {
    assertValidConfig();
  }

  configureMongoose();
  const app = createApp();

  await connectDatabase();
  await bootstrapAdmin();

  const server = app.listen(env.port, () => {
    logger.info('server.started', { port: env.port, env: env.nodeEnv });
    // eslint-disable-next-line no-console
    console.log(`\n  AI Career Guide API running on http://localhost:${env.port}`);
    // eslint-disable-next-line no-console
    console.log(`  Health check:  http://localhost:${env.port}/health`);
    // eslint-disable-next-line no-console
    console.log(`  API base:      http://localhost:${env.port}/api/v1\n`);
  });

  const sweepTimer = setInterval(() => {
    void runAttemptSweep();
  }, env.attemptSweepIntervalMs);
  sweepTimer.unref();
  // Finalise anything that expired while the process was down.
  void runAttemptSweep();

  async function shutdown(signal: string): Promise<void> {
    logger.info('server.shutdown_started', { signal });
    clearInterval(sweepTimer);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('server.shutdown_complete', { signal });
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', { reason: String(reason) });
  });
  process.on('uncaughtException', (error) => {
    logger.error('process.uncaught_exception', { message: error.message });
    void shutdown('uncaughtException');
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error instanceof Error ? error.message : error);
  process.exit(1);
});
