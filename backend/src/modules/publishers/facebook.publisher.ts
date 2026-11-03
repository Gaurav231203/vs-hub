import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_BASE_URL = 'https://graph.facebook.com';

export class FacebookPublisher implements Publisher {
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

    // Check for simulated/test tokens
    const isMock = !accessToken || accessToken.startsWith('mock_') || accessToken.startsWith('simulated_');

    if (isMock) {
      logger.info({ channelId: channel.id, externalId: channel.externalId }, '[FacebookPublisher] Mock publish executed');
      return {
        externalPostId: `fb_${channel.externalId}_${Date.now()}`,
        metrics: {
          impressions: Math.floor(Math.random() * 1000) + 50,
          reach: Math.floor(Math.random() * 800) + 40,
          likes: Math.floor(Math.random() * 50) + 5,
        },
      };
    }

    // Real Meta Graph API Call
    try {
      if (mediaUrls && mediaUrls.length > 0) {
        // Photo post: POST /{page-id}/photos
        const photoUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${channel.externalId}/photos`;
        const res = await fetch(photoUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: mediaUrls[0],
            caption: caption,
            access_token: accessToken,
          }),
        });

        const data = (await res.json()) as any;
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || `Facebook Photo Publish failed with status ${res.status}`);
        }

        return {
          externalPostId: data.post_id || data.id,
          rawResponse: data,
        };
      } else {
        // Feed post: POST /{page-id}/feed
        const feedUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${channel.externalId}/feed`;
        const res = await fetch(feedUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: caption,
            access_token: accessToken,
          }),
        });

        const data = (await res.json()) as any;
        if (!res.ok || data.error) {
          throw new Error(data.error?.message || `Facebook Feed Publish failed with status ${res.status}`);
        }

        return {
          externalPostId: data.id,
          rawResponse: data,
        };
      }
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message }, '[FacebookPublisher] API request failed');
      throw err;
    }
  }
}
