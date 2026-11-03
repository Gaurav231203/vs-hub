import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';
import { calculateEffectiveLength } from '@postdesk/shared';

export class XPublisher implements Publisher {
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

    // 280-character validation considering fixed URL length rules
    const effectiveLength = calculateEffectiveLength(caption, 'X');
    if (effectiveLength > 280) {
      throw new Error(`X (Twitter) post exceeds 280 character limit (${effectiveLength} characters).`);
    }

    const isMock = !accessToken || accessToken.startsWith('mock_') || accessToken.startsWith('simulated_');

    if (isMock) {
      const tweetId = `tweet_${channel.externalId}_${Date.now()}`;
      logger.info(
        { channelId: channel.id, externalId: channel.externalId, tweetId },
        '[XPublisher] Mock publish executed'
      );
      return {
        externalPostId: tweetId,
        metrics: {
          impressions: Math.floor(Math.random() * 900) + 50,
          likes: Math.floor(Math.random() * 70) + 5,
        },
      };
    }

    try {
      // Live X API v2: POST /2/tweets
      const tweetPayload: any = { text: caption };

      const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tweetPayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`X API error (${res.status}): ${errText}`);
      }

      const resJson: any = await res.json();
      return {
        externalPostId: `tweet_${resJson.data?.id || Date.now()}`,
        metrics: { impressions: 0, likes: 0 },
      };
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message }, 'Failed to publish to X');
      throw err;
    }
  }
}
