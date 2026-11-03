import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { TeamService } from './team.service.js';
import { AppError } from '../../middleware/error.js';

export const teamRouter = Router();

// Apply auth & tenant context to all team routes
teamRouter.use('/team', authenticate, tenantMiddleware);

/**
 * GET /api/v1/team/stats
 */
teamRouter.get('/team/stats', async (req, res, next) => {
  try {
    const stats = await TeamService.getStats(req.ctx!);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/team/members
 */
teamRouter.get('/team/members', async (req, res, next) => {
  try {
    const search = req.query.search as string;
    const role = req.query.role as string;
    const members = await TeamService.listMembers(req.ctx!, search, role);
    res.json({ members });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/team/invites
 */
teamRouter.get(
  '/team/invites',
  requirePerm('team.manage'),
  async (req, res, next) => {
    try {
      const invites = await TeamService.listInvites(req.ctx!);
      res.json({ invites });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/team/invites
 */
teamRouter.post(
  '/team/invites',
  requirePerm('team.manage'),
  async (req, res, next) => {
    try {
      const { email, role, brandIds } = req.body;
      if (!email || !role) {
        throw new AppError('VALIDATION_ERROR', 'email and role are required', 400);
      }

      const result = await TeamService.createInvite(req.ctx!, {
        email,
        role,
        brandIds: brandIds || [],
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/team/invites/:id/resend
 */
teamRouter.post(
  '/team/invites/:id/resend',
  requirePerm('team.manage'),
  async (req, res, next) => {
    try {
      const result = await TeamService.resendInvite(req.ctx!, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/team/invites/:id
 */
teamRouter.delete(
  '/team/invites/:id',
  requirePerm('team.manage'),
  async (req, res, next) => {
    try {
      await TeamService.cancelInvite(req.ctx!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/v1/team/members/:id
 */
teamRouter.patch(
  '/team/members/:id',
  requirePerm('team.manage'),
  async (req, res, next) => {
    try {
      const { role, status, brandIds } = req.body;
      const updated = await TeamService.updateMember(req.ctx!, req.params.id, {
        role,
        status,
        brandIds,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/team/audit
 */
teamRouter.get(
  '/team/audit',
  requirePerm('team.manage'),
  async (req, res, next) => {
    try {
      const actorId = req.query.actorId as string;
      const action = req.query.action as string;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 50;

      const logs = await TeamService.getAuditLogs(req.ctx!, {
        actorId,
        action,
        page,
        limit,
      });
      res.json(logs);
    } catch (err) {
      next(err);
    }
  }
);
