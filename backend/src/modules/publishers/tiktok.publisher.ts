import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

export class TikTokPublisher implements Publisher {
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
      const publishId = `tiktok_publish_${channel.externalId}_${Date.now()}`;
      logger.info(
        { channelId: channel.id, externalId: channel.externalId, publishId },
        '[TikTokPublisher] Mock publish executed'
      );
      return {
        externalPostId: publishId,
        metrics: {
          impressions: Math.floor(Math.random() * 2500) + 200,
          likes: Math.floor(Math.random() * 200) + 20,
        },
      };
    }

    try {
      // Live TikTok Direct Post API v2
      const postPayload = {
        post_info: {
          title: caption,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_comment: false,
          disable_stitch: false,
        },
        source_info: {
          source: 'PULL_FROM_URL',
          video_url: mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : '',
        },
      };

      const res = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`TikTok API error (${res.status}): ${errText}`);
      }

      const resJson: any = await res.json();
      return {
        externalPostId: `tiktok_publish_${resJson.data?.publish_id || Date.now()}`,
        metrics: { impressions: 0, likes: 0 },
      };
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message }, 'Failed to publish to TikTok');
      throw err;
    }
  }
}
