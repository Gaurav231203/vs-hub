import { prisma } from '../../lib/prisma.js';
import { UserContext } from '@postdesk/shared';
import { AppError } from '../../middleware/error.js';

export class OverviewService {
  static async getWidgets(ctx: UserContext, brandId?: string) {
    let brandScope: any = {};
    if (brandId) {
      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }
      brandScope = { brandId };
    } else if (!ctx.allBrands) {
      brandScope = { brandId: { in: ctx.brandIds } };
    }

    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 86400000);

    const [
      pendingApprovals,
      changesRequested,
      failedPosts,
      brokenChannels,
      upNextPost,
      comingUpPosts,
      weekAheadPosts,
      inboxConversations,
      channelStats,
    ] = await Promise.all([
      // 1. Pending approvals for this user / workspace
      prisma.post.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
          status: 'PENDING',
        },
        include: {
          brand: true,
          author: { select: { name: true, avatarUrl: true } },
          targets: { include: { channel: true } },
        },
        take: 5,
        orderBy: { scheduledAt: 'asc' },
      }),

      // 2. Changes requested on my posts
      prisma.post.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
          authorId: ctx.userId,
          status: 'CHANGES',
        },
        include: { brand: true, targets: { include: { channel: true } } },
        take: 5,
      }),

      // 3. Failed posts with Retry
      prisma.post.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
          status: 'FAILED',
        },
        include: { brand: true, targets: { include: { channel: true } } },
        take: 5,
      }),

      // 4. Broken channels
      prisma.channel.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
          status: { in: ['EXPIRING', 'DISCONNECTED'] },
        },
        include: { brand: true },
      }),

      // 5. Up next (closest scheduled post in future)
      prisma.post.findFirst({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
          status: 'SCHEDULED',
          scheduledAt: { gte: now },
        },
        include: {
          brand: true,
          author: { select: { name: true, avatarUrl: true } },
          targets: { include: { channel: true } },
          media: { include: { asset: true } },
        },
        orderBy: { scheduledAt: 'asc' },
      }),

      // 6. Coming up (next 6 posts)
      prisma.post.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
          status: 'SCHEDULED',
          scheduledAt: { gte: now },
        },
        include: {
          brand: true,
          targets: { include: { channel: true } },
          media: { include: { asset: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        skip: 1,
        take: 6,
      }),

      // 7. Week ahead (next 7 days)
      prisma.post.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
          scheduledAt: { gte: now, lte: sevenDaysLater },
        },
        include: { brand: true },
        orderBy: { scheduledAt: 'asc' },
      }),

      // 8. Inbox pulse (latest 3 unread/priority conversations)
      prisma.conversation.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          channel: brandScope,
          status: 'OPEN',
        },
        include: {
          channel: { include: { brand: true } },
          messages: { orderBy: { sentAt: 'desc' }, take: 1 },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 3,
      }),

      // 9. Network Pulse (channels grouped by network)
      prisma.channel.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
        },
        select: {
          id: true,
          network: true,
          followers: true,
          status: true,
          postingEnabled: true,
        },
      }),
    ]);

    // Group week ahead by day offset 0..6
    const weekAheadDays = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now.getTime() + i * 86400000);
      const dateStr = d.toISOString().slice(0, 10);
      const postsForDay = weekAheadPosts.filter(
        (p) => p.scheduledAt && p.scheduledAt.toISOString().slice(0, 10) === dateStr
      );
      return {
        date: dateStr,
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        postsCount: postsForDay.length,
        posts: postsForDay.slice(0, 3).map((p) => ({
          id: p.id,
          status: p.status,
          brandColor: p.brand.color,
          caption: p.caption,
        })),
      };
    });

    const needsYouCount =
      pendingApprovals.length +
      changesRequested.length +
      failedPosts.length +
      brokenChannels.length;

    return {
      needsYouCount,
      needsYou: {
        pendingApprovals,
        changesRequested,
        failedPosts,
        brokenChannels,
      },
      upNext: upNextPost,
      comingUp: comingUpPosts,
      weekAhead: weekAheadDays,
      inboxPulse: inboxConversations,
      networkPulse: channelStats,
    };
  }
}
