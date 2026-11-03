import crypto from 'crypto';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../middleware/error.js';

export interface MetaPageCandidate {
  pageId: string;
  pageName: string;
  pageToken: string;
  instagram?: {
    id: string;
    username: string;
    profilePictureUrl?: string;
  };
}

/**
 * Generate CSRF-protected state parameter linked to invite token and brand
 */
export function generateMetaOAuthState(inviteToken: string, brandId: string): string {
  const payload = JSON.stringify({
    token: inviteToken,
    brandId,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(8).toString('hex'),
  });

  const hmac = crypto.createHmac('sha256', env.COOKIE_SECRET).update(payload).digest('base64url');
  const encodedPayload = Buffer.from(payload).toString('base64url');

  return `${encodedPayload}.${hmac}`;
}

/**
 * Verify and decode CSRF-protected state parameter
 */
export function verifyMetaOAuthState(state: string): { inviteToken: string; brandId: string } {
  try {
    const [encodedPayload, hmac] = state.split('.');
    if (!encodedPayload || !hmac) {
      throw new Error('Invalid state format');
    }

    const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const expectedHmac = crypto.createHmac('sha256', env.COOKIE_SECRET).update(payload).digest('base64url');

    const hmacBuffer = Buffer.from(hmac, 'utf8');
    const expectedBuffer = Buffer.from(expectedHmac, 'utf8');

    // Constant-time comparison to prevent timing side-channel attacks
    if (hmacBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(hmacBuffer, expectedBuffer)) {
      throw new Error('State HMAC signature mismatch');
    }

    const data = JSON.parse(payload);
    // Expire state after 1 hour
    if (Date.now() - data.timestamp > 3600 * 1000) {
      throw new Error('State has expired');
    }

    return { inviteToken: data.token, brandId: data.brandId };
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed to verify Meta OAuth state');
    throw new AppError('INVALID_STATE', 'Security verification failed or link expired. Please try connecting again.', 400);
  }
}

/**
 * Build Meta OAuth authorization dialog URL
 */
export function getMetaAuthorizeUrl(state: string): string {
  if (!env.META_APP_ID) {
    // Mock simulation URL if no Meta App ID is configured
    return `${env.API_URL}/api/v1/oauth/meta/callback?mock=true&state=${state}`;
  }

  const scopes = [
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish',
  ].join(',');

  const redirectUri = encodeURIComponent(env.META_REDIRECT_URI);
  return `https://www.facebook.com/v20.0/dialog/oauth?client_id=${env.META_APP_ID}&redirect_uri=${redirectUri}&state=${state}&scope=${scopes}&response_type=code`;
}

/**
 * Exchange OAuth authorization code for Long-Lived Token (60 days) and fetch candidate Pages & Instagram Accounts
 */
export async function exchangeMetaCodeForAccounts(
  code: string,
  isMock = false
): Promise<MetaPageCandidate[]> {
  // If mock mode or no credentials, return realistic candidate accounts
  if (isMock || !env.META_APP_ID || !env.META_APP_SECRET) {
    logger.info('Using simulated Meta accounts (Mock mode / No Meta App Credentials in .env)');
    return [
      {
        pageId: `fb_page_${Date.now()}`,
        pageName: 'Ember & Oak Coffee Co.',
        pageToken: `mock_long_lived_token_fb_${Date.now()}`,
        instagram: {
          id: `ig_account_${Date.now()}`,
          username: 'emberandoak',
          profilePictureUrl: '/murmura/photos/murmura/posts/ember-shot.jpg',
        },
      },
      {
        pageId: `fb_page_alt_${Date.now()}`,
        pageName: 'Ember & Oak Roastery & Lab',
        pageToken: `mock_long_lived_token_fb_alt_${Date.now()}`,
      },
    ];
  }

  try {
    // 1. Exchange code for Short-Lived User Access Token
    const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&redirect_uri=${encodeURIComponent(env.META_REDIRECT_URI)}&code=${code}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = (await tokenRes.json()) as any;

    if (tokenData.error) {
      throw new Error(tokenData.error.message || 'Failed to exchange authorization code');
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange Short-Lived User Access Token for Long-Lived User Access Token (60 days)
    const longLivedUrl = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.META_APP_ID}&client_secret=${env.META_APP_SECRET}&fb_exchange_token=${shortLivedToken}`;
    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = (await longLivedRes.json()) as any;

    const longLivedToken = longLivedData.access_token || shortLivedToken;

    // 3. Fetch User's Facebook Pages and linked Instagram Business/Creator Accounts
    const accountsUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${longLivedToken}`;
    const accountsRes = await fetch(accountsUrl);
    const accountsData = (await accountsRes.json()) as any;

    if (accountsData.error) {
      throw new Error(accountsData.error.message || 'Failed to fetch user Facebook pages');
    }

    const pages: MetaPageCandidate[] = (accountsData.data || []).map((page: any) => ({
      pageId: page.id,
      pageName: page.name,
      pageToken: page.access_token,
      instagram: page.instagram_business_account
        ? {
            id: page.instagram_business_account.id,
            username: page.instagram_business_account.username,
            profilePictureUrl: page.instagram_business_account.profile_picture_url,
          }
        : undefined,
    }));

    return pages;
  } catch (err: any) {
    logger.error({ err: err.message }, 'Meta OAuth token exchange failed');
    throw new AppError('OAUTH_EXCHANGE_FAILED', `Meta authentication failed: ${err.message}`, 502);
  }
}
