import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_BASE_URL = 'https://graph.facebook.com';

export class InstagramPublisher implements Publisher {
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
      const containerId = cachedContainerId || `ig_container_${channel.externalId}_${Date.now()}`;
      logger.info(
        { channelId: channel.id, externalId: channel.externalId, containerId, reused: !!cachedContainerId },
        '[InstagramPublisher] Mock publish executed'
      );
      return {
        externalPostId: `ig_${channel.externalId}_${Date.now()}`,
        metaContainerId: containerId,
        metrics: {
          impressions: Math.floor(Math.random() * 1200) + 80,
          reach: Math.floor(Math.random() * 950) + 60,
          likes: Math.floor(Math.random() * 80) + 10,
          comments: Math.floor(Math.random() * 10) + 1,
        },
      };
    }

    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error('Instagram requires at least one image or video attachment.');
    }

    const imageUrl = mediaUrls[0];
    let containerId = cachedContainerId;

    try {
      // Step 1: Create Container (if not already created and cached)
      if (!containerId) {
        const createContainerUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${channel.externalId}/media`;
        const containerRes = await fetch(createContainerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image_url: imageUrl,
            caption: caption,
            access_token: accessToken,
          }),
        });

        const containerData = (await containerRes.json()) as any;
        if (!containerRes.ok || containerData.error) {
          throw new Error(containerData.error?.message || `Instagram container creation failed (${containerRes.status})`);
        }

        containerId = containerData.id;
        logger.info({ channelId: channel.id, containerId }, '[InstagramPublisher] Media container created');
      } else {
        logger.info({ channelId: channel.id, containerId }, '[InstagramPublisher] Reusing existing media container');
      }

      // Step 2: Publish Container
      const publishUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${channel.externalId}/media_publish`;
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
        // Return containerId so caller can cache it for retry without re-creating container
        const err: any = new Error(publishData.error?.message || `Instagram container publish failed (${publishRes.status})`);
        err.containerId = containerId;
        throw err;
      }

      return {
        externalPostId: publishData.id,
        metaContainerId: containerId,
        rawResponse: publishData,
      };
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message, containerId }, '[InstagramPublisher] API error');
      throw err;
    }
  }
}
