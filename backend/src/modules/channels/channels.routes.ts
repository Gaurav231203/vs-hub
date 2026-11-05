import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { AppError } from '../../middleware/error.js';
import { Network, ChannelStatus, ConnectInviteStatus } from '@prisma/client';
import { generateSecureToken } from '../../lib/crypto.js';
import { generateMetaOAuthState, getMetaAuthorizeUrl } from './meta.service.js';

export const channelsRouter = Router();

// Apply auth & tenant context to channels routes
channelsRouter.use('/channels', authenticate, tenantMiddleware);

/**
 * GET /api/v1/channels/stats
 */
channelsRouter.get('/channels/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = req.ctx!;

    // Resolve active brands in this workspace
    const workspaceBrands = await prisma.brand.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    const activeBrandIds = workspaceBrands.map((b) => b.id);
    const brandIdsToQuery = ctx.allBrands ? activeBrandIds : ctx.brandIds.filter((id) => activeBrandIds.includes(id));

    const channels = await prisma.channel.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        brandId: { in: brandIdsToQuery },
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
 * GET /api/v1/channels/meta/auth-url
 * Direct Meta OAuth authorization URL for logged-in agency/brand users
 */
channelsRouter.get(
  '/channels/meta/auth-url',
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const brandId = (req.query.brandId as string) || (ctx.brandIds && ctx.brandIds[0]);

      if (!brandId) {
        throw new AppError('VALIDATION_ERROR', 'brandId is required', 400);
      }

      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }

      const { raw, hash } = generateSecureToken(32);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.connectInvite.create({
        data: {
          workspaceId: ctx.workspaceId,
          brandId,
          tokenHash: hash,
          expiresAt,
          status: ConnectInviteStatus.ACTIVE,
          createdBy: ctx.userId,
        },
      });

      const state = generateMetaOAuthState(raw, brandId);
      const authUrl = getMetaAuthorizeUrl(state, req);

      res.json({ authUrl });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/channels
 */
channelsRouter.get('/channels', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const brandId = req.query.brandId as string | undefined;
    const ctx = req.ctx!;

    // 1. Get all active brands in this workspace
    const workspaceBrands = await prisma.brand.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    const activeBrandIds = workspaceBrands.map((b) => b.id);

    // 2. Automatically clean up any orphaned channels belonging to deleted brands
    await prisma.channel.deleteMany({
      where: {
        workspaceId: ctx.workspaceId,
        brandId: { notIn: activeBrandIds },
      },
    }).catch(() => {});

    const where: any = {
      workspaceId: ctx.workspaceId,
    };

    if (brandId) {
      if (!activeBrandIds.includes(brandId) || (!ctx.allBrands && !ctx.brandIds.includes(brandId))) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Brand not found' } });
      }
      where.brandId = brandId;
    } else if (!ctx.allBrands) {
      const allowed = ctx.brandIds.filter((id) => activeBrandIds.includes(id));
      where.brandId = { in: allowed };
    } else {
      where.brandId = { in: activeBrandIds };
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
 * POST /api/v1/channels/:id/reconnect
 * Reconnects an individual channel and sets its status to CONNECTED in the database
 */
channelsRouter.post(
  '/channels/:id/reconnect',
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

      const updated = await prisma.channel.update({
        where: { id: req.params.id },
        data: {
          status: ChannelStatus.CONNECTED,
          lastError: null,
          tokenExpiresAt: new Date(Date.now() + 60 * 86400000), // 60 days
          postingEnabled: true,
        },
        include: { brand: true },
      });

      res.json({ success: true, channel: updated });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/channels/reconnect-all
 * Reconnects all channels in workspace in one bulk action
 */
channelsRouter.post(
  '/channels/reconnect-all',
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      await prisma.channel.updateMany({
        where: {
          workspaceId: ctx.workspaceId,
        },
        data: {
          status: ChannelStatus.CONNECTED,
          lastError: null,
          tokenExpiresAt: new Date(Date.now() + 60 * 86400000),
          postingEnabled: true,
        },
      });

      res.json({ success: true, message: 'All channels reconnected successfully' });
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
 * DELETE /api/v1/channels/purge-mocks
 * Permanently delete all demo/mock channels across the workspace
 */
channelsRouter.delete(
  '/channels/purge-mocks',
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const mockChannels = await prisma.channel.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          OR: [
            { accessTokenEnc: { startsWith: 'mock_' } },
            { externalId: { startsWith: 'mock_' } },
          ],
        },
        select: { id: true },
      });

      const ids = mockChannels.map((c) => c.id);
      if (ids.length > 0) {
        await prisma.postTarget.deleteMany({ where: { channelId: { in: ids } } });
        await prisma.metricDaily.deleteMany({ where: { channelId: { in: ids } } });
        await prisma.channel.deleteMany({ where: { id: { in: ids } } });
      }

      res.json({ success: true, count: ids.length });
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

      // Automatically clean up any post targets and metrics for this channel
      await prisma.postTarget.deleteMany({ where: { channelId: req.params.id } });
      await prisma.metricDaily.deleteMany({ where: { channelId: req.params.id } });

      await prisma.channel.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);
