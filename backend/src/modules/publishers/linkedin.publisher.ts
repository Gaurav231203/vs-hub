import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

export class LinkedInPublisher implements Publisher {
  async publish(params: PublishParams): Promise<PublishResult> {
    const { channel, caption, mediaUrls } = params;

    let accessToken = '';
    if (channel.accessTokenEnc) {
      try {
        accessToken = decrypt(channel.accessTokenEnc);
      } catch (err: any) {
        logger.warn({ channelId: channel.id, err: err.message }, 'Failed to decrypt access token, using raw fallback');
        accessToken = channel.accessTokenEnc;
      }
    }

    const isMock = !accessToken || accessToken.startsWith('mock_') || accessToken.startsWith('simulated_');

    if (isMock) {
      const shareUrn = `urn:li:share:li_${channel.externalId}_${Date.now()}`;
      logger.info(
        { channelId: channel.id, externalId: channel.externalId, shareUrn },
        '[LinkedInPublisher] Mock publish executed'
      );
      return {
        externalPostId: shareUrn,
        metrics: {
          impressions: Math.floor(Math.random() * 800) + 50,
          likes: Math.floor(Math.random() * 60) + 5,
          clicks: Math.floor(Math.random() * 30) + 2,
        },
      };
    }

    try {
      // Live LinkedIn Community Management / REST API
      const authorUrn = channel.externalId.startsWith('urn:li:')
        ? channel.externalId
        : `urn:li:organization:${channel.externalId}`;

      const postBody: any = {
        author: authorUrn,
        commentary: caption,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      };

      const res = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
          'LinkedIn-Version': '202401',
        },
        body: JSON.stringify(postBody),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`LinkedIn API error (${res.status}): ${errText}`);
      }

      const postId = res.headers.get('x-restli-id') || `urn:li:share:li_${Date.now()}`;
      return {
        externalPostId: postId,
        metrics: { impressions: 0, likes: 0, clicks: 0 },
      };
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message }, 'Failed to publish to LinkedIn');
      throw err;
    }
  }
}
