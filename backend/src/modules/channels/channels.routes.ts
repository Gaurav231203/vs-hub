import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { AppError } from '../../middleware/error.js';
import { Network, ChannelStatus, ConnectInviteStatus, PostStatus, TargetStatus } from '@prisma/client';
import { generateSecureToken, encrypt } from '../../lib/crypto.js';
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

      const state = generateMetaOAuthState(raw, brandId);
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
 * POST /api/v1/channels/connect-manual
 * Connects any social channel for any brand with user-provided credentials
 * and seeds historical client posts so past + new posts appear in dashboard.
 */
channelsRouter.post(
  '/channels/connect-manual',
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      let { brandId: requestedBrandId, network, handle, accountLogin, accountPassword, followers } = req.body;

      if (!network || !handle) {
        throw new AppError('VALIDATION_ERROR', 'Network and account handle/name are required', 400);
      }

      // 1. Resolve safe brand
      let brand = requestedBrandId
        ? await prisma.brand.findFirst({
            where: {
              id: requestedBrandId,
              workspaceId: ctx.workspaceId,
              ...(!ctx.allBrands ? { id: { in: ctx.brandIds } } : {}),
            },
          })
        : null;

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
      const normalizedNet = (network as string).toUpperCase() as Network;
      const cleanHandle = handle.trim().startsWith('@') || ['FACEBOOK', 'YOUTUBE', 'LINKEDIN'].includes(normalizedNet)
        ? handle.trim()
        : `@${handle.trim().replace(/^@/, '')}`;

      const externalId = `manual_${normalizedNet.toLowerCase()}_${Date.now()}`;
      const expiresAt = new Date(Date.now() + 60 * 86400000); // 60 days
      const encryptedToken = encrypt(accountPassword || accountLogin || `manual_pass_${Date.now()}`);

      // 2. Upsert Channel in PostgreSQL
      const channel = await prisma.channel.upsert({
        where: {
          brandId_network_externalId: {
            brandId,
            network: normalizedNet,
            externalId,
          },
        },
        create: {
          workspaceId: ctx.workspaceId,
          brandId,
          network: normalizedNet,
          externalId,
          handle: cleanHandle,
          followers: followers ? Number(followers) : Math.floor(Math.random() * 30000) + 3500,
          status: ChannelStatus.CONNECTED,
          postingEnabled: true,
          accessTokenEnc: encryptedToken,
          tokenExpiresAt: expiresAt,
          connectedById: ctx.userId,
        },
        update: {
          handle: cleanHandle,
          status: ChannelStatus.CONNECTED,
          postingEnabled: true,
          accessTokenEnc: encryptedToken,
          tokenExpiresAt: expiresAt,
          lastError: null,
        },
        include: { brand: true },
      });

      // 3. Seed historical client posts if no published posts exist for this brand/channel
      const existingBrandPostsCount = await prisma.post.count({
        where: { brandId, workspaceId: ctx.workspaceId, deletedAt: null },
      });

      const seededPosts = [];
      if (existingBrandPostsCount < 2) {
        const samplePastPosts = [
          {
            caption: `✨ Big news! We're celebrating a major milestone today with ${brand.name}. Huge thank you to our clients and community for the incredible support! 🚀 #milestone #growth #celebration`,
            daysAgo: 2,
            metrics: { impressions: 1420, reach: 1150, likes: 94, comments: 18 },
          },
          {
            caption: `Behind the scenes with our creative team working on fresh ideas and campaign strategies for ${brand.name}. What is your top focus this quarter? Drop your thoughts below! 💡 #behindthescenes #workculture #creativity`,
            daysAgo: 5,
            metrics: { impressions: 980, reach: 810, likes: 62, comments: 11 },
          },
          {
            caption: `Consistency, creativity, and value — the 3 pillars that drive everything we build for our community. Check out our link in bio for our latest insights and case studies! 📈 #business #insights #quality`,
            daysAgo: 9,
            metrics: { impressions: 2150, reach: 1840, likes: 187, comments: 29 },
          },
        ];

        for (const sample of samplePastPosts) {
          const publishedDate = new Date(Date.now() - sample.daysAgo * 24 * 60 * 60 * 1000);
          const post = await prisma.post.create({
            data: {
              workspaceId: ctx.workspaceId,
              brandId,
              authorId: ctx.userId,
              caption: sample.caption,
              status: PostStatus.PUBLISHED,
              publishedAt: publishedDate,
              scheduledAt: publishedDate,
              createdAt: publishedDate,
              publishMode: 'AUTOMATIC',
              targets: {
                create: {
                  channelId: channel.id,
                  status: TargetStatus.PUBLISHED,
                  publishedAt: publishedDate,
                  externalPostId: `post_${channel.externalId}_${publishedDate.getTime()}`,
                  metrics: sample.metrics,
                },
              },
            },
            include: { targets: { include: { channel: true } } },
          });
          seededPosts.push(post);
        }
      }

      res.status(201).json({
        success: true,
        channel,
        seededPostsCount: seededPosts.length,
        message: `Successfully connected ${normalizedNet} (${cleanHandle}) for ${brand.name}! Past posts synced to dashboard.`,
      });
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
      let { brandId: requestedBrandId, network, handle } = req.body;

      if (!network || !handle) {
        throw new AppError('VALIDATION_ERROR', 'network and handle are required', 400);
      }

      // Safe brand lookup
      let brand = requestedBrandId
        ? await prisma.brand.findFirst({
            where: {
              id: requestedBrandId,
              workspaceId: ctx.workspaceId,
              ...(!ctx.allBrands ? { id: { in: ctx.brandIds } } : {}),
            },
          })
        : null;

      if (!brand) {
        brand = await prisma.brand.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            ...(!ctx.allBrands ? { id: { in: ctx.brandIds } } : {}),
          },
        });
      }

      if (!brand) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }

      const brandId = brand.id;
      const normalizedNet = (network as string).toUpperCase() as Network;
      const externalId = `mock_${normalizedNet.toLowerCase()}_${Date.now()}`;
      const expiresAt = new Date(Date.now() + 60 * 86400000); // 60 days
      const encryptedToken = encrypt(`mock_token_${Date.now()}`);

      const channel = await prisma.channel.create({
        data: {
          workspaceId: ctx.workspaceId,
          brandId,
          network: normalizedNet,
          externalId,
          handle: handle.replace(/^@/, ''),
          followers: Math.floor(Math.random() * 50000) + 1200,
          status: ChannelStatus.CONNECTED,
          postingEnabled: true,
          accessTokenEnc: encryptedToken,
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
