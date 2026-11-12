import { Publisher, PublishParams, PublishResult } from './publisher.interface.js';
import { decrypt } from '../../lib/crypto.js';
import { logger } from '../../lib/logger.js';

export class YouTubePublisher implements Publisher {
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

    const isMock = !accessToken || accessToken.startsWith('mock_') || accessToken.startsWith('simulated_') || accessToken.startsWith('manual_') || channel.externalId.startsWith('mock_') || channel.externalId.startsWith('manual_');

    if (isMock) {
      throw new Error('YouTube channel requires an official Google/YouTube OAuth connection. Manual or mock channels cannot publish live.');
    }

    if (!mediaUrls || mediaUrls.length === 0) {
      throw new Error('YouTube requires a video file attachment to upload.');
    }

    try {
      // Live YouTube Data API v3 Resumable Upload (Step 1: init, Step 2: upload video binary)
      const lines = caption.split('\n');
      const title = lines[0].slice(0, 100) || 'New Video Upload';
      const description = caption;

      const metadata = {
        snippet: {
          title,
          description,
          categoryId: '22', // People & Blogs default
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false,
        },
      };

      const initRes = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!initRes.ok) {
        const errText = await initRes.text();
        throw new Error(`YouTube API init error (${initRes.status}): ${errText}`);
      }

      const uploadLocation = initRes.headers.get('location');
      if (!uploadLocation) {
        throw new Error('YouTube upload session did not return a resumable upload Location URL.');
      }

      const mediaFetch = await fetch(mediaUrls[0]);
      if (!mediaFetch.ok) {
        throw new Error(`Could not download source video for YouTube upload (${mediaFetch.status})`);
      }
      const videoBytes = Buffer.from(await mediaFetch.arrayBuffer());
      const putRes = await fetch(uploadLocation, {
        method: 'PUT',
        headers: {
          'Content-Type': mediaFetch.headers.get('content-type') || 'video/mp4',
          'Content-Length': String(videoBytes.byteLength),
        },
        body: videoBytes,
      });

      if (!putRes.ok) {
        const putErr = await putRes.text();
        throw new Error(`YouTube video binary upload failed (${putRes.status}): ${putErr}`);
      }

      const uploadedJson: any = await putRes.json();
      if (!uploadedJson?.id) {
        throw new Error('YouTube API did not return a published video ID.');
      }

      return {
        externalPostId: uploadedJson.id,
        metrics: { impressions: 0, likes: 0 },
      };
    } catch (err: any) {
      logger.error({ channelId: channel.id, err: err.message }, 'Failed to publish to YouTube');
      throw err;
    }
  }
}
