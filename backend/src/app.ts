/**
 * Express application setup.
 *
 * Composition Root: wires up all dependencies (repository → service → controller → routes).
 * This is the only place where concrete implementations are instantiated.
 *
 * Security hardening with Helmet, CORS, rate limiting, and body parsing limits.
 * Interactive Swagger API documentation at /api-docs.
 */

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';

import { config } from './config';
import { prisma } from './config/database';
import { swaggerSpec } from './config/swagger';
import { ContactRepository } from './repositories/contact.repository';
import { ContactService } from './services/contact.service';
import { ContactController } from './controllers/contact.controller';
import { createContactRoutes } from './routes/contact.routes';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { logger } from './utils/logger';

export function createApp(): Application {
  const app = express();

  // ─── Security middleware ────────────────────────────────────────────────
  app.use(helmet({
    // Allow Swagger UI to load inline scripts/styles
    contentSecurityPolicy: false,
  }));
  app.use(cors());

  // ─── Rate limiting ─────────────────────────────────────────────────────
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    message: { status: 'error', message: 'Too many requests, please try again later' },
  });
  app.use(limiter);

  // ─── Body parsing ──────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ─── Request logging ───────────────────────────────────────────────────
  const morganFormat = config.env === 'production' ? 'combined' : 'dev';
  app.use(
    morgan(morganFormat, {
      stream: { write: (message: string) => logger.http(message.trim()) },
    }),
  );

  // ─── Swagger API Documentation ─────────────────────────────────────────
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Bitespeed API Docs',
  }));

  // Serve raw OpenAPI JSON spec
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  // ─── Health check endpoint ─────────────────────────────────────────────
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ─── Dependency injection (Composition Root) ───────────────────────────
  const contactRepository = new ContactRepository(prisma);
  const contactService = new ContactService(contactRepository);
  const contactController = new ContactController(contactService);
  const contactRoutes = createContactRoutes(contactController);

  // ─── Routes ────────────────────────────────────────────────────────────
  app.use('/', contactRoutes);

  // ─── Error handling ────────────────────────────────────────────────────
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
