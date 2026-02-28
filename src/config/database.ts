/**
 * Singleton Prisma client instance.
 * 
 * Ensures a single database connection pool is reused across the application,
 * preventing connection exhaustion under load.
 */

import { PrismaClient } from '@prisma/client';
import { config } from './index';
import { logger } from '../utils/logger';

const prismaClientSingleton = (): PrismaClient => {
  return new PrismaClient({
    log:
      config.env === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
  });
};

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Reuse the client in development to survive hot-reloads
export const prisma = global.prisma ?? prismaClientSingleton();

if (config.env !== 'production') {
  global.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma on process termination.
 */
export async function disconnectDatabase(): Promise<void> {
  logger.info('Disconnecting from database…');
  await prisma.$disconnect();
}

/**
 * Verify database connectivity at startup.
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connection established successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}
