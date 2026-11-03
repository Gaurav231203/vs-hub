import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { decrypt, encrypt } from '../lib/crypto.js';
import { env } from '../config/env.js';

const GRAPH_BASE_URL = 'https://graph.facebook.com';
const GRAPH_API_VERSION = 'v19.0';

export class TokenRefreshService {
  /**
   * Run daily token refresh & health audit:
   * 1. Inspects active channels
   * 2. Refreshes long-lived tokens nearing expiration (< 7 days)
   * 3. Tests token validity against Meta Graph API
   * 4. Marks channels as NEEDS_RECONNECT on failure
   */
  static async run(): Promise<{ checked: number; refreshed: number; needsReconnect: number }> {
    logger.info('[TokenRefreshService] Starting daily channel token audit');

    const channels = await prisma.channel.findMany({
      where: {
        network: { in: ['FACEBOOK', 'INSTAGRAM', 'THREADS'] },
        status: { in: ['CONNECTED', 'EXPIRING', 'NEEDS_RECONNECT'] },
      },
    });

    let checked = 0;
    let refreshed = 0;
    let needsReconnect = 0;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    for (const channel of channels) {
      checked++;

      if (!channel.accessTokenEnc) {
        await this.markNeedsReconnect(channel.id, 'No access token found for channel');
        needsReconnect++;
        continue;
      }

      let accessToken = '';
      try {
        accessToken = decrypt(channel.accessTokenEnc);
      } catch (err: any) {
        logger.warn({ channelId: channel.id }, 'Decryption error on token, assuming test token');
        accessToken = channel.accessTokenEnc;
      }

      // Check for mock tokens in dev/test
      if (accessToken.startsWith('mock_') || accessToken.startsWith('simulated_')) {
        // If simulated expired token in test, allow testing reconnect
        if (accessToken.includes('expired')) {
          await this.markNeedsReconnect(channel.id, 'Simulated token expiration');
          needsReconnect++;
        }
        continue;
      }

      try {
        // 1. Check if token is nearing expiration and needs refresh
        const isExpiringSoon = channel.tokenExpiresAt && channel.tokenExpiresAt < sevenDaysFromNow;

        if (isExpiringSoon && env.META_APP_ID && env.META_APP_SECRET) {
          // Exchange long-lived token
          const refreshUrl = new URL(`${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/oauth/access_token`);
          refreshUrl.searchParams.set('grant_type', 'fb_exchange_token');
          refreshUrl.searchParams.set('client_id', env.META_APP_ID);
          refreshUrl.searchParams.set('client_secret', env.META_APP_SECRET);
          refreshUrl.searchParams.set('fb_exchange_token', accessToken);

          const refreshRes = await fetch(refreshUrl.toString());
          const refreshData = (await refreshRes.json()) as any;

          if (refreshRes.ok && refreshData.access_token) {
            const newExpiry = new Date(Date.now() + (refreshData.expires_in || 5184000) * 1000);
            await prisma.channel.update({
              where: { id: channel.id },
              data: {
                accessTokenEnc: encrypt(refreshData.access_token),
                tokenExpiresAt: newExpiry,
                status: 'CONNECTED',
                lastError: null,
              },
            });
            refreshed++;
            logger.info({ channelId: channel.id, newExpiry }, '[TokenRefreshService] Token successfully refreshed');
            continue;
          }
        }

        // 2. Health check token validity via /me endpoint
        const healthUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/me?fields=id&access_token=${accessToken}`;
        const healthRes = await fetch(healthUrl);
        const healthData = (await healthRes.json()) as any;

        if (!healthRes.ok || healthData.error) {
          const errMsg = healthData.error?.message || 'Meta token validation failed';
          await this.markNeedsReconnect(channel.id, errMsg);
          needsReconnect++;
        } else {
          // Valid active token
          if (channel.status === 'NEEDS_RECONNECT') {
            await prisma.channel.update({
              where: { id: channel.id },
              data: { status: 'CONNECTED', lastError: null },
            });
          }
        }
      } catch (err: any) {
        logger.error({ channelId: channel.id, err: err.message }, '[TokenRefreshService] Check failed');
        await this.markNeedsReconnect(channel.id, err.message);
        needsReconnect++;
      }
    }

    logger.info({ checked, refreshed, needsReconnect }, '[TokenRefreshService] Completed daily token audit');
    return { checked, refreshed, needsReconnect };
  }

  private static async markNeedsReconnect(channelId: string, reason: string): Promise<void> {
    logger.warn({ channelId, reason }, '[TokenRefreshService] Channel marked as NEEDS_RECONNECT');
    await prisma.channel.update({
      where: { id: channelId },
      data: {
        status: 'NEEDS_RECONNECT',
        lastError: reason,
      },
    });

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: { brand: true },
    });

    if (channel) {
      await prisma.auditLog.create({
        data: {
          workspaceId: channel.workspaceId,
          action: 'channel.needs_reconnect',
          entity: 'Channel',
          entityId: channel.id,
          brandId: channel.brandId,
          meta: { reason },
        },
      });
    }
  }
}
