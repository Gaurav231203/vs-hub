import { ChannelStatus, Network, PostStatus, TargetStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

export type FetchLike = typeof fetch;

export interface SyncedRemotePost {
  externalPostId: string;
  caption: string;
  publishedAt: Date;
  permalinkUrl?: string;
  mediaUrl?: string;
  likes: number;
  comments: number;
  shares: number;
}

export interface MetaSnapshotResult {
  ok: boolean;
  skipped?: boolean;
  tokenInvalid?: boolean;
  accountType?: 'page' | 'profile' | 'instagram_business';
  handle?: string;
  avatarUrl?: string;
  followers?: number;
  impressions?: number;
  reach?: number;
  engagements?: number;
  clicks?: number;
  postsPublished?: number;
  posts?: SyncedRemotePost[];
  note?: string;
  error?: string;
}

export interface SyncChannelOutcome {
  channelId: string;
  network: Network;
  synced: boolean;
  accountType?: 'page' | 'profile' | 'instagram_business';
  handle: string;
  followers: number;
  postsSynced: number;
  growthPct: number | null;
  lastSyncAt: Date;
  note?: string;
  error?: string;
}

export interface SyncServiceDeps {
  db?: any;
  fetchImpl?: FetchLike;
  decryptFn?: (cipher: string) => string;
  nowFn?: () => Date;
}

/**
 * Compute remaining days for an access token safely.
 */
export function computeDaysLeft(
  tokenExpiresAt: Date | string | null | undefined,
  totalDays = 60,
  now = new Date()
): number {
  if (!tokenExpiresAt) return totalDays;
  const expiry = tokenExpiresAt instanceof Date ? tokenExpiresAt : new Date(tokenExpiresAt);
  if (Number.isNaN(expiry.getTime())) return totalDays;
  const diffMs = expiry.getTime() - now.getTime();
  return Math.max(0, Math.min(totalDays, Math.ceil(diffMs / 86400000)));
}

/**
 * Compute authentic 30-day follower growth % from real MetricDaily snapshots.
 * Returns null when fewer than 2 distinct daily snapshots exist or baseline is 0
 * so the UI never fabricates a percentage like +4.8%.
 */
export function computeChannelGrowthPct(
  metricRows: Array<{ date: Date | string; followers: number }>
): number | null {
  if (!Array.isArray(metricRows) || metricRows.length < 2) return null;

  const normalized = metricRows
    .map((r) => ({
      day: (r.date instanceof Date ? r.date : new Date(r.date)).toISOString().slice(0, 10),
      followers: Number(r.followers ?? 0),
    }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const baseline = normalized.find((r) => r.followers > 0);
  if (!baseline) return null;

  const latest = normalized[normalized.length - 1];
  if (!latest || latest.day === baseline.day) return null;

  const pct = ((latest.followers - baseline.followers) / baseline.followers) * 100;
  return Math.round(pct * 10) / 10;
}

function safeDecryptToken(encrypted: string | null | undefined, decryptFn: (c: string) => string): string | null {
  if (!encrypted) return null;
  if (encrypted.startsWith('mock_') || encrypted.startsWith('manual_pass_')) return encrypted;
  if (!encrypted.startsWith('v1:')) return encrypted;
  try {
    return decryptFn(encrypted);
  } catch {
    return null;
  }
}

async function fetchJsonWithTimeout(url: string, fetchImpl: FetchLike, timeoutMs = 8000): Promise<any> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  return res.json();
}

/**
 * Fetch authentic profile, follower, post, and insight data from Meta Graph API v20.0.
 * Never fabricates follower counts or metrics when unavailable.
 */
export async function fetchMetaChannelSnapshot({
  network,
  externalId,
  accessToken,
  fetchImpl = fetch,
}: {
  network: Network;
  externalId: string;
  accessToken: string;
  fetchImpl?: FetchLike;
}): Promise<MetaSnapshotResult> {
  if (!accessToken || accessToken.startsWith('mock_') || accessToken.startsWith('manual_pass_')) {
    return {
      ok: false,
      skipped: true,
      note: 'No live OAuth token available for remote API sync',
    };
  }

  if (network === Network.FACEBOOK) {
    // 1. Attempt Facebook Page query first (includes followers_count & fan_count)
    const pageUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(externalId)}?fields=id,name,followers_count,fan_count,picture.type(large){url}&access_token=${encodeURIComponent(accessToken)}`;
    const pageData = await fetchJsonWithTimeout(pageUrl, fetchImpl);

    if (pageData?.error) {
      if (pageData.error.code === 190) {
        return {
          ok: false,
          tokenInvalid: true,
          error: pageData.error.message || 'Meta access token expired or revoked',
        };
      }

      // Personal Facebook Profile fallback (Graph API does not expose fan_count/followers_count on User nodes)
      const userUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(externalId)}?fields=id,name,picture.type(large){url}&access_token=${encodeURIComponent(accessToken)}`;
      let userData = await fetchJsonWithTimeout(userUrl, fetchImpl);

      if (userData?.error) {
        const meUrl = `https://graph.facebook.com/v20.0/me?fields=id,name,picture.type(large){url}&access_token=${encodeURIComponent(accessToken)}`;
        userData = await fetchJsonWithTimeout(meUrl, fetchImpl);
      }

      if (userData?.error) {
        return {
          ok: false,
          tokenInvalid: userData.error.code === 190,
          error: userData.error.message || 'Failed to fetch Facebook account from Meta',
        };
      }

      return {
        ok: true,
        accountType: 'profile',
        handle: userData.name || undefined,
        avatarUrl: userData.picture?.data?.url || undefined,
        followers: 0,
        impressions: 0,
        reach: 0,
        engagements: 0,
        clicks: 0,
        postsPublished: 0,
        posts: [],
        note: 'Personal Facebook profile synced via Meta API (follower/feed analytics require a Facebook Page)',
      };
    }

    const hasPageCounts =
      pageData?.followers_count !== undefined || pageData?.fan_count !== undefined;

    if (!hasPageCounts) {
      return {
        ok: true,
        accountType: 'profile',
        handle: pageData?.name || undefined,
        avatarUrl: pageData?.picture?.data?.url || undefined,
        followers: 0,
        impressions: 0,
        reach: 0,
        engagements: 0,
        clicks: 0,
        postsPublished: 0,
        posts: [],
        note: 'Personal Facebook profile synced via Meta API (follower/feed analytics require a Facebook Page)',
      };
    }

    const followers = Number(pageData.followers_count ?? pageData.fan_count ?? 0);
    const posts: SyncedRemotePost[] = [];
    let engagements = 0;
    let impressions = 0;

    // 2. Non-fatally fetch recent Page posts
    try {
      const postsUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(externalId)}/posts?fields=id,message,story,created_time,permalink_url,full_picture,likes.summary(true),comments.summary(true),shares&limit=10&access_token=${encodeURIComponent(accessToken)}`;
      const postsData = await fetchJsonWithTimeout(postsUrl, fetchImpl);
      if (Array.isArray(postsData?.data)) {
        for (const p of postsData.data) {
          const likes = Number(p.likes?.summary?.total_count ?? 0);
          const comments = Number(p.comments?.summary?.total_count ?? 0);
          const shares = Number(p.shares?.count ?? 0);
          engagements += likes + comments + shares;
          posts.push({
            externalPostId: String(p.id),
            caption: p.message || p.story || 'Facebook Page post',
            publishedAt: p.created_time ? new Date(p.created_time) : new Date(),
            permalinkUrl: p.permalink_url,
            mediaUrl: p.full_picture,
            likes,
            comments,
            shares,
          });
        }
      }
    } catch {
      // Non-fatal: Page permissions may omit pages_read_engagement
    }

    // 3. Non-fatally fetch daily Page insights
    try {
      const insightsUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(externalId)}/insights?metric=page_impressions,page_post_engagements&period=day&date_preset=today&access_token=${encodeURIComponent(accessToken)}`;
      const insightsData = await fetchJsonWithTimeout(insightsUrl, fetchImpl);
      if (Array.isArray(insightsData?.data)) {
        for (const metric of insightsData.data) {
          const val = Number(metric?.values?.[metric.values.length - 1]?.value ?? 0);
          if (metric.name === 'page_impressions' && val > 0) impressions = val;
          if (metric.name === 'page_post_engagements' && val > engagements) engagements = val;
        }
      }
    } catch {
      // Non-fatal
    }

    return {
      ok: true,
      accountType: 'page',
      handle: pageData.name || undefined,
      avatarUrl: pageData.picture?.data?.url || undefined,
      followers,
      impressions,
      reach: impressions,
      engagements,
      clicks: 0,
      postsPublished: posts.length,
      posts,
    };
  }

  if (network === Network.INSTAGRAM) {
    const igUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(externalId)}?fields=id,username,followers_count,media_count,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`;
    const igData = await fetchJsonWithTimeout(igUrl, fetchImpl);

    if (igData?.error) {
      return {
        ok: false,
        tokenInvalid: igData.error.code === 190,
        error: igData.error.message || 'Failed to fetch Instagram Business account from Meta',
      };
    }

    const followers = Number(igData.followers_count ?? 0);
    const cleanUsername = igData.username ? `@${String(igData.username).replace(/^@+/, '')}` : undefined;
    const posts: SyncedRemotePost[] = [];
    let engagements = 0;

    try {
      const mediaUrl = `https://graph.facebook.com/v20.0/${encodeURIComponent(externalId)}/media?fields=id,caption,media_url,thumbnail_url,timestamp,like_count,comments_count,permalink&limit=10&access_token=${encodeURIComponent(accessToken)}`;
      const mediaData = await fetchJsonWithTimeout(mediaUrl, fetchImpl);
      if (Array.isArray(mediaData?.data)) {
        for (const m of mediaData.data) {
          const likes = Number(m.like_count ?? 0);
          const comments = Number(m.comments_count ?? 0);
          engagements += likes + comments;
          posts.push({
            externalPostId: String(m.id),
            caption: m.caption || 'Instagram post',
            publishedAt: m.timestamp ? new Date(m.timestamp) : new Date(),
            permalinkUrl: m.permalink,
            mediaUrl: m.media_url || m.thumbnail_url,
            likes,
            comments,
            shares: 0,
          });
        }
      }
    } catch {
      // Non-fatal
    }

    return {
      ok: true,
      accountType: 'instagram_business',
      handle: cleanUsername,
      avatarUrl: igData.profile_picture_url || undefined,
      followers,
      impressions: 0,
      reach: 0,
      engagements,
      clicks: 0,
      postsPublished: posts.length,
      posts,
    };
  }

  return {
    ok: false,
    skipped: true,
    note: `Live API sync adapter not configured for ${network}`,
  };
}

