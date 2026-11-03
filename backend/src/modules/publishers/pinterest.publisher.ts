import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

export class PinterestPublisher implements Publisher {
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
      const pinId = `pin_${channel.externalId}_${Date.now()}`;
      logger.info(
        { channelId: channel.id, externalId: channel.externalId, pinId },
        '[PinterestPublisher] Mock publish executed'
      );
      return {
        externalPostId: pinId,
        metrics: {
          impressions: Math.floor(Math.random() * 1100) + 80,
          saves: Math.floor(Math.random() * 50) + 5,
        },
      };
    }

    try {
      // Live Pinterest API v5: POST /v5/pins
      const lines = caption.split('\n');
      const title = lines[0].slice(0, 100) || 'New Pin';

      const pinPayload: any = {
        title,
        description: caption,
        board_id: channel.externalId, // Board ID stored as externalId
        media_source: {
          source_type: 'image_url',
          url: mediaUrls && mediaUrls.length > 0 ? mediaUrls[0] : '',
        },
      };

      const res = await fetch('https://api.pinterest.com/v5/pins', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pinPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Pinterest API error (${res.status}): ${errText}`);
      }

      const resJson: any = await res.json();
      return {
        externalPostId: `pin_${resJson.id || Date.now()}`,
        metrics: { impressions: 0, saves: 0 },
      };
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message }, 'Failed to publish to Pinterest');
      throw err;
    }
  }
}
