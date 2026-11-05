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
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: false,
    })
  );
  app.use(hpp());

  // 4. CORS
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (curl, mobile, server-to-server)
        if (!origin) return callback(null, true);

        // Allow localhost
        if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }

        // Allow all Vercel apps (*.vercel.app)
        if (origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }

        // Allow configured WEB_URL
        if (env.WEB_URL && (origin === env.WEB_URL || origin === env.WEB_URL.replace(/\/$/, ''))) {
          return callback(null, true);
        }

        // Fallback allow for frontend
        return callback(null, true);
      },
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

  // Legal endpoints (Meta Developer App review compliance)
  const privacyHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Privacy Policy - VS Adda</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333;}</style></head><body><h1>Privacy Policy - VS Adda</h1><p><strong>Effective Date:</strong> November 5, 2026 | <strong>App ID:</strong> 1700460381501081</p><p>VS Adda respects your privacy. We process social media identifiers, OAuth tokens, and analytics solely to schedule, publish, and analyze authorized brand content. We do not sell or share user data. To request data deletion, contact privacy@vsadda.com or visit /data-deletion.</p></body></html>`;
  const termsHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Terms of Service - VS Adda</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333;}</style></head><body><h1>Terms of Service - VS Adda</h1><p><strong>Effective Date:</strong> November 5, 2026 | <strong>App ID:</strong> 1700460381501081</p><p>By using VS Adda, you agree to comply with third-party platform terms (Meta, Google, X, LinkedIn). You may disconnect your accounts at any time from the Channels dashboard.</p></body></html>`;
  const deletionHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Data Deletion - VS Adda</title><style>body{font-family:sans-serif;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.6;color:#333;}</style></head><body><h1>User Data Deletion Instructions - VS Adda</h1><p><strong>App ID:</strong> 1700460381501081</p><p>To delete your data, disconnect your channel via the VS Adda Channels tab or remove the app in your Facebook Settings -> Apps and Websites. Alternatively, email privacy@vsadda.com.</p></body></html>`;

  app.get(['/privacy', '/api/v1/privacy'], (_req, res) => res.type('html').send(privacyHtml));
  app.get(['/terms', '/api/v1/terms'], (_req, res) => res.type('html').send(termsHtml));
  app.get(['/data-deletion', '/api/v1/data-deletion'], (_req, res) => res.type('html').send(deletionHtml));

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