export class ChannelSyncService {
  /**
   * Middle handler: decrypt stored OAuth token, fetch live Meta account/page data,
   * persist genuine followers/avatar/MetricDaily/posts in DB, and compute real growthPct.
   */
  static async syncChannel(channelId: string, deps: SyncServiceDeps = {}): Promise<SyncChannelOutcome> {
    const db = deps.db ?? prisma;
    const fetchImpl = deps.fetchImpl ?? fetch;
    const decryptFn = deps.decryptFn ?? decrypt;
    const now = deps.nowFn ? deps.nowFn() : new Date();

    const channel = await db.channel.findUnique({ where: { id: channelId } });
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const accessToken = safeDecryptToken(channel.accessTokenEnc, decryptFn);
    if (!accessToken) {
      await db.channel.update({
        where: { id: channelId },
        data: { lastSyncAt: now, lastError: 'Missing or unreadable encrypted access token' },
      });
      return {
        channelId: channel.id,
        network: channel.network,
        synced: false,
        handle: channel.handle,
        followers: channel.followers ?? 0,
        postsSynced: 0,
        growthPct: null,
        lastSyncAt: now,
        error: 'Missing or unreadable encrypted access token',
      };
    }

    let snapshot: MetaSnapshotResult;
    try {
      snapshot = await fetchMetaChannelSnapshot({
        network: channel.network,
        externalId: channel.externalId,
        accessToken,
        fetchImpl,
      });
    } catch (err: any) {
      await db.channel.update({
        where: { id: channelId },
        data: { lastSyncAt: now, lastError: err?.message || 'Remote sync request failed' },
      });
      return {
        channelId: channel.id,
        network: channel.network,
        synced: false,
        handle: channel.handle,
        followers: channel.followers ?? 0,
        postsSynced: 0,
        growthPct: null,
        lastSyncAt: now,
        error: err?.message || 'Remote sync request failed',
      };
    }

    if (!snapshot.ok) {
      if (snapshot.tokenInvalid) {
        await db.channel.update({
          where: { id: channelId },
          data: {
            status: ChannelStatus.DISCONNECTED,
            lastSyncAt: now,
            lastError: snapshot.error || 'OAuth token invalid or expired',
          },
        });
      } else {
        await db.channel.update({
          where: { id: channelId },
          data: {
            lastSyncAt: now,
            lastError: snapshot.skipped ? null : snapshot.error || 'Sync failed',
          },
        });
      }

      const growthPct = await this.getGrowthPctForChannel(channelId, db, now);
      return {
        channelId: channel.id,
        network: channel.network,
        synced: false,
        handle: channel.handle,
        followers: channel.followers ?? 0,
        postsSynced: 0,
        growthPct,
        lastSyncAt: now,
        note: snapshot.note,
        error: snapshot.error,
      };
    }

    // Resolve authentic follower count:
    // - Page / IG Business: real follower count from Meta
    // - Personal Profile: 0 (never preserve legacy fake 1250/4800!)
    const nextFollowers =
      snapshot.accountType === 'profile'
        ? 0
        : snapshot.followers ?? channel.followers ?? 0;

    const updatedChannel = await db.channel.update({
      where: { id: channelId },
      data: {
        ...(snapshot.handle ? { handle: snapshot.handle } : {}),
        ...(snapshot.avatarUrl ? { avatarUrl: snapshot.avatarUrl } : {}),
        followers: nextFollowers,
        status: ChannelStatus.CONNECTED,
        lastSyncAt: now,
        lastError: null,
      },
    });

    // Persist daily snapshot only for Page / IG Business accounts with real metrics
    if (snapshot.accountType === 'page' || snapshot.accountType === 'instagram_business') {
      const utcDay = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
      await db.metricDaily.upsert({
        where: {
          channelId_date: {
            channelId: channel.id,
            date: utcDay,
          },
        },
        create: {
          channelId: channel.id,
          date: utcDay,
          followers: nextFollowers,
          impressions: snapshot.impressions ?? 0,
          reach: snapshot.reach ?? 0,
          engagements: snapshot.engagements ?? 0,
          clicks: snapshot.clicks ?? 0,
          postsPublished: snapshot.postsPublished ?? 0,
        },
        update: {
          followers: nextFollowers,
          impressions: snapshot.impressions ?? 0,
          reach: snapshot.reach ?? 0,
          engagements: snapshot.engagements ?? 0,
          clicks: snapshot.clicks ?? 0,
          postsPublished: snapshot.postsPublished ?? 0,
        },
      });
    }

    // Persist synced live posts non-destructively (avoid duplicate targets on re-sync)
    let postsSynced = 0;
    if (snapshot.posts && snapshot.posts.length > 0 && db.post && db.postTarget) {
      let authorId = channel.connectedById as string | null;
      if (!authorId && db.membership) {
        const ownerMember = await db.membership.findFirst({
          where: { workspaceId: channel.workspaceId },
          orderBy: { createdAt: 'asc' },
          select: { userId: true },
        });
        authorId = ownerMember?.userId ?? null;
      }

      if (authorId) {
        for (const remotePost of snapshot.posts) {
          const existingTarget = await db.postTarget.findFirst({
            where: {
              channelId: channel.id,
              externalPostId: remotePost.externalPostId,
            },
            select: { id: true },
          });

          const metricsPayload = {
            impressions: 0,
            reach: 0,
            likes: remotePost.likes,
            comments: remotePost.comments,
            shares: remotePost.shares,
            permalinkUrl: remotePost.permalinkUrl || null,
          };

          if (existingTarget) {
            await db.postTarget.update({
              where: { id: existingTarget.id },
              data: { metrics: metricsPayload },
            });
          } else {
            await db.post.create({
              data: {
                workspaceId: channel.workspaceId,
                brandId: channel.brandId,
                authorId,
                caption: remotePost.caption,
                status: PostStatus.PUBLISHED,
                publishedAt: remotePost.publishedAt,
                scheduledAt: remotePost.publishedAt,
                targets: {
                  create: {
                    channelId: channel.id,
                    status: TargetStatus.PUBLISHED,
                    externalPostId: remotePost.externalPostId,
                    publishedAt: remotePost.publishedAt,
                    metrics: metricsPayload,
                  },
                },
              },
            });
            postsSynced++;
          }
        }
      }
    }

    const growthPct = await this.getGrowthPctForChannel(channel.id, db, now);

    logger.info(
      {
        channelId: channel.id,
        network: channel.network,
        accountType: snapshot.accountType,
        followers: updatedChannel.followers,
        postsSynced,
      },
      'Channel synced via live social middle handler'
    );

    return {
      channelId: channel.id,
      network: channel.network,
      synced: true,
      accountType: snapshot.accountType,
      handle: updatedChannel.handle,
      followers: updatedChannel.followers,
      postsSynced,
      growthPct,
      lastSyncAt: now,
      note: snapshot.note,
    };
  }

  static async getGrowthPctForChannel(channelId: string, db = prisma, now = new Date()): Promise<number | null> {
    if (!db.metricDaily) return null;
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const rows = await db.metricDaily.findMany({
      where: {
        channelId,
        date: { gte: thirtyDaysAgo },
      },
      orderBy: { date: 'asc' },
      select: { date: true, followers: true },
    });
    return computeChannelGrowthPct(rows);
  }
}
