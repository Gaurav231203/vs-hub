import { prisma } from '../../lib/prisma.js';
import { UserContext } from '@postdesk/shared';
import { analyzeSentiment } from '../../lib/sentiment.js';
import { AppError } from '../../middleware/error.js';
import { Sentiment, ConvoStatus } from '@prisma/client';

export interface InboxFilterQuery {
  filter?: 'all' | 'unread' | 'mine' | 'unassigned' | 'priority';
  brandId?: string;
  channelId?: string;
  status?: 'OPEN' | 'CLOSED' | 'ALL';
  q?: string;
  page?: number;
  limit?: number;
}

export class InboxService {
  /**
   * List conversations with search, filtering, and pagination
   */
  static async listConversations(ctx: UserContext, query: InboxFilterQuery) {
    const {
      filter = 'all',
      brandId,
      channelId,
      status = 'OPEN',
      q,
      page = 1,
      limit = 30,
    } = query;

    // Build brand scope
    let brandScope: any = {};
    if (brandId) {
      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }
      brandScope = { brandId };
    } else if (!ctx.allBrands) {
      brandScope = { brandId: { in: ctx.brandIds } };
    }

    const where: any = {
      workspaceId: ctx.workspaceId,
      channel: {
        ...brandScope,
        ...(channelId ? { id: channelId } : {}),
      },
    };

    // Filter logic
    if (status !== 'ALL') {
      where.status = status;
    }

    if (filter === 'unread') {
      where.unread = true;
    } else if (filter === 'mine') {
      where.assigneeId = ctx.userId;
    } else if (filter === 'unassigned') {
      where.assigneeId = null;
    } else if (filter === 'priority') {
      where.priority = true;
    }

    // Search query
    if (q && q.trim().length > 0) {
      const searchTerm = q.trim();
      where.OR = [
        { authorName: { contains: searchTerm } },
        { authorHandle: { contains: searchTerm } },
        { messages: { some: { body: { contains: searchTerm } } } },
      ];
    }

