export const NETWORKS = [
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'THREADS',
  'X',
  'LINKEDIN',
  'YOUTUBE',
  'PINTEREST',
] as const;

export type Network = (typeof NETWORKS)[number];

export interface NetworkConfig {
  name: string;
  maxCaptionLength: number;
  requiresMedia: boolean;
  allowedMediaTypes: ('image' | 'video')[];
  maxMediaItems: number;
  supportsFirstComment: boolean;
  supportsTitle: boolean;
  maxTitleLength?: number;
  fixedUrlLength?: number; // e.g. X counts URLs as 23 characters
  aspectRatios: string[];
}

export const NETWORK_LIMITS: Record<Network, NetworkConfig> = {
  INSTAGRAM: {
    name: 'Instagram',
    maxCaptionLength: 2200,
    requiresMedia: true,
    allowedMediaTypes: ['image', 'video'],
    maxMediaItems: 10,
    supportsFirstComment: true,
    supportsTitle: false,
    aspectRatios: ['1:1', '4:5', '9:16'],
  },
  FACEBOOK: {
    name: 'Facebook',
    maxCaptionLength: 63206,
    requiresMedia: false,
    allowedMediaTypes: ['image', 'video'],
    maxMediaItems: 10,
    supportsFirstComment: true,
    supportsTitle: false,
    aspectRatios: ['16:9', '1:1', '4:5'],
  },
  TIKTOK: {
    name: 'TikTok',
    maxCaptionLength: 2200,
    requiresMedia: true,
    allowedMediaTypes: ['video'],
    maxMediaItems: 1,
    supportsFirstComment: false,
    supportsTitle: false,
    aspectRatios: ['9:16'],
  },
  THREADS: {
    name: 'Threads',
    maxCaptionLength: 500,
    requiresMedia: false,
    allowedMediaTypes: ['image', 'video'],
    maxMediaItems: 10,
    supportsFirstComment: false,
    supportsTitle: false,
    aspectRatios: ['1:1', '16:9', '4:5'],
  },
  X: {
    name: 'X (Twitter)',
    maxCaptionLength: 280,
    requiresMedia: false,
    allowedMediaTypes: ['image', 'video'],
    maxMediaItems: 4,
    supportsFirstComment: false,
    supportsTitle: false,
    fixedUrlLength: 23,
    aspectRatios: ['16:9', '1:1'],
  },
  LINKEDIN: {
    name: 'LinkedIn',
    maxCaptionLength: 3000,
    requiresMedia: false,
    allowedMediaTypes: ['image', 'video'],
    maxMediaItems: 9,
    supportsFirstComment: true,
    supportsTitle: false,
    aspectRatios: ['1:1', '16:9'],
  },
  YOUTUBE: {
    name: 'YouTube',
    maxCaptionLength: 5000, // description
    requiresMedia: true,
    allowedMediaTypes: ['video'],
    maxMediaItems: 1,
    supportsFirstComment: false,
    supportsTitle: true,
    maxTitleLength: 100,
    aspectRatios: ['16:9', '9:16'],
  },
  PINTEREST: {
    name: 'Pinterest',
    maxCaptionLength: 500,
    requiresMedia: true,
    allowedMediaTypes: ['image'],
    maxMediaItems: 1,
    supportsFirstComment: false,
    supportsTitle: true,
    maxTitleLength: 100,
    aspectRatios: ['2:3', '1:1'],
  },
};

/**
 * Calculates effective character length considering network-specific URL counting rules
 */
export function calculateEffectiveLength(text: string, network: Network): number {
  const config = NETWORK_LIMITS[network];
  if (!text) return 0;

  // Use Intl.Segmenter for grapheme-aware counting (emoji = 1)
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

  if (config.fixedUrlLength !== undefined) {
    const urlRegex = /https?:\/\/[^\s]+/gi;
    let effectiveText = text;
    const urls = text.match(urlRegex) || [];
    let count = 0;

    // Remove URLs from text to count remaining graphemes
    const textWithoutUrls = text.replace(urlRegex, '');
    for (const _ of segmenter.segment(textWithoutUrls)) {
      count++;
    }

    // Add fixed length per URL
    count += urls.length * config.fixedUrlLength;
    return count;
  }

  let count = 0;
  for (const _ of segmenter.segment(text)) {
    count++;
  }
  return count;
}
