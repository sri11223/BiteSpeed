/**
 * Application configuration — single source of truth for all env-driven settings.
 * 
 * Validates environment variables at startup to fail fast on misconfiguration.
 */

import dotenv from 'dotenv';

dotenv.config();

interface AppConfig {
  env: string;
  port: number;
  database: {
    url: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
  };
}

function getEnvVar(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined) return fallback;
  const parsed = parseInt(raw, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a valid integer, got: ${raw}`);
  }
  return parsed;
}

export const config: AppConfig = {
  env: getEnvVar('NODE_ENV', 'development'),
  port: getEnvInt('PORT', 3000),
  database: {
    url: getEnvVar('DATABASE_URL'),
  },
  rateLimit: {
    windowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 60000),
    maxRequests: getEnvInt('RATE_LIMIT_MAX_REQUESTS', 100),
  },
  logging: {
    level: getEnvVar('LOG_LEVEL', 'info'),
  },
};
