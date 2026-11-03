import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

const THREADS_API_VERSION = 'v1.0';
const THREADS_BASE_URL = 'https://graph.threads.net';

export class ThreadsPublisher implements Publisher {
  async publish(params: PublishParams): Promise<PublishResult> {
    const { channel, caption, mediaUrls, cachedContainerId } = params;

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
      const containerId = cachedContainerId || `threads_container_${channel.externalId}_${Date.now()}`;
      logger.info(
        { channelId: channel.id, externalId: channel.externalId, containerId },
        '[ThreadsPublisher] Mock publish executed'
      );
      return {
        externalPostId: `th_${channel.externalId}_${Date.now()}`,
        metaContainerId: containerId,
        metrics: {
          impressions: Math.floor(Math.random() * 600) + 30,
          likes: Math.floor(Math.random() * 40) + 3,
        },
      };
    }

    let containerId = cachedContainerId;

    try {
      // Step 1: Create Threads media container
      if (!containerId) {
        const createUrl = `${THREADS_BASE_URL}/${THREADS_API_VERSION}/${channel.externalId}/threads`;
        const bodyPayload: any = {
          media_type: mediaUrls && mediaUrls.length > 0 ? 'IMAGE' : 'TEXT',
          text: caption,
          access_token: accessToken,
        };
        if (mediaUrls && mediaUrls.length > 0) {
          bodyPayload.image_url = mediaUrls[0];
        }

        const containerRes = await fetch(createUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        const containerData = (await containerRes.json()) as any;
        if (!containerRes.ok || containerData.error) {
          throw new Error(containerData.error?.message || `Threads container creation failed (${containerRes.status})`);
        }

        containerId = containerData.id;
      }

      // Step 2: Publish Threads container
      const publishUrl = `${THREADS_BASE_URL}/${THREADS_API_VERSION}/${channel.externalId}/threads_publish`;
      const publishRes = await fetch(publishUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerId,
          access_token: accessToken,
        }),
      });

      const publishData = (await publishRes.json()) as any;
      if (!publishRes.ok || publishData.error) {
        const err: any = new Error(publishData.error?.message || `Threads publish failed (${publishRes.status})`);
        err.containerId = containerId;
        throw err;
      }

      return {
        externalPostId: publishData.id,
        metaContainerId: containerId,
        rawResponse: publishData,
      };
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message }, '[ThreadsPublisher] API error');
      throw err;
    }
  }
}
