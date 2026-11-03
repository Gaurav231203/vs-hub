import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { AppError } from '../../middleware/error.js';
import { Network, ChannelStatus } from '@prisma/client';

export const channelsRouter = Router();

// Apply auth & tenant context to channels routes
channelsRouter.use('/channels', authenticate, tenantMiddleware);

/**
 * GET /api/v1/channels/stats
 */
channelsRouter.get('/channels/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = req.ctx!;
    const brandScope = ctx.allBrands ? {} : { brandId: { in: ctx.brandIds } };

    const channels = await prisma.channel.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...brandScope,
      },
      select: {
        id: true,
        network: true,
        status: true,
        followers: true,
      },
    });

    const totalAccounts = channels.length;
    const needingAttention = channels.filter(
      (c) => c.status === ChannelStatus.EXPIRING || c.status === ChannelStatus.DISCONNECTED
    ).length;
    const totalAudience = channels.reduce((sum, c) => sum + c.followers, 0);
    const uniqueNetworks = new Set(channels.map((c) => c.network)).size;

    res.json({
      totalAccounts,
      needingAttention,
      totalAudience,
      uniqueNetworks,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/channels
 */
channelsRouter.get('/channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brandId = req.query.brandId as string | undefined;
    const ctx = req.ctx!;

    const where: any = {
      workspaceId: ctx.workspaceId,
    };

    if (brandId) {
      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Brand not found' } });
      }
      where.brandId = brandId;
    } else if (!ctx.allBrands) {
      where.brandId = { in: ctx.brandIds };
    }

    const channels = await prisma.channel.findMany({
      where,
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            color: true,
            logoUrl: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const sanitizedChannels = channels.map((c) => {
      const { accessTokenEnc, refreshTokenEnc, ...safeChannel } = c as any;
      return safeChannel;
    });

    return res.status(200).json({ channels: sanitizedChannels });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/channels/:id
 */
channelsRouter.patch(
  '/channels/:id',
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const { postingEnabled, status } = req.body;

      const channel = await prisma.channel.findFirst({
        where: { id: req.params.id, workspaceId: ctx.workspaceId },
      });
      if (!channel) throw new AppError('CHANNEL_NOT_FOUND', 'Channel not found', 404);

      if (!ctx.allBrands && !ctx.brandIds.includes(channel.brandId)) {
        throw new AppError('CHANNEL_NOT_FOUND', 'Channel not found', 404);
      }

      const updateData: any = {};
      if (postingEnabled !== undefined) updateData.postingEnabled = postingEnabled;
      if (status !== undefined) {
        updateData.status = status;
        if (status === 'CONNECTED') {
          updateData.lastError = null;
          updateData.tokenExpiresAt = new Date(Date.now() + 60 * 86400000); // 60 days
        }
      }

      const updated = await prisma.channel.update({
        where: { id: req.params.id },
        data: updateData,
        include: { brand: true },
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/channels/connect-mock
 */
channelsRouter.post(
  '/channels/connect-mock',
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const { brandId, network, handle } = req.body;

      if (!brandId || !network || !handle) {
        throw new AppError('VALIDATION_ERROR', 'brandId, network, and handle are required', 400);
      }

      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }

      const externalId = `mock_${network.toLowerCase()}_${Date.now()}`;
      const expiresAt = new Date(Date.now() + 60 * 86400000); // 60 days

      const channel = await prisma.channel.create({
        data: {
          workspaceId: ctx.workspaceId,
          brandId,
          network: network as Network,
          externalId,
          handle: handle.replace(/^@/, ''),
          followers: Math.floor(Math.random() * 50000) + 1200,
          status: ChannelStatus.CONNECTED,
          postingEnabled: true,
          tokenExpiresAt: expiresAt,
          connectedById: ctx.userId,
        },
        include: { brand: true },
      });

      res.status(201).json(channel);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/channels/:id
 */
channelsRouter.delete(
  '/channels/:id',
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;

      const channel = await prisma.channel.findFirst({
        where: { id: req.params.id, workspaceId: ctx.workspaceId },
      });
      if (!channel) throw new AppError('CHANNEL_NOT_FOUND', 'Channel not found', 404);

      if (!ctx.allBrands && !ctx.brandIds.includes(channel.brandId)) {
        throw new AppError('CHANNEL_NOT_FOUND', 'Channel not found', 404);
      }

      // Guard: Check if channel has active queued or publishing posts
      const activeTargets = await prisma.postTarget.count({
        where: {
          channelId: req.params.id,
          status: { in: ['QUEUED', 'PUBLISHING'] },
        },
      });

      if (activeTargets > 0) {
        throw new AppError(
          'CHANNEL_HAS_ACTIVE_POSTS',
          `Cannot delete channel with ${activeTargets} pending or publishing post(s). Please reschedule or delete the posts first.`,
          400
        );
      }

      await prisma.channel.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);
