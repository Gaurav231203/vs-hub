import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { InboxService } from './inbox.service.js';
import { AppError } from '../../middleware/error.js';

export const inboxRouter = Router();

// Apply auth & tenant context to all inbox routes
inboxRouter.use('/inbox', authenticate, tenantMiddleware);

/**
 * GET /api/v1/inbox/conversations
 */
inboxRouter.get('/inbox/conversations', async (req, res, next) => {
  try {
    const filter = req.query.filter as any;
    const brandId = req.query.brandId as string;
    const channelId = req.query.channelId as string;
    const status = req.query.status as any;
    const q = req.query.q as string;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 30;

    const result = await InboxService.listConversations(req.ctx!, {
      filter,
      brandId,
      channelId,
      status,
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
 * GET /api/v1/inbox/conversations/stats
 */
inboxRouter.get('/inbox/conversations/stats', async (req, res, next) => {
  try {
    const brandId = req.query.brandId as string;
    const stats = await InboxService.getSummaryStats(req.ctx!, brandId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/inbox/saved-replies
 */
inboxRouter.get('/inbox/saved-replies', async (req, res, next) => {
  try {
    const replies = await InboxService.getSavedReplies(req.ctx!);
    res.json({ replies });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/inbox/conversations/:id
 */
inboxRouter.get('/inbox/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await InboxService.getConversation(req.ctx!, req.params.id);
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/inbox/conversations/:id/reply
 */
inboxRouter.post(
  '/inbox/conversations/:id/reply',
  requirePerm('inbox.reply'),
  async (req, res, next) => {
    try {
      const { body } = req.body;
      if (!body || typeof body !== 'string' || body.trim().length === 0) {
        throw new AppError('VALIDATION_ERROR', 'Reply body is required', 400);
      }

      const message = await InboxService.reply(req.ctx!, req.params.id, body.trim());
      res.status(201).json(message);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/inbox/conversations/:id/note
 */
inboxRouter.post(
  '/inbox/conversations/:id/note',
  requirePerm('inbox.reply'),
  async (req, res, next) => {
    try {
      const { body } = req.body;
      if (!body || typeof body !== 'string' || body.trim().length === 0) {
        throw new AppError('VALIDATION_ERROR', 'Note body is required', 400);
      }

      const note = await InboxService.addNote(req.ctx!, req.params.id, body.trim());
      res.status(201).json(note);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/inbox/conversations/:id
 */
inboxRouter.patch(
  '/inbox/conversations/:id',
  async (req, res, next) => {
    try {
      const { assigneeId, flagged, status, sentiment, priority } = req.body;

      // Assignee modification requires inbox.assign (or inbox.reply if user has permissions)
      if (assigneeId !== undefined && !req.ctx!.perms.includes('inbox.assign')) {
        throw new AppError('FORBIDDEN', 'Permission inbox.assign required to assign conversations', 403);
      }

      // Flag, status, sentiment, priority modifications require inbox.reply
      if (
        (flagged !== undefined || status !== undefined || sentiment !== undefined || priority !== undefined) &&
        !req.ctx!.perms.includes('inbox.reply')
      ) {
        throw new AppError('FORBIDDEN', 'Permission inbox.reply required to modify conversation state', 403);
      }

      const updated = await InboxService.updateConversation(req.ctx!, req.params.id, {
        assigneeId,
        flagged,
        status,
        sentiment,
        priority,
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/inbox/ingest-mock (for testing & simulations)
 */
inboxRouter.post(
  '/inbox/ingest-mock',
  requirePerm('inbox.reply'),
  async (req, res, next) => {
    try {
      const { channelId, externalId, authorName, authorHandle, body, type } = req.body;
      if (!channelId || !externalId || !authorName || !body) {
        throw new AppError('VALIDATION_ERROR', 'channelId, externalId, authorName, and body are required', 400);
      }

      const convo = await InboxService.ingestMessage({
        channelId,
        externalId,
        authorName,
        authorHandle,
        body,
        type,
      });

      res.status(201).json(convo);
    } catch (err) {
      next(err);
    }
  }
);
