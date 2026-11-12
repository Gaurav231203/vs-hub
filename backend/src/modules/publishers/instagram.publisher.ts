import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

const GRAPH_API_VERSION = 'v20.0';
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

    const isMock = !accessToken || accessToken.startsWith('mock_') || accessToken.startsWith('simulated_') || accessToken.startsWith('manual_') || channel.externalId.startsWith('mock_') || channel.externalId.startsWith('manual_');

    if (isMock) {
      throw new Error('Instagram channel requires an official Meta OAuth connection. Manual or mock channels cannot publish live.');
    }

    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error('Instagram requires at least one image or video attachment.');
    }

    let imageUrl = mediaUrls[0];
    if (imageUrl.startsWith('/')) {
      const apiBase = process.env.API_URL || process.env.RENDER_EXTERNAL_URL || 'https://vs-hub-1.onrender.com';
      imageUrl = `${apiBase.replace(/\/$/, '')}${imageUrl}`;
    }
    if (imageUrl.startsWith('blob:')) {
      throw new Error('Selected media is a local browser preview and did not upload to server storage.');
    }

    const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(imageUrl);
    let containerId = cachedContainerId;

    try {
      // Step 1: Create Container (if not already created and cached)
      if (!containerId) {
        const createContainerUrl = `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${channel.externalId}/media`;
        const containerBody = isVideo
          ? { media_type: 'REELS', video_url: imageUrl, caption, access_token: accessToken }
          : { image_url: imageUrl, caption, access_token: accessToken };
        const containerRes = await fetch(createContainerUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(containerBody),
        });

        const containerData = (await containerRes.json()) as any;
        if (!containerRes.ok || containerData.error) {
          const detail = containerData.error?.error_user_msg
            ? `${containerData.error.message} — ${containerData.error.error_user_msg}`
            : containerData.error?.message;
          throw new Error(detail || `Instagram container creation failed (${containerRes.status})`);
        }

        containerId = containerData.id;
        logger.info({ channelId: channel.id, containerId }, '[InstagramPublisher] Media container created');
      } else {
        logger.info({ channelId: channel.id, containerId }, '[InstagramPublisher] Reusing existing media container');
      }

      // Step 1.5: Poll Instagram container until Meta finishes processing media
      for (let attempt = 0; attempt < 8; attempt++) {
        const statusRes = await fetch(
          `${GRAPH_BASE_URL}/${GRAPH_API_VERSION}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(accessToken)}`
        );
        const statusData = (await statusRes.json()) as any;
        if (statusData?.status_code === 'FINISHED' || statusData?.status_code === 'PUBLISHED') {
          break;
        }
        if (statusData?.status_code === 'ERROR' || statusData?.status_code === 'EXPIRED') {
          throw new Error(`Instagram media processing failed (${statusData.status_code}: ${statusData.status || 'unknown'})`);
        }
        await new Promise((r) => setTimeout(r, 1500));
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
        const detail = publishData.error?.error_user_msg
          ? `${publishData.error.message} — ${publishData.error.error_user_msg}`
          : publishData.error?.message;
        const err: any = new Error(detail || `Instagram container publish failed (${publishRes.status})`);
        err.containerId = containerId;
        throw err;
      }

      return {
        externalPostId: publishData.id,
        metaContainerId: containerId,
        metrics: { impressions: 0, reach: 0, likes: 0, comments: 0 },
        rawResponse: publishData,
      };
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message, containerId }, '[InstagramPublisher] API error');
      throw err;
    }
  }
}
