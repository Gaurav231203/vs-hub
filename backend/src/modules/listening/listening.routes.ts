import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { ListeningService } from './listening.service.js';
import { AppError } from '../../middleware/error.js';

export const listeningRouter = Router();

// Apply auth & tenant context to all listening routes
listeningRouter.use('/listening', authenticate, tenantMiddleware);

/**
 * GET /api/v1/listening/summary
 */
listeningRouter.get('/listening/summary', async (req, res, next) => {
  try {
    const brandId = req.query.brandId as string;
    const summary = await ListeningService.getSummary(req.ctx!, brandId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/listening/keywords
 */
listeningRouter.get('/listening/keywords', async (req, res, next) => {
  try {
    const brandId = req.query.brandId as string;
    const keywords = await ListeningService.getKeywords(req.ctx!, brandId);
    res.json({ keywords });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/listening/keywords
 */
listeningRouter.post(
  '/listening/keywords',
  requirePerm('listening.manage'),
  async (req, res, next) => {
    try {
      const { brandId, kind, term, handle } = req.body;
      if (!brandId || !kind || !term) {
        throw new AppError('VALIDATION_ERROR', 'brandId, kind, and term are required', 400);
      }

      const keyword = await ListeningService.addKeyword(req.ctx!, {
        brandId,
        kind,
        term,
        handle,
      });
      res.status(201).json(keyword);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/listening/keywords/:id
 */
listeningRouter.delete(
  '/listening/keywords/:id',
  requirePerm('listening.manage'),
  async (req, res, next) => {
    try {
      await ListeningService.deleteKeyword(req.ctx!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/listening/mentions
 */
listeningRouter.get('/listening/mentions', async (req, res, next) => {
  try {
    const brandId = req.query.brandId as string;
    const keywordId = req.query.keywordId as string;
    const sentiment = req.query.sentiment as any;
    const network = req.query.network as any;
    const savedOnly = req.query.savedOnly === 'true';
    const q = req.query.q as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 30;

    const result = await ListeningService.getMentions(req.ctx!, {
      brandId,
      keywordId,
      sentiment,
      network,
      savedOnly,
      q,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/listening/mentions/:id
 */
listeningRouter.patch('/listening/mentions/:id', async (req, res, next) => {
  try {
    const { saved, hidden } = req.body;
    const updated = await ListeningService.updateMention(req.ctx!, req.params.id, {
      saved,
      hidden,
    });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/listening/mentions/:id/reply-in-inbox
 */
listeningRouter.post('/listening/mentions/:id/reply-in-inbox', async (req, res, next) => {
  try {
    const result = await ListeningService.replyInInbox(req.ctx!, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/listening/trending
 */
listeningRouter.get('/listening/trending', async (req, res, next) => {
  try {
    const brandId = req.query.brandId as string;
    const trending = await ListeningService.getTrendingTerms(req.ctx!, brandId);
    res.json(trending);
  } catch (err) {
    next(err);
  }
});
