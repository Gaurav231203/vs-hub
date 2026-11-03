import { prisma } from '../../lib/prisma.js';
import { UserContext } from '@postdesk/shared';

export class SearchService {
  static async search(ctx: UserContext, q: string) {
    if (!q || !q.trim()) {
      return { posts: [], conversations: [], channels: [], members: [] };
    }

    const term = q.trim();
    const brandScope = ctx.allBrands ? {} : { brandId: { in: ctx.brandIds } };

    const [posts, conversations, channels, members] = await Promise.all([
      // Posts
      prisma.post.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
          caption: { contains: term },
        },
        include: { brand: true },
        take: 5,
        orderBy: { updatedAt: 'desc' },
      }),

      // Conversations
      prisma.conversation.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          channel: brandScope,
          OR: [
            { authorName: { contains: term } },
            { authorHandle: { contains: term } },
            { messages: { some: { body: { contains: term } } } },
          ],
        },
        include: {
          channel: { include: { brand: true } },
        },
        take: 5,
        orderBy: { lastMessageAt: 'desc' },
      }),

      // Channels
      prisma.channel.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          ...brandScope,
          handle: { contains: term },
        },
        include: { brand: true },
        take: 5,
      }),

      // Team members
      prisma.membership.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          user: {
            OR: [
              { name: { contains: term } },
              { email: { contains: term } },
            ],
          },
        },
        include: { user: true },
        take: 5,
      }),
    ]);

    return {
      posts: posts.map((p) => ({
        id: p.id,
        caption: p.caption,
        status: p.status,
        brandName: p.brand.name,
        brandColor: p.brand.color,
      })),
      conversations: conversations.map((c) => ({
        id: c.id,
        authorName: c.authorName,
        authorHandle: c.authorHandle,
        channelHandle: c.channel.handle,
        network: c.channel.network,
        brandName: c.channel.brand.name,
      })),
      channels: channels.map((c) => ({
        id: c.id,
        handle: c.handle,
        network: c.network,
        brandName: c.brand.name,
      })),
      members: members.map((m) => ({
        id: m.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
    };
  }
}
