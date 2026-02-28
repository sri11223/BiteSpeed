/**
 * Server entry point.
 * 
 * Bootstraps the application:
 * 1. Validates configuration
 * 2. Connects to database
 * 3. Starts HTTP server
 * 4. Registers graceful shutdown handlers
 */

import { createApp } from './app';
import { config } from './config';
import { connectDatabase, prisma } from './config/database';
import { logger } from './utils/logger';

async function bootstrap(): Promise<void> {
  try {
    // Verify database connectivity
    await connectDatabase();

    // Create Express app with all dependencies wired
    const app = createApp();

    // Start listening
    const server = app.listen(config.port, () => {
      logger.info(`🚀 Server running on port ${config.port} in ${config.env} mode`);
      logger.info(`   Health check: http://localhost:${config.port}/health`);
      logger.info(`   Identify:     POST http://localhost:${config.port}/identify`);
    });

    // ─── Graceful shutdown ────────────────────────────────────────────────
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received. Starting graceful shutdown…`);

      server.close(async () => {
        logger.info('HTTP server closed');
        await prisma.$disconnect();
        logger.info('Database disconnected');
        process.exit(0);
      });

      // Force exit after 10 seconds if graceful shutdown fails
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10_000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle unhandled rejections / uncaught exceptions
    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled Rejection', { reason });
    });

    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

bootstrap();
