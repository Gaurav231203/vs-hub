import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { Scheduler } from './jobs/scheduler.js';
import { Worker } from './jobs/worker.js';
import { Sweeper } from './jobs/sweeper.js';
import { TokenRefreshService } from './jobs/tokenRefresh.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`🚀 VS Adda API server running on ${env.API_URL} (Port ${env.PORT}) [${env.NODE_ENV}]`);
});

// Background Loops
let isShuttingDown = false;

// 1. Scheduler Loop (Checks due posts every 15s)
const runSchedulerLoop = async () => {
  while (!isShuttingDown) {
    try {
      await Scheduler.tick();
    } catch (err: any) {
      logger.error({ err: err.message }, 'Scheduler tick error');
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
};

// 2. Worker Loop (Processes claimed background jobs)
const runWorkerLoop = async () => {
  while (!isShuttingDown) {
    try {
      const processedCount = await Worker.runBatch();
      if (processedCount === 0) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    } catch (err: any) {
      logger.error({ err: err.message }, 'Worker loop error');
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
};

// 3. Sweeper Loop (Rescues missed SCHEDULED posts every 5 minutes)
const runSweeperLoop = async () => {
  // Wait 10s initially before first sweeper run
  await new Promise((r) => setTimeout(r, 10000));
  while (!isShuttingDown) {
    try {
      await Sweeper.run();
    } catch (err: any) {
      logger.error({ err: err.message }, 'Sweeper loop error');
    }
    await new Promise((r) => setTimeout(r, 5 * 60 * 1000)); // Every 5 minutes
  }
};

// 4. Token Refresh Loop (Runs daily)
const runTokenRefreshLoop = async () => {
  // Wait 30s after startup
  await new Promise((r) => setTimeout(r, 30000));
  while (!isShuttingDown) {
    try {
      await TokenRefreshService.run();
    } catch (err: any) {
      logger.error({ err: err.message }, 'TokenRefresh loop error');
    }
    await new Promise((r) => setTimeout(r, 24 * 60 * 60 * 1000)); // Daily
  }
};

runSchedulerLoop();
runWorkerLoop();
runSweeperLoop();
runTokenRefreshLoop();

const shutdown = (signal: string) => {
  isShuttingDown = true;
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('uncaughtException', (err: Error) => {
  logger.fatal({ err: err.message, stack: err.stack }, 'FATAL: Uncaught exception in Node.js process');
});

process.on('unhandledRejection', (reason: any) => {
  logger.error({ reason: reason?.message || reason }, 'Unhandled promise rejection intercepted safely');
});
