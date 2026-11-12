import { prisma } from '../../lib/prisma.js';
import { UserContext } from '@postdesk/shared';
import { AppError } from '../../middleware/error.js';
import { Network } from '@prisma/client';
import { computeChannelGrowthPct } from '../channels/sync.service.js';

export interface AnalyticsQuery {
  range?: '7D' | '30D' | '90D';
  brandId?: string;
  network?: Network;
}

export class AnalyticsService {
  private static parseRange(rangeStr?: string): { days: number; start: Date; end: Date; prevStart: Date; prevEnd: Date } {
    let days = 30;
    if (rangeStr === '7D') days = 7;
    else if (rangeStr === '90D') days = 90;

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const prevEnd = new Date(start);
    prevEnd.setMilliseconds(prevEnd.getMilliseconds() - 1);

    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - days);
    prevStart.setHours(0, 0, 0, 0);

    return { days, start, end, prevStart, prevEnd };
  }

  private static getChannelFilter(ctx: UserContext, brandId?: string, network?: Network) {
    let brandScope: any = {};
    if (brandId) {
      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }
      brandScope = { brandId };
    } else if (!ctx.allBrands) {
      brandScope = { brandId: { in: ctx.brandIds } };
    }

    return {
      workspaceId: ctx.workspaceId,
      ...brandScope,
      ...(network ? { network } : {}),
    };
  }

  /**
   * Summary KPI metrics with period-over-period comparison
   */
  static async getSummary(ctx: UserContext, query: AnalyticsQuery) {
    const { start, end, prevStart, prevEnd } = this.parseRange(query.range);
    const channelWhere = this.getChannelFilter(ctx, query.brandId, query.network);

    const channels = await prisma.channel.findMany({
      where: channelWhere,
      select: { id: true, followers: true },
    });
    const channelIds = channels.map((c) => c.id);

    if (channelIds.length === 0) {
      return {
        audience: 0,
        followerGrowthPct: 0,
        impressions: 0,
        impressionsGrowthPct: 0,
        engagementRate: 0,
        engagementRateDiff: 0,
        reach: 0,
        clicks: 0,
        postsPublished: 0,
      };
    }

    // Current period metrics
    const [currentMetrics, prevMetrics] = await Promise.all([
      prisma.metricDaily.findMany({
        where: {
          channelId: { in: channelIds },
          date: { gte: start, lte: end },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.metricDaily.findMany({
        where: {
          channelId: { in: channelIds },
          date: { gte: prevStart, lte: prevEnd },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Current totals
    const totalAudience = channels.reduce((sum, c) => sum + c.followers, 0);
    const curImpressions = currentMetrics.reduce((sum, m) => sum + m.impressions, 0);
    const curEngagements = currentMetrics.reduce((sum, m) => sum + m.engagements, 0);
    const curReach = currentMetrics.reduce((sum, m) => sum + m.reach, 0);
    const curClicks = currentMetrics.reduce((sum, m) => sum + m.clicks, 0);
    const curMetricPosts = currentMetrics.reduce((sum, m) => sum + m.postsPublished, 0);
    const curEngRate = curImpressions > 0 ? (curEngagements / curImpressions) * 100 : 0;

    const syncedPostsCount = await prisma.postTarget.count({
      where: {
        channelId: { in: channelIds },
        status: 'PUBLISHED',
        publishedAt: { gte: start, lte: end },
      },
    });
    const curPosts = Math.max(curMetricPosts, syncedPostsCount);

    // Previous totals
    const prevImpressions = prevMetrics.reduce((sum, m) => sum + m.impressions, 0);
    const prevEngagements = prevMetrics.reduce((sum, m) => sum + m.engagements, 0);
    const prevEngRate = prevImpressions > 0 ? (prevEngagements / prevImpressions) * 100 : 0;

    // Follower growth %: (end - start) / start * 100
    const startFollowers = currentMetrics[0]?.followers || totalAudience;
    const endFollowers = currentMetrics[currentMetrics.length - 1]?.followers || totalAudience;
    const newFollowers = Math.max(0, endFollowers - startFollowers);
    const followerGrowthPct =
      currentMetrics.length >= 2 && startFollowers > 0
        ? Math.round(((endFollowers - startFollowers) / startFollowers) * 1000) / 10
        : 0;

    const impressionsGrowthPct =
      prevImpressions > 0
        ? Math.round(((curImpressions - prevImpressions) / prevImpressions) * 1000) / 10
        : 0;

    return {
      accountCount: channels.length,
      audience: totalAudience,
      newFollowers,
      followerGrowthPct,
      impressions: curImpressions,
      impressionsGrowthPct,
      engagementRate: Math.round(curEngRate * 100) / 100,
      engagementRateDiff: Math.round((curEngRate - prevEngRate) * 100) / 100,
      reach: curReach,
      clicks: curClicks,
      postsPublished: curPosts,
    };
  }

  /**
   * Growth timeline (daily breakdown) with previous window comparison
   */
  static async getGrowthTimeline(ctx: UserContext, query: AnalyticsQuery) {
    const { start, end, prevStart, prevEnd } = this.parseRange(query.range);
    const channelWhere = this.getChannelFilter(ctx, query.brandId, query.network);

    const channels = await prisma.channel.findMany({
      where: channelWhere,
      select: { id: true },
    });
    const channelIds = channels.map((c) => c.id);

    if (channelIds.length === 0) {
      return { current: [], previous: [] };
    }

    const [currentRows, prevRows] = await Promise.all([
      prisma.metricDaily.findMany({
        where: {
          channelId: { in: channelIds },
          date: { gte: start, lte: end },
        },
        orderBy: { date: 'asc' },
      }),
      prisma.metricDaily.findMany({
        where: {
          channelId: { in: channelIds },
          date: { gte: prevStart, lte: prevEnd },
        },
        orderBy: { date: 'asc' },
      }),
    ]);

    // Aggregate by date
    const aggregateByDate = (rows: typeof currentRows) => {
      const map = new Map<string, any>();
      for (const row of rows) {
        const dStr = row.date.toISOString().slice(0, 10);
        if (!map.has(dStr)) {
          map.set(dStr, {
            date: dStr,
            followers: 0,
            impressions: 0,
            reach: 0,
            engagements: 0,
            clicks: 0,
            posts: 0,
          });
        }
        const item = map.get(dStr);
        item.followers += row.followers;
        item.impressions += row.impressions;
        item.reach += row.reach;
        item.engagements += row.engagements;
        item.clicks += row.clicks;
        item.posts += row.postsPublished;
      }
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    };

    return {
      current: aggregateByDate(currentRows),
      previous: aggregateByDate(prevRows),
    };
  }

  /**
   * Breakdown by social network
   */
  static async getByNetwork(ctx: UserContext, query: AnalyticsQuery) {
    const { start, end } = this.parseRange(query.range);
    const channelWhere = this.getChannelFilter(ctx, query.brandId);

    const channels = await prisma.channel.findMany({
      where: channelWhere,
      include: {
        brand: { select: { id: true, name: true } },
        metrics: {
          where: { date: { gte: start, lte: end } },
          orderBy: { date: 'asc' },
        },
        targets: {
          where: {
            status: 'PUBLISHED',
            publishedAt: { gte: start, lte: end },
          },
          select: { id: true },
        },
      },
    });

    // Group channels by network
    const netMap = new Map<Network, any>();
    for (const ch of channels) {
      if (!netMap.has(ch.network)) {
        netMap.set(ch.network, {
          network: ch.network,
          channelCount: 0,
          followers: 0,
          impressions: 0,
          engagements: 0,
          clicks: 0,
          posts: 0,
          metricRows: [] as Array<{ date: Date; followers: number }>,
          history: [] as number[],
          accounts: [] as any[],
        });
      }
      const item = netMap.get(ch.network);
      item.channelCount += 1;
      item.followers += ch.followers;

      let chImpressions = 0;
      let chEngagements = 0;
      let chMetricPosts = 0;
      const chHistory: number[] = [];

      for (const m of ch.metrics) {
        item.impressions += m.impressions;
        item.engagements += m.engagements;
        item.clicks += m.clicks;
        chImpressions += m.impressions;
        chEngagements += m.engagements;
        chMetricPosts += m.postsPublished;
        item.history.push(m.impressions);
        chHistory.push(m.impressions);
        item.metricRows.push({ date: m.date, followers: m.followers });
      }

      const chPosts = Math.max(chMetricPosts, ch.targets.length);
      item.posts += chPosts;
      const chGrowth = computeChannelGrowthPct(ch.metrics.map((m) => ({ date: m.date, followers: m.followers }))) ?? 0;

      item.accounts.push({
        id: ch.id,
        handle: ch.handle,
        brandName: ch.brand?.name || 'Brand',
        status: ch.status,
        followers: ch.followers,
        growth: chGrowth,
        impressions: chImpressions,
        engagementRate: chImpressions > 0 ? Math.round((chEngagements / chImpressions) * 10000) / 100 : 0,
        posts: chPosts,
        sparkline: chHistory.slice(-14),
      });
    }

    return Array.from(netMap.values()).map((item) => ({
      network: item.network,
      channelCount: item.channelCount,
      followers: item.followers,
      growthPct: computeChannelGrowthPct(item.metricRows) ?? 0,
      impressions: item.impressions,
      engagementRate:
        item.impressions > 0
          ? Math.round((item.engagements / item.impressions) * 10000) / 100
          : 0,
      clicks: item.clicks,
      posts: item.posts,
      sparkline: item.history.slice(-14),
      accounts: item.accounts,
    }));
  }

  /**
   * Content mix (by format: photo, video, carousel, text)
   */
  static async getContentMix(ctx: UserContext, query: AnalyticsQuery) {
    const { start, end } = this.parseRange(query.range);

    let brandScope: any = {};
    if (query.brandId) {
      if (!ctx.allBrands && !ctx.brandIds.includes(query.brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }
      brandScope = { brandId: query.brandId };
    } else if (!ctx.allBrands) {
      brandScope = { brandId: { in: ctx.brandIds } };
    }

    const posts = await prisma.post.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...brandScope,
        status: 'PUBLISHED',
        publishedAt: { gte: start, lte: end },
      },
      include: {
        media: {
          include: { asset: true },
        },
      },
    });

    let photoCount = 0;
    let videoCount = 0;
    let carouselCount = 0;
    let textCount = 0;

    for (const post of posts) {
      const mediaCount = post.media.length;
      if (mediaCount === 0) {
        textCount++;
      } else if (mediaCount > 1) {
        carouselCount++;
      } else {
        const kind = post.media[0]?.asset?.kind || 'IMAGE';
        if (kind === 'VIDEO') videoCount++;
        else photoCount++;
      }
    }

    const total = posts.length || 1;
    return {
      total: posts.length,
      formats: [
        { kind: 'photo', label: 'Photo', count: photoCount, pct: Math.round((photoCount / total) * 100) },
        { kind: 'video', label: 'Video', count: videoCount, pct: Math.round((videoCount / total) * 100) },
        { kind: 'carousel', label: 'Carousel', count: carouselCount, pct: Math.round((carouselCount / total) * 100) },
        { kind: 'text', label: 'Text / Status', count: textCount, pct: Math.round((textCount / total) * 100) },
      ],
    };
  }

  /**
   * 7x24 Heatmap matrix
   */
  static async getHeatmap(ctx: UserContext, query: AnalyticsQuery) {
    const { start, end } = this.parseRange(query.range);
    const channelWhere = this.getChannelFilter(ctx, query.brandId, query.network);

    const channels = await prisma.channel.findMany({
      where: channelWhere,
      select: { id: true },
    });
    const channelIds = channels.map((c) => c.id);

    // Initial 7x24 grid: 0 = Sunday, 1 = Monday ... 6 = Saturday
    const grid: { sumEng: number; count: number }[][] = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ sumEng: 0, count: 0 }))
    );

    if (channelIds.length > 0) {
      const publishedTargets = await prisma.postTarget.findMany({
        where: {
          channelId: { in: channelIds },
          status: 'PUBLISHED',
          publishedAt: { gte: start, lte: end },
        },
        select: {
          publishedAt: true,
          metrics: true,
        },
      });

      for (const t of publishedTargets) {
        if (!t.publishedAt) continue;
        const d = new Date(t.publishedAt);
        const day = d.getUTCDay();
        const hour = d.getUTCHours();
        const m = (t.metrics as any) || {};
        const eng = (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);

        grid[day][hour].sumEng += eng;
        grid[day][hour].count += 1;
      }
    }

    // Smoothed score: (sum_eng + k * globalMean) / (n + k) with k = 3
    let totalEng = 0;
    let totalPosts = 0;
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        totalEng += grid[day][hour].sumEng;
        totalPosts += grid[day][hour].count;
      }
    }
    const globalMean = totalPosts > 0 ? totalEng / totalPosts : 5;
    const k = 3;

    let maxScore = 0;
    const scoredGrid: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const { sumEng, count } = grid[day][hour];
        if (count === 0) {
          scoredGrid[day][hour] = 0;
        } else {
          const score = (sumEng + k * globalMean) / (count + k);
          scoredGrid[day][hour] = score;
          if (score > maxScore) maxScore = score;
        }
      }
    }

    // Normalise to 0-100
    const normalized: number[][] = scoredGrid.map((row) =>
      row.map((score) => (maxScore > 0 ? Math.round((score / maxScore) * 100) : 0))
    );

    return {
      matrix: normalized,
      hasEnoughData: totalPosts >= 20,
    };
  }

  /**
   * Top posts with "x usual reach" badge
   */
  static async getTopPosts(ctx: UserContext, query: AnalyticsQuery & { sort?: 'reach' | 'engagement' | 'clicks'; limit?: number }) {
    const { start, end } = this.parseRange(query.range);
    const { sort = 'reach', limit = 10 } = query;

    let brandScope: any = {};
    if (query.brandId) {
      if (!ctx.allBrands && !ctx.brandIds.includes(query.brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }
      brandScope = { brandId: query.brandId };
    } else if (!ctx.allBrands) {
      brandScope = { brandId: { in: ctx.brandIds } };
    }

    const posts = await prisma.post.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...brandScope,
        status: 'PUBLISHED',
        publishedAt: { gte: start, lte: end },
      },
      include: {
        brand: {
          select: { id: true, name: true, color: true },
        },
        targets: {
          include: {
            channel: { select: { network: true, handle: true } },
          },
        },
        media: {
          include: { asset: true },
          orderBy: { position: 'asc' },
        },
      },
      take: 50,
    });

    // Compute aggregated metrics per post
    const enrichedRaw = posts.map((post) => {
      let totalReach = 0;
      let totalImpressions = 0;
      let totalEngagements = 0;
      let totalClicks = 0;
      let fallbackMediaUrl: string | null = null;
      let permalinkUrl: string | null = null;

      for (const t of post.targets) {
        const m = (t.metrics as any) || {};
        totalReach += m.reach || 0;
        totalImpressions += m.impressions || 0;
        totalEngagements += (m.likes || 0) + (m.comments || 0) + (m.shares || 0) + (m.saves || 0);
        totalClicks += m.clicks || 0;
        if (!fallbackMediaUrl && m.mediaUrl) fallbackMediaUrl = m.mediaUrl;
        if (!permalinkUrl && m.permalinkUrl) permalinkUrl = m.permalinkUrl;
      }

      const engRate = totalImpressions > 0 ? (totalEngagements / totalImpressions) * 100 : 0;

      return {
        id: post.id,
        caption: post.caption,
        publishedAt: post.publishedAt,
        brand: post.brand,
        targets: post.targets.map((t) => ({
          network: t.channel.network,
          handle: t.channel.handle,
        })),
        media:
          post.media.length > 0
            ? post.media.map((m) => ({ url: m.asset.url, kind: m.asset.kind }))
            : fallbackMediaUrl
              ? [{ url: fallbackMediaUrl, kind: 'IMAGE' }]
              : [],
        permalinkUrl,
        reach: totalReach,
        impressions: totalImpressions,
        engagements: totalEngagements,
        clicks: totalClicks,
        engagementRate: Math.round(engRate * 100) / 100,
      };
    });

    const avgReach =
      enrichedRaw.length > 0
        ? enrichedRaw.reduce((sum, p) => sum + p.reach, 0) / enrichedRaw.length
        : 0;

    const enriched = enrichedRaw.map((p) => ({
      ...p,
      xUsualReach: avgReach > 0 ? Math.round((p.reach / avgReach) * 10) / 10 : 1,
    }));

    // Sort
    enriched.sort((a, b) => {
      if (sort === 'engagement') return b.engagementRate - a.engagementRate || b.engagements - a.engagements;
      if (sort === 'clicks') return b.clicks - a.clicks || b.engagements - a.engagements;
      return b.reach - a.reach || b.engagements - a.engagements;
    });

    return enriched.slice(0, limit);
  }

  /**
   * Real brand-by-brand comparison from database channels & metrics
   */
  static async getBrandComparison(ctx: UserContext, query: AnalyticsQuery) {
    const { start, end } = this.parseRange(query.range);

    const brands = await prisma.brand.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        ...(!ctx.allBrands ? { id: { in: ctx.brandIds } } : {}),
      },
      include: {
        channels: {
          include: {
            metrics: {
              where: { date: { gte: start, lte: end } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return brands.map((b) => {
      const followers = b.channels.reduce((sum, ch) => sum + ch.followers, 0);
      let impressions = 0;
      let engagements = 0;
      for (const ch of b.channels) {
        for (const m of ch.metrics) {
          impressions += m.impressions;
          engagements += m.engagements;
        }
      }
      const engagementRate = impressions > 0 ? Math.round((engagements / impressions) * 10000) / 100 : 0;
      return {
        id: b.id,
        name: b.name,
        color: b.color,
        accountsCount: b.channels.length,
        followers,
        impressions,
        engagements,
        engagementRate,
      };
    });
  }

  /**
   * CSV Export: UTF-8 with BOM, formula-injection safe
   */
  static async exportCsv(ctx: UserContext, query: AnalyticsQuery): Promise<string> {
    const { start, end } = this.parseRange(query.range);
    const channelWhere = this.getChannelFilter(ctx, query.brandId, query.network);

    const channels = await prisma.channel.findMany({
      where: channelWhere,
      include: {
        brand: true,
        metrics: {
          where: { date: { gte: start, lte: end } },
          orderBy: { date: 'asc' },
        },
      },
    });

    // Formula injection protection: prefix =, +, -, @ with '
    const sanitize = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (/^[=+\-@]/.test(str)) {
        return `'${str}`;
      }
      return str.includes(',') ? `"${str.replace(/"/g, '""')}"` : str;
    };

    const header = ['date', 'brand', 'network', 'followers', 'impressions', 'reach', 'engagements', 'clicks', 'posts'];
    const rows: string[] = [header.join(',')];

    for (const ch of channels) {
      for (const m of ch.metrics) {
        const row = [
          m.date.toISOString().slice(0, 10),
          sanitize(ch.brand.name),
          ch.network,
          m.followers,
          m.impressions,
          m.reach,
          m.engagements,
          m.clicks,
          m.postsPublished,
        ];
        rows.push(row.join(','));
      }
    }

    // UTF-8 BOM: \uFEFF
    return '\uFEFF' + rows.join('\r\n');
  }
}