    const [total, conversations] = await Promise.all([
      prisma.conversation.count({ where }),
      prisma.conversation.findMany({
        where,
        orderBy: { lastMessageAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          channel: {
            select: {
              id: true,
              network: true,
              handle: true,
              avatarUrl: true,
              brand: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  logoUrl: true,
                },
              },
            },
          },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: {
              id: true,
              direction: true,
              body: true,
              sentAt: true,
            },
          },
        },
      }),
    ]);

    // Fetch assignee user names for the conversations
    const assigneeIds = Array.from(
      new Set(conversations.map((c) => c.assigneeId).filter(Boolean) as string[])
    );
    const assignees = assigneeIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];
    const assigneeMap = new Map(assignees.map((a) => [a.id, a]));

    const enriched = conversations.map((c) => ({
      ...c,
      lastMessage: c.messages[0] || null,
      assignee: c.assigneeId ? assigneeMap.get(c.assigneeId) || null : null,
    }));

    return {
      items: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Quick summary metrics for inbox header
   */
  static async getSummaryStats(ctx: UserContext, brandId?: string) {
    let brandScope: any = {};
    if (brandId) {
      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }
      brandScope = { brandId };
    } else if (!ctx.allBrands) {
      brandScope = { brandId: { in: ctx.brandIds } };
    }

    const baseWhere = {
      workspaceId: ctx.workspaceId,
      channel: brandScope,
    };

    const [openCount, unreadCount, priorityCount, repliedRecent] = await Promise.all([
      prisma.conversation.count({
        where: { ...baseWhere, status: ConvoStatus.OPEN },
      }),
      prisma.conversation.count({
        where: { ...baseWhere, unread: true },
      }),
      prisma.conversation.count({
        where: { ...baseWhere, priority: true, status: ConvoStatus.OPEN },
      }),
      // Median first reply time over the last 30 days
      prisma.conversation.findMany({
        where: {
          ...baseWhere,
          firstReplyAt: { not: null },
          createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
        },
        select: {
          createdAt: true,
          firstReplyAt: true,
        },
        take: 200,
      }),
    ]);

    let medianFirstReplyMinutes = 0;
    if (repliedRecent.length > 0) {
      const durations = repliedRecent
        .map((r) => Math.max(0, (r.firstReplyAt!.getTime() - r.createdAt.getTime()) / 60000))
        .sort((a, b) => a - b);
      const mid = Math.floor(durations.length / 2);
      medianFirstReplyMinutes =
        durations.length % 2 !== 0
          ? durations[mid]
          : Math.round((durations[mid - 1] + durations[mid]) / 2);
    }

    return {
      openCount,
      unreadCount,
      priorityCount,
      medianFirstReplyMinutes,
    };
  }

  /**
   * Get single conversation with full message thread, marking as read
   */
  static async getConversation(ctx: UserContext, id: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
      include: {
        channel: {
          include: {
            brand: true,
          },
        },
        messages: {
          orderBy: { sentAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    // Check brand access
    if (!ctx.allBrands && !ctx.brandIds.includes(conversation.channel.brandId)) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    // Mark as read if currently unread
    if (conversation.unread) {
      await prisma.conversation.update({
        where: { id },
        data: { unread: false },
      });
      conversation.unread = false;
    }

    // Fetch author details for any OUT or NOTE messages
    const authorUserIds = Array.from(
      new Set(conversation.messages.map((m) => m.authorUserId).filter(Boolean) as string[])
    );
    const authorUsers = authorUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: authorUserIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];
    const authorMap = new Map(authorUsers.map((u) => [u.id, u]));

    // Fetch assignee user if present
    let assignee = null;
    if (conversation.assigneeId) {
      assignee = await prisma.user.findUnique({
        where: { id: conversation.assigneeId },
        select: { id: true, name: true, avatarUrl: true },
      });
    }

    // Filter NOTE messages if user is CLIENT
    let messages = conversation.messages;
    if (ctx.role === 'CLIENT') {
      messages = messages.filter((m) => m.direction !== 'NOTE');
    }

    const enrichedMessages = messages.map((m) => ({
      ...m,
      authorUser: m.authorUserId ? authorMap.get(m.authorUserId) || null : null,
    }));

    return {
      ...conversation,
      assignee,
      messages: enrichedMessages,
    };
  }

  /**
   * Reply to conversation
   */
  static async reply(ctx: UserContext, id: string, rawBody: string) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
      include: {
        channel: {
          include: {
            brand: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    if (!ctx.allBrands && !ctx.brandIds.includes(conversation.channel.brandId)) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    // Interpolate saved-reply variables: {name}, {brand}
    let body = rawBody
      .replace(/{name}/g, conversation.authorName || 'there')
      .replace(/{brand}/g, conversation.channel.brand.name || 'our team');

    const now = new Date();

    const [newMessage] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: id,
          direction: 'OUT',
          body,
          authorUserId: ctx.userId,
          sentAt: now,
        },
      }),
      prisma.conversation.update({
        where: { id },
        data: {
          lastMessageAt: now,
          firstReplyAt: conversation.firstReplyAt ? undefined : now,
        },
      }),
    ]);

    const authorUser = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, avatarUrl: true },
    });

    return {
      ...newMessage,
      authorUser,
    };
  }

  /**
   * Add internal note (hidden from clients, never sent to network)
   */
  static async addNote(ctx: UserContext, id: string, body: string) {
    if (ctx.role === 'CLIENT') {
      throw new AppError('FORBIDDEN', 'Clients cannot add internal notes', 403);
    }

    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
      include: {
        channel: true,
      },
    });

    if (!conversation) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    if (!ctx.allBrands && !ctx.brandIds.includes(conversation.channel.brandId)) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    const now = new Date();
    const [note] = await prisma.$transaction([
      prisma.message.create({
        data: {
          conversationId: id,
          direction: 'NOTE',
          body,
          authorUserId: ctx.userId,
          sentAt: now,
        },
      }),
      prisma.conversation.update({
        where: { id },
        data: { lastMessageAt: now },
      }),
    ]);

    const authorUser = await prisma.user.findUnique({
      where: { id: ctx.userId },
      select: { id: true, name: true, avatarUrl: true },
    });

    return {
      ...note,
      authorUser,
    };
  }

  /**
   * Update conversation metadata (assignee, flag, close/reopen, sentiment, priority)
   */
  static async updateConversation(
    ctx: UserContext,
    id: string,
    data: {
      assigneeId?: string | null;
      flagged?: boolean;
      status?: ConvoStatus;
      sentiment?: Sentiment;
      priority?: boolean;
    }
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: {
        id,
        workspaceId: ctx.workspaceId,
      },
      include: {
        channel: true,
      },
    });

    if (!conversation) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    if (!ctx.allBrands && !ctx.brandIds.includes(conversation.channel.brandId)) {
      throw new AppError('CONVERSATION_NOT_FOUND', 'Conversation not found', 404);
    }

    const updateData: any = {};

    if (data.assigneeId !== undefined) {
      if (data.assigneeId === null) {
        updateData.assigneeId = null;
      } else {
        // Validate assignee exists in workspace and has brand access
        const assigneeMembership = await prisma.membership.findFirst({
          where: {
            workspaceId: ctx.workspaceId,
            userId: data.assigneeId,
            status: 'ACTIVE',
          },
          include: {
            brands: true,
          },
        });

        if (!assigneeMembership) {
          throw new AppError('INVALID_ASSIGNEE', 'Assignee is not an active team member', 400);
        }

        if (!assigneeMembership.allBrands) {
          const hasBrand = assigneeMembership.brands.some(
            (b) => b.brandId === conversation.channel.brandId
          );
          if (!hasBrand) {
            throw new AppError(
              'INVALID_ASSIGNEE',
              'Assignee does not have access to this brand',
              400
            );
          }
        }

        updateData.assigneeId = data.assigneeId;
      }
    }

    if (data.flagged !== undefined) updateData.flagged = data.flagged;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.sentiment !== undefined) updateData.sentiment = data.sentiment;
    if (data.priority !== undefined) updateData.priority = data.priority;

    const updated = await prisma.conversation.update({
      where: { id },
      data: updateData,
      include: {
        channel: {
          include: { brand: true },
        },
      },
    });

    let assignee = null;
    if (updated.assigneeId) {
      assignee = await prisma.user.findUnique({
        where: { id: updated.assigneeId },
        select: { id: true, name: true, avatarUrl: true },
      });
    }

    return {
      ...updated,
      assignee,
    };
  }

  /**
   * Get workspace saved replies
   */
  static async getSavedReplies(ctx: UserContext) {
    return prisma.savedReply.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { title: 'asc' },
    });
  }

  /**
   * Ingest incoming message (Webhook or Poll)
   */
  static async ingestMessage(params: {
    channelId: string;
    externalId: string;
    authorName: string;
    authorHandle?: string;
    authorAvatar?: string;
    body: string;
    type?: 'COMMENT' | 'DM' | 'MENTION';
  }) {
    const channel = await prisma.channel.findUnique({
      where: { id: params.channelId },
    });
    if (!channel) throw new AppError('CHANNEL_NOT_FOUND', 'Channel not found', 404);

    const sentimentResult = analyzeSentiment(params.body);
    const now = new Date();

    const convo = await prisma.conversation.upsert({
      where: {
        channelId_externalId: {
          channelId: params.channelId,
          externalId: params.externalId,
        },
      },
      create: {
        workspaceId: channel.workspaceId,
        channelId: params.channelId,
        type: params.type || 'COMMENT',
        externalId: params.externalId,
        authorName: params.authorName,
        authorHandle: params.authorHandle,
        authorAvatar: params.authorAvatar,
        status: ConvoStatus.OPEN,
        sentiment: sentimentResult.sentiment as Sentiment,
        priority: sentimentResult.priority,
        unread: true,
        lastMessageAt: now,
      },
      update: {
        unread: true,
        status: ConvoStatus.OPEN, // Reopen closed threads on new incoming message
        lastMessageAt: now,
        sentiment: sentimentResult.sentiment as Sentiment,
        priority: sentimentResult.priority,
      },
    });

    await prisma.message.create({
      data: {
        conversationId: convo.id,
        direction: 'IN',
        body: params.body,
        sentAt: now,
      },
    });

    return convo;
  }
}
