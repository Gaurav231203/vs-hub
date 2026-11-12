import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { AppError } from '../../middleware/error.js';
import { Network, ChannelStatus, ConnectInviteStatus, PostStatus, TargetStatus, BrandStatus } from '@prisma/client';
import { generateSecureToken, encrypt } from '../../lib/crypto.js';
import { generateMetaOAuthState, getMetaAuthorizeUrl } from './meta.service.js';
import { ChannelSyncService, computeChannelGrowthPct, computeDaysLeft } from './sync.service.js';
import { getWebUrl } from '../../lib/urls.js';
import { logger } from '../../lib/logger.js';

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
      let requestedBrandId = (req.query.brandId as string) || (ctx.brandIds && ctx.brandIds[0]);

      // 1. Check if the requested brandId exists in this workspace and user has access
      let brand = requestedBrandId
        ? await prisma.brand.findFirst({
            where: {
              id: requestedBrandId,
              workspaceId: ctx.workspaceId,
              ...(!ctx.allBrands ? { id: { in: ctx.brandIds } } : {}),
            },
          })
        : null;

      // 2. Fallback to the first active brand in the workspace if requested brand was invalid/dummy (e.g. 'ember')
      if (!brand) {
        brand = await prisma.brand.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            ...(!ctx.allBrands ? { id: { in: ctx.brandIds } } : {}),
          },
        });
      }

      if (!brand) {
        throw new AppError('BRAND_NOT_FOUND', 'No active brand found in workspace to connect', 404);
      }

      const brandId = brand.id;

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

      const state = generateMetaOAuthState(raw, brandId, getWebUrl(req));
      const authUrl = getMetaAuthorizeUrl(state, req);

      res.json({ authUrl, brandId, brandName: brand.name });
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

    const channelIds = channels.map((c) => c.id);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentMetrics =
      channelIds.length > 0
        ? await prisma.metricDaily.findMany({
            where: {
              channelId: { in: channelIds },
              date: { gte: thirtyDaysAgo },
            },
            orderBy: { date: 'asc' },
            select: { channelId: true, date: true, followers: true },
          })
        : [];

    const metricsByChannel = new Map<string, Array<{ date: Date; followers: number }>>();
    for (const row of recentMetrics) {
      const list = metricsByChannel.get(row.channelId) || [];
      list.push({ date: row.date, followers: row.followers });
      metricsByChannel.set(row.channelId, list);
    }

    const sanitizedChannels = channels.map((c) => {
      const { accessTokenEnc, refreshTokenEnc, ...safeChannel } = c as any;
      const growthPct = computeChannelGrowthPct(metricsByChannel.get(c.id) || []);
      const daysLeft = computeDaysLeft(c.tokenExpiresAt);
      return {
        ...safeChannel,
        growthPct,
        daysLeft,
        totalDays: 60,
      };
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
 * POST /api/v1/channels/sync-all
 * Live middle-handler sync: fetches real follower counts, avatars, and posts
 * from connected Meta / social APIs using encrypted tokens.
 */
channelsRouter.post('/channels/sync-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = req.ctx!;
    const requestedBrandId = (req.body?.brandId as string) || (req.query.brandId as string) || undefined;

    const workspaceBrands = await prisma.brand.findMany({
      where: { workspaceId: ctx.workspaceId },
      select: { id: true },
    });
    const activeBrandIds = workspaceBrands.map((b) => b.id);
    const allowedBrands = ctx.allBrands
      ? activeBrandIds
      : ctx.brandIds.filter((id) => activeBrandIds.includes(id));

    if (requestedBrandId && !allowedBrands.includes(requestedBrandId)) {
      throw new AppError('NOT_FOUND', 'Brand not found', 404);
    }

    const channels = await prisma.channel.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        brandId: requestedBrandId ? requestedBrandId : { in: allowedBrands },
      },
      select: { id: true },
    });

    const settled = await Promise.allSettled(
      channels.map((ch) => ChannelSyncService.syncChannel(ch.id))
    );

    const results = settled
      .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
      .map((r) => r.value);

    const syncedCount = results.filter((r) => r.synced).length;

    res.json({
      success: true,
      total: channels.length,
      syncedCount,
      results,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/channels/:id/sync
 * Sync a single connected channel with live social API data
 */
channelsRouter.post('/channels/:id/sync', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = req.ctx!;
    const channel = await prisma.channel.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspaceId },
    });
    if (!channel) throw new AppError('CHANNEL_NOT_FOUND', 'Channel not found', 404);

    if (!ctx.allBrands && !ctx.brandIds.includes(channel.brandId)) {
      throw new AppError('CHANNEL_NOT_FOUND', 'Channel not found', 404);
    }

    const outcome = await ChannelSyncService.syncChannel(channel.id);
    res.json({ success: true, outcome });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/channels/:id/meta-diagnostics
 * Live diagnostics of Meta OAuth token granular_scopes & Page visibility
 */
channelsRouter.get('/channels/:id/meta-diagnostics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = req.ctx!;
    const channel = await prisma.channel.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspaceId },
    });
    if (!channel) throw new AppError('CHANNEL_NOT_FOUND', 'Channel not found', 404);

    if (!ctx.allBrands && !ctx.brandIds.includes(channel.brandId)) {
      throw new AppError('CHANNEL_NOT_FOUND', 'Channel not found', 404);
    }

    const report = await ChannelSyncService.diagnoseMetaChannel(channel.id);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/channels/connect-manual
 * Disabled: manual password linking created fake/unverified channel records and seeded dummy posts.
 */
channelsRouter.post(
  '/channels/connect-manual',
  requirePerm('channels.manage'),
  async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      throw new AppError(
        'OAUTH_REQUIRED',
        'Manual ID & password linking is disabled. Please connect your social account via Official OAuth.',
        400
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/channels/connect-mock
 * Disabled: mock channel creation is not permitted.
 */
channelsRouter.post(
  '/channels/connect-mock',
  requirePerm('channels.manage'),
  async (_req: Request, _res: Response, next: NextFunction) => {
    try {
      throw new AppError(
        'OAUTH_REQUIRED',
        'Mock channel linking is disabled. Please connect your social account via Official OAuth.',
        400
      );
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/channels/purge-mocks
 * Permanently delete all demo/mock/manual channels across the workspace
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
            { externalId: { startsWith: 'manual_' } },
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
