import { Network, NETWORK_LIMITS, calculateEffectiveLength } from '@postdesk/shared';

export interface ValidationIssue {
  network: Network;
  severity: 'error' | 'warning';
  code: string;
  message: string;
}

export interface ValidatePostParams {
  caption: string;
  firstComment?: string | null;
  channels: {
    id: string;
    network: Network;
    handle: string;
    status: string;
    postingEnabled: boolean;
  }[];
  media?: {
    kind: string; // 'image' | 'video'
    url: string;
  }[];
  scheduledAt?: Date | null;
  isSubmitting?: boolean;
}

export function validatePostContent(params: ValidatePostParams): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const now = new Date();

  // Time check
  if (params.scheduledAt) {
    if (params.scheduledAt.getTime() <= now.getTime()) {
      issues.push({
        network: 'INSTAGRAM', // general
        severity: 'error',
        code: 'TIME_IN_PAST',
        message: 'Publication time cannot be in the past.',
      });
    } else if (params.isSubmitting && params.scheduledAt.getTime() < now.getTime() + 5 * 60 * 1000) {
      issues.push({
        network: 'INSTAGRAM',
        severity: 'error',
        code: 'MIN_LEAD_TIME',
        message: 'Submitting or scheduling requires at least 5 minutes lead time.',
      });
    }
  }

  const mediaList = params.media || [];
  const hasImage = mediaList.some((m) => m.kind?.toLowerCase() === 'image');
  const hasVideo = mediaList.some((m) => m.kind?.toLowerCase() === 'video');

  for (const ch of params.channels) {
    const limits = NETWORK_LIMITS[ch.network];
    if (!limits) continue;

    // Channel health checks
    if (ch.status === 'DISCONNECTED') {
      issues.push({
        network: ch.network,
        severity: 'error',
        code: 'CHANNEL_DISCONNECTED',
        message: `${limits.name} account @${ch.handle} is disconnected. Please reconnect first.`,
      });
    } else if (!ch.postingEnabled || ch.status === 'PAUSED') {
      issues.push({
        network: ch.network,
        severity: 'warning',
        code: 'CHANNEL_PAUSED',
        message: `Posting is paused for ${limits.name} @${ch.handle}. Targets will be skipped unless unpaused.`,
      });
    }

    // Caption length check (grapheme + fixed URL calculation)
    const effectiveLen = calculateEffectiveLength(params.caption, ch.network);
    if (effectiveLen > limits.maxCaptionLength) {
      const overBy = effectiveLen - limits.maxCaptionLength;
      issues.push({
        network: ch.network,
        severity: 'error',
        code: 'OVER_LIMIT',
        message: `${limits.name} caption exceeds maximum limit by ${overBy} character${overBy !== 1 ? 's' : ''} (${effectiveLen}/${limits.maxCaptionLength}).`,
      });
    }

    // Media requirement checks
    if (limits.requiresMedia && mediaList.length === 0) {
      issues.push({
        network: ch.network,
        severity: 'error',
        code: 'MEDIA_REQUIRED',
        message: `${limits.name} requires at least one image or video attachment to publish.`,
      });
    } else if (ch.network === 'TIKTOK' || ch.network === 'YOUTUBE') {
      if (!hasVideo) {
        issues.push({
          network: ch.network,
          severity: 'error',
          code: 'VIDEO_REQUIRED',
          message: `${limits.name} requires a video file. Images are not supported.`,
        });
      }
    } else if (ch.network === 'PINTEREST') {
      if (!hasImage) {
        issues.push({
          network: ch.network,
          severity: 'error',
          code: 'IMAGE_REQUIRED',
          message: 'Pinterest pins require an image attachment.',
        });
      }
    }

    // Max media items check
    if (mediaList.length > limits.maxMediaItems) {
      issues.push({
        network: ch.network,
        severity: 'error',
        code: 'TOO_MANY_MEDIA',
        message: `${limits.name} allows a maximum of ${limits.maxMediaItems} attachments (current: ${mediaList.length}).`,
      });
    }
  }

  return issues;
}
