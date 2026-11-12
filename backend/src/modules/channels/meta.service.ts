import crypto from 'crypto';
import { Request } from 'express';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { AppError } from '../../middleware/error.js';
import { getApiUrl, isTrustedWebHost } from '../../lib/urls.js';

export interface MetaPageCandidate {
  pageId: string;
  pageName: string;
  pageToken: string;
  isProfile?: boolean;
  avatarUrl?: string;
  instagram?: {
    id: string;
    username: string;
    profilePictureUrl?: string;
  };
}

/**
 * Generate CSRF-protected state parameter linked to invite token, brand, and originating trusted web origin
 */
export function generateMetaOAuthState(inviteToken: string, brandId: string, webUrl?: string): string {
  const payload = JSON.stringify({
    token: inviteToken,
    brandId,
    ...(webUrl ? { webUrl } : {}),
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
export function verifyMetaOAuthState(state: string): { inviteToken: string; brandId: string; webUrl?: string } {
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

    let safeWebUrl: string | undefined;
    if (typeof data.webUrl === 'string' && data.webUrl) {
      try {
        const parsed = new URL(data.webUrl);
        if (isTrustedWebHost(parsed.hostname)) {
          safeWebUrl = `${parsed.protocol}//${parsed.host}`;
        }
      } catch {}
    }

    return { inviteToken: data.token, brandId: data.brandId, ...(safeWebUrl ? { webUrl: safeWebUrl } : {}) };
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Failed to verify Meta OAuth state');
    throw new AppError('INVALID_STATE', 'Security verification failed or link expired. Please try connecting again.', 400);
  }
}

export function getMetaRedirectUri(req?: Request): string {
  if (env.META_REDIRECT_URI && !env.META_REDIRECT_URI.includes('localhost') && !env.META_REDIRECT_URI.includes('127.0.0.1')) {
    return env.META_REDIRECT_URI;
  }
  const apiBase = getApiUrl(req);
  return `${apiBase}/api/v1/oauth/meta/callback`;
}

/**
 * Build Meta OAuth authorization dialog URL
 */
export function getMetaAuthorizeUrl(state: string, req?: Request): string {
  const appId = (env.META_APP_ID || process.env.META_APP_ID || '1700460381501081').trim();
  const redirectUri = encodeURIComponent(getMetaRedirectUri(req));
  const scopes = [
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish',
  ].join(',');

  logger.info({ appId, redirectUri: decodeURIComponent(redirectUri) }, 'Generating official Meta OAuth URL');
  return `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=${state}&scope=${scopes}&response_type=code`;
}

/**
 * Exchange OAuth authorization code for Long-Lived Token (60 days) and fetch candidate Pages & Instagram Accounts
 */
export async function exchangeMetaCodeForAccounts(
  code: string,
  isMock = false,
  brandName?: string,
  req?: Request
): Promise<MetaPageCandidate[]> {
  const appId = (env.META_APP_ID || process.env.META_APP_ID || '1700460381501081').trim();
  const appSecret = (env.META_APP_SECRET || process.env.META_APP_SECRET || '').trim();

  // If explicitly mock test in non-production and secret is missing
  if ((!code || code === 'mock_code' || isMock) && env.NODE_ENV !== 'production' && !appSecret) {
    logger.info('Using simulated Meta accounts (Local dev mock only)');
    return [
      {
        pageId: `fb_acc_${Date.now()}`,
        pageName: 'Facebook Account (Personal Profile)',
        pageToken: `mock_long_lived_token_fb_${Date.now()}`,
        isProfile: true,
      },
    ];
  }

  if (!code || code === 'mock_code') {
    throw new AppError('INVALID_OAUTH_CODE', 'Official authorization code from Facebook is required.', 400);
  }

  if (!appSecret) {
    logger.error('Meta App Secret (META_APP_SECRET) is missing in server environment variables');
    throw new AppError(
      'META_CONFIG_ERROR',
      'META_APP_SECRET is not configured on the backend server. Please verify Render Environment Variables.',
      500
    );
  }

  try {
    const redirectUri = getMetaRedirectUri(req);
    logger.info({ appId, redirectUri }, 'Exchanging authorization code for Meta User Access Token');

    // 1. Exchange code for Short-Lived User Access Token
    const tokenUrl = `https://graph.facebook.com/v20.0/oauth/access_token?client_id=${appId}&client_secret=${encodeURIComponent(appSecret)}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`;
    const tokenRes = await fetch(tokenUrl);
    const tokenData = (await tokenRes.json()) as any;

    if (tokenData.error) {
      logger.error({ error: tokenData.error }, 'Meta token exchange API error');
      throw new Error(tokenData.error.message || 'Failed to exchange authorization code with Meta');
    }

    const shortLivedToken = tokenData.access_token;

    // 2. Exchange Short-Lived User Access Token for Long-Lived User Access Token (60 days)
    const longLivedUrl = `https://graph.facebook.com/v20.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${encodeURIComponent(appSecret)}&fb_exchange_token=${encodeURIComponent(shortLivedToken)}`;
    const longLivedRes = await fetch(longLivedUrl);
    const longLivedData = (await longLivedRes.json()) as any;

    const longLivedToken = longLivedData.access_token || shortLivedToken;

    // 3. Fetch User's Real Facebook Profile Information (/me)
    let userProfile: { id: string; name: string; avatarUrl?: string } | null = null;
    try {
      const meUrl = `https://graph.facebook.com/v20.0/me?fields=id,name,picture.type(large){url}&access_token=${encodeURIComponent(longLivedToken)}`;
      const meRes = await fetch(meUrl);
      const meData = (await meRes.json()) as any;
      if (meData && meData.id && meData.name) {
        userProfile = {
          id: meData.id,
          name: meData.name,
          avatarUrl: meData.picture?.data?.url,
        };
        logger.info({ userProfileName: userProfile.name, userProfileId: userProfile.id }, 'Fetched user real Facebook profile');
      }
    } catch (e: any) {
      logger.warn({ err: e.message }, 'Could not fetch /me user profile');
    }

    // 4. Fetch User's Real Facebook Pages and linked Instagram Business/Creator Accounts
    const accountsUrl = `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token,instagram_business_account{id,username,profile_picture_url}&access_token=${encodeURIComponent(longLivedToken)}`;
    const accountsRes = await fetch(accountsUrl);
    const accountsData = (await accountsRes.json()) as any;

    if (accountsData.error) {
      logger.error({ error: accountsData.error }, 'Meta me/accounts API error');
      // If permissions or pages fetch had error but we have userProfile, link real user Facebook profile!
      if (userProfile) {
        return [
          {
            pageId: userProfile.id,
            pageName: userProfile.name,
            pageToken: longLivedToken,
            isProfile: true,
            avatarUrl: userProfile.avatarUrl,
          },
        ];
      }
      throw new Error(accountsData.error.message || 'Failed to fetch user Facebook pages from Meta');
    }

    const rawPages = (accountsData && Array.isArray(accountsData.data)) ? accountsData.data : [];
    logger.info({ rawPagesCount: rawPages.length }, 'Fetched Meta pages for user');

    const pages: MetaPageCandidate[] = rawPages.map((page: any) => ({
      pageId: page.id,
      pageName: page.name,
      pageToken: page.access_token,
      isProfile: false,
      instagram: page.instagram_business_account
        ? {
            id: page.instagram_business_account.id,
            username: (page.instagram_business_account.username || '').replace(/^@+/, ''),
            profilePictureUrl: page.instagram_business_account.profile_picture_url,
          }
        : undefined,
    }));

    // If user has actual Facebook Pages, return their actual Facebook Pages!
    if (pages.length > 0) {
      return pages;
    }

    // If user does NOT have any Facebook Pages, link their actual Facebook Account / Profile directly!
    if (userProfile) {
      logger.info({ userProfile }, 'No Facebook Pages found. Linking user real Facebook Account/Profile directly');
      return [
        {
          pageId: userProfile.id,
          pageName: userProfile.name,
          pageToken: longLivedToken,
          isProfile: true,
          avatarUrl: userProfile.avatarUrl,
        },
      ];
    }

    return [];
  } catch (err: any) {
    logger.error({ err: err.message }, 'Meta OAuth token exchange failed');
    throw new AppError('OAUTH_EXCHANGE_FAILED', `Meta authentication failed: ${err.message}`, 502);
  }
}
