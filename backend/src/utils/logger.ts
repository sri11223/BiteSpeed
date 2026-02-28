/**
 * Structured logging with Winston.
 * 
 * JSON format in production for log aggregation tools (ELK, Datadog, etc.).
 * Pretty-printed colourful output in development.
 */

import winston from 'winston';
import { config } from '../config';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${stack || message}${metaStr}`;
  }),
);

const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);

export const logger = winston.createLogger({
  level: config.logging.level,
  format: config.env === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'bitespeed-identity' },
  transports: [
    new winston.transports.Console(),
  ],
});
