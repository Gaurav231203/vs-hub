import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

const GRAPH_API_VERSION = 'v20.0';
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

    // Reject simulated/mock/manual channels instead of faking a live publish
    const isMock = !accessToken || accessToken.startsWith('mock_') || accessToken.startsWith('simulated_') || accessToken.startsWith('manual_') || channel.externalId.startsWith('mock_') || channel.externalId.startsWith('manual_');

    if (isMock) {
      throw new Error('Facebook channel requires an official Meta OAuth connection. Manual or mock channels cannot publish live.');
    }

    // Real Meta Graph API Call
    try {
      if (mediaUrls && mediaUrls.length > 0) {
        let publicMediaUrl = mediaUrls[0];
        if (publicMediaUrl.startsWith('/')) {
          const apiBase = process.env.API_URL || process.env.RENDER_EXTERNAL_URL || 'https://vs-hub-1.onrender.com';
          publicMediaUrl = `${apiBase.replace(/\/$/, '')}${publicMediaUrl}`;
        }
        if (publicMediaUrl.startsWith('blob:')) {
          throw new Error('Image is a local browser blob and was not uploaded to server. Please select a valid uploaded image.');
        }

        const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(publicMediaUrl);
        if (isVideo) {
          const videoUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${channel.externalId}/videos`;
          const res = await fetch(videoUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_url: publicMediaUrl,
              description: caption,
              access_token: accessToken,
            }),
          });
          const data = (await res.json()) as any;
          if (!res.ok || data.error) {
            throw new Error(data.error?.message || `Facebook Video Publish failed with status ${res.status}`);
          }
          return {
            externalPostId: data.id,
            metrics: { impressions: 0, reach: 0, likes: 0, comments: 0 },
            rawResponse: data,
          };
        }

        // Photo post: POST /{page-id}/photos
        const photoUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${channel.externalId}/photos`;
        const res = await fetch(photoUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: publicMediaUrl,
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
          metrics: { impressions: 0, reach: 0, likes: 0, comments: 0 },
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
          const msg = data.error?.message || `Facebook Feed Publish failed with status ${res.status}`;
          if (data.error?.code === 200 || msg.includes('publish_to_groups')) {
            throw new Error('Personal Facebook profiles cannot receive posts via Meta API. Please publish to your connected Facebook Page instead.');
          }
          throw new Error(msg);
        }

        return {
          externalPostId: data.id,
          metrics: { impressions: 0, reach: 0, likes: 0, comments: 0 },
          rawResponse: data,
        };
      }
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message }, '[FacebookPublisher] API request failed');
      throw err;
    }
  }
}
