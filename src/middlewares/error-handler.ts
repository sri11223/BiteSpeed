/**
 * Global error handling middleware.
 * 
 * Catches all errors thrown in route handlers and middleware,
 * formats them consistently, and prevents leaking internal details
 * to clients in production.
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../types';
import { logger } from '../utils/logger';
import { config } from '../config';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Determine if this is an operational (expected) error
  const isOperational = err instanceof AppError;
  const statusCode = isOperational ? (err as AppError).statusCode : 500;

  // Log the error
  if (isOperational) {
    logger.warn('Operational error', {
      message: err.message,
      statusCode,
    });
  } else {
    logger.error('Unexpected error', {
      message: err.message,
      stack: err.stack,
    });
  }

  // Build the response payload
  const responseBody: Record<string, unknown> = {
    status: 'error',
    message: isOperational ? err.message : 'Internal server error',
  };

  // Include stack trace in development for debugging
  if (config.env === 'development') {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
}

/**
 * Catch 404 routes that don't match any handler.
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}
