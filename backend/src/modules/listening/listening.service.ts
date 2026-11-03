import { prisma } from '../../lib/prisma.js';
import { UserContext } from '@postdesk/shared';
import { AppError } from '../../middleware/error.js';
import { KeywordKind, Sentiment, Network, ConvoStatus } from '@prisma/client';

export class ListeningService {
  private static getBrandScope(ctx: UserContext, brandId?: string) {
    if (brandId) {
      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }
      return { brandId };
    }
    if (!ctx.allBrands) {
      return { brandId: { in: ctx.brandIds } };
    }
    return {};
  }

  /**
   * Listening KPI Summary: mentions this week, net sentiment, potential reach, share of voice (7d)
   */
  static async getSummary(ctx: UserContext, brandId?: string) {
    const brandScope = this.getBrandScope(ctx, brandId);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const keywords = await prisma.keyword.findMany({
      where: brandScope,
      select: { id: true, kind: true, brandId: true },
    });
    const keywordIds = keywords.map((k) => k.id);

    if (keywordIds.length === 0) {
      return {
        mentionsThisWeek: 0,
        netSentiment: 0,
        potentialReach: 0,
        shareOfVoice: 0,
      };
    }

    const mentions = await prisma.mention.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        keywordId: { in: keywordIds },
        postedAt: { gte: sevenDaysAgo },
        hidden: false,
      },
      select: {
        sentiment: true,
        reach: true,
        keywordId: true,
      },
    });

    const totalMentions = mentions.length;
    let positiveCount = 0;
    let negativeCount = 0;
    let potentialReach = 0;

    for (const m of mentions) {
      if (m.sentiment === Sentiment.POSITIVE) positiveCount++;
      else if (m.sentiment === Sentiment.NEGATIVE) negativeCount++;
      potentialReach += m.reach;
    }

    // Net sentiment = (positive - negative) / total * 100
    const netSentiment =
      totalMentions > 0 ? Math.round(((positiveCount - negativeCount) / totalMentions) * 100) : 0;

    // Share of voice = brandMentions / (brandMentions + competitorMentions) * 100
    const competitorKeywordIds = new Set(
      keywords.filter((k) => k.kind === KeywordKind.COMPETITOR).map((k) => k.id)
    );
    let brandMentionsCount = 0;
    let competitorMentionsCount = 0;

    for (const m of mentions) {
      if (competitorKeywordIds.has(m.keywordId)) {
        competitorMentionsCount++;
      } else {
        brandMentionsCount++;
      }
    }

    const totalVoice = brandMentionsCount + competitorMentionsCount;
    const shareOfVoice =
      totalVoice > 0 ? Math.round((brandMentionsCount / totalVoice) * 100) : 100;

    return {
      mentionsThisWeek: totalMentions,
      netSentiment,
      potentialReach,
      shareOfVoice,
    };
  }

  /**
   * Tracked keywords with 14-day mention counts & sentiment breakdown
   */
  static async getKeywords(ctx: UserContext, brandId?: string) {
    const brandScope = this.getBrandScope(ctx, brandId);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000);

    const keywords = await prisma.keyword.findMany({
      where: brandScope,
      include: {
        brand: {
          select: { id: true, name: true, color: true },
        },
        mentions: {
          where: { postedAt: { gte: fourteenDaysAgo }, hidden: false },
          select: { postedAt: true, sentiment: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return keywords.map((k) => {
      let pos = 0;
      let neu = 0;
      let neg = 0;
      const historyMap: Record<string, number> = {};

      for (const m of k.mentions) {
        if (m.sentiment === Sentiment.POSITIVE) pos++;
        else if (m.sentiment === Sentiment.NEGATIVE) neg++;
        else neu++;

        const dStr = m.postedAt.toISOString().slice(0, 10);
        historyMap[dStr] = (historyMap[dStr] || 0) + 1;
      }

      return {
        id: k.id,
        term: k.term,
        kind: k.kind,
        handle: k.handle,
        brand: k.brand,
        mentionCount: k.mentions.length,
        sentiment: { positive: pos, neutral: neu, negative: neg },
        sparkline: Object.values(historyMap).slice(-7),
      };
    });
  }

  /**
   * Add a tracked keyword
   */
  static async addKeyword(
    ctx: UserContext,
    data: { brandId: string; kind: KeywordKind; term: string; handle?: string }
  ) {
    if (!ctx.allBrands && !ctx.brandIds.includes(data.brandId)) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    return prisma.keyword.create({
      data: {
        brandId: data.brandId,
        kind: data.kind,
        term: data.term.trim(),
        handle: data.handle?.trim(),
      },
      include: {
        brand: true,
      },
    });
  }

  /**
   * Delete a tracked keyword
   */
  static async deleteKeyword(ctx: UserContext, id: string) {
    const keyword = await prisma.keyword.findUnique({
      where: { id },
      include: { brand: true },
    });
    if (!keyword) throw new AppError('KEYWORD_NOT_FOUND', 'Keyword not found', 404);

    if (!ctx.allBrands && !ctx.brandIds.includes(keyword.brandId)) {
      throw new AppError('KEYWORD_NOT_FOUND', 'Keyword not found', 404);
    }

    return prisma.keyword.delete({ where: { id } });
  }

  /**
   * List mentions stream with filters
   */
  static async getMentions(
    ctx: UserContext,
    query: {
      brandId?: string;
      keywordId?: string;
      sentiment?: Sentiment;
      network?: Network;
      savedOnly?: boolean;
      q?: string;
      page?: number;
      limit?: number;
    }
  ) {
    const brandScope = this.getBrandScope(ctx, query.brandId);
    const {
      keywordId,
      sentiment,
      network,
      savedOnly = false,
      q,
      page = 1,
      limit = 30,
    } = query;

    const where: any = {
      workspaceId: ctx.workspaceId,
      hidden: false,
      keyword: {
        ...brandScope,
        ...(keywordId ? { id: keywordId } : {}),
      },
      ...(sentiment ? { sentiment } : {}),
      ...(network ? { network } : {}),
      ...(savedOnly ? { saved: true } : {}),
    };

    if (q && q.trim()) {
      where.OR = [
        { authorName: { contains: q.trim() } },
        { authorHandle: { contains: q.trim() } },
        { text: { contains: q.trim() } },
      ];
    }

    const [total, mentions] = await Promise.all([
      prisma.mention.count({ where }),
      prisma.mention.findMany({
        where,
        orderBy: { postedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          keyword: {
            include: { brand: true },
          },
        },
      }),
    ]);

    return {
      items: mentions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update mention: toggle saved, hide, or reply in inbox
   */
  static async updateMention(
    ctx: UserContext,
    id: string,
    data: { saved?: boolean; hidden?: boolean }
  ) {
    const mention = await prisma.mention.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
      include: { keyword: true },
    });
    if (!mention) throw new AppError('MENTION_NOT_FOUND', 'Mention not found', 404);

    if (!ctx.allBrands && !ctx.brandIds.includes(mention.keyword.brandId)) {
      throw new AppError('MENTION_NOT_FOUND', 'Mention not found', 404);
    }

    return prisma.mention.update({
      where: { id },
      data,
    });
  }

  /**
   * Reply to a mention in Inbox (creates/links a MENTION conversation)
   */
  static async replyInInbox(ctx: UserContext, mentionId: string) {
    const mention = await prisma.mention.findFirst({
      where: { id: mentionId, workspaceId: ctx.workspaceId },
      include: {
        keyword: {
          include: { brand: { include: { channels: true } } },
        },
      },
    });
    if (!mention) throw new AppError('MENTION_NOT_FOUND', 'Mention not found', 404);

    const channel = mention.keyword.brand.channels.find((c) => c.network === mention.network) ||
      mention.keyword.brand.channels[0];

    if (!channel) {
      throw new AppError('NO_CHANNEL_FOR_NETWORK', 'No active channel for this network', 400);
    }

    const now = new Date();
    // Upsert a MENTION conversation
    const convo = await prisma.conversation.upsert({
      where: {
        channelId_externalId: {
          channelId: channel.id,
          externalId: mention.externalId,
        },
      },
      create: {
        workspaceId: ctx.workspaceId,
        channelId: channel.id,
        type: 'MENTION',
        externalId: mention.externalId,
        authorName: mention.authorName,
        authorHandle: mention.authorHandle,
        status: ConvoStatus.OPEN,
        sentiment: mention.sentiment,
        priority: mention.sentiment === 'NEGATIVE',
        unread: true,
        lastMessageAt: now,
      },
      update: {
        unread: true,
        status: ConvoStatus.OPEN,
      },
    });

    // Add mention text as first message if not exists
    const existingMsg = await prisma.message.findFirst({
      where: { conversationId: convo.id },
    });

    if (!existingMsg) {
      await prisma.message.create({
        data: {
          conversationId: convo.id,
          direction: 'IN',
          body: mention.text,
          sentAt: mention.postedAt,
        },
      });
    }

    return { conversationId: convo.id };
  }

  /**
   * Trending terms: tokenise mentions of last 7 days, remove stop-words, rank by count * lift
   */
  static async getTrendingTerms(ctx: UserContext, brandId?: string) {
    const brandScope = this.getBrandScope(ctx, brandId);
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000);

    const [currentMentions, prevMentions] = await Promise.all([
      prisma.mention.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          keyword: brandScope,
          postedAt: { gte: sevenDaysAgo },
          hidden: false,
        },
        select: { text: true },
      }),
      prisma.mention.findMany({
        where: {
          workspaceId: ctx.workspaceId,
          keyword: brandScope,
          postedAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
          hidden: false,
        },
        select: { text: true },
      }),
    ]);

    const stopWords = new Set([
      'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'your', 'will',
      'they', 'were', 'been', 'their', 'what', 'about', 'which', 'when', 'make', 'can',
      'like', 'time', 'just', 'know', 'take', 'person', 'into', 'year', 'good', 'some',
      'could', 'them', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its',
      'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work'
    ]);

    const countTokens = (mentionsList: typeof currentMentions) => {
      const counts: Record<string, number> = {};
      for (const m of mentionsList) {
        const tokens = (m.text.toLowerCase().match(/[a-z0-9#@]{3,}/g) || []).filter(
          (t) => !stopWords.has(t) && !/^\d+$/.test(t)
        );
        for (const token of tokens) {
          counts[token] = (counts[token] || 0) + 1;
        }
      }
      return counts;
    };

    const curCounts = countTokens(currentMentions);
    const prevCounts = countTokens(prevMentions);

    const terms = Object.entries(curCounts)
      .filter(([_, count]) => count >= 2)
      .map(([term, count]) => {
        const prev = prevCounts[term] || 0;
        const lift = Math.round((count / Math.max(1, prev)) * 10) / 10;
        const score = count * lift;
        return { term, count, lift, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return { terms };
  }
}
