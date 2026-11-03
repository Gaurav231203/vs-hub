import path from 'path';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/error.js';
import { prisma } from './lib/prisma.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { approvalsRouter } from './modules/approvals/approvals.routes.js';
import { postsRouter } from './modules/posts/posts.routes.js';
import { channelsRouter } from './modules/channels/channels.routes.js';
import { calendarRouter } from './modules/calendar/calendar.routes.js';
import { inboxRouter } from './modules/inbox/inbox.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { listeningRouter } from './modules/listening/listening.routes.js';
import { libraryRouter } from './modules/library/library.routes.js';
import { teamRouter } from './modules/team/team.routes.js';
import { overviewRouter } from './modules/overview/overview.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { invitesRouter } from './modules/invites/invites.routes.js';
import { brandsRouter } from './modules/brands/brands.routes.js';
import { reviewRouter } from './modules/approvals/review.routes.js';

export function createApp(): Express {
  const app = express();

  // 1. Request ID
  app.use(requestId);

  // 2. Logging
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => req.headers['x-request-id'] as string,
        autoLogging: {
          ignore: (req) => req.url === '/health' || req.url === '/api/v1/health',
        },
      })
    );
  }

  // 3. Security headers
  app.use(helmet());
  app.use(hpp());

  // 4. CORS
  app.use(
    cors({
      origin: [env.WEB_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    })
  );

  // 5. Body parser & Cookies
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));

  // Serve uploaded images statically
  app.use(
    '/uploads',
    (req, res, next) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(path.resolve('uploads'))
  );

  // Health endpoints
  const healthHandler = async (_req: express.Request, res: express.Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return res.status(200).json({
        status: 'ok',
        app: 'VS Adda API',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: 'connected',
      });
    } catch (err: any) {
      return res.status(503).json({
        status: 'degraded',
        app: 'VS Adda API',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        error: err.message,
      });
    }
  };

  app.get('/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // Mount API modules
  app.use('/api/v1', authRouter);
  app.use('/api/v1', brandsRouter);
  app.use('/api/v1', invitesRouter);
  app.use('/api/v1', reviewRouter);
  app.use('/api/v1', approvalsRouter);
  app.use('/api/v1', postsRouter);
  app.use('/api/v1', channelsRouter);
  app.use('/api/v1', calendarRouter);
  app.use('/api/v1', inboxRouter);
  app.use('/api/v1', analyticsRouter);
  app.use('/api/v1', listeningRouter);
  app.use('/api/v1', libraryRouter);
  app.use('/api/v1', teamRouter);
  app.use('/api/v1', overviewRouter);
  app.use('/api/v1', searchRouter);

  // Fallback 404 for unknown routes
  app.use('/api', (_req, res) => {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
