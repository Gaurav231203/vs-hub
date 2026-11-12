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
  followers?: number;
  instagram?: {
    id: string;
    username: string;
    profilePictureUrl?: string;
    followersCount?: number;
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
    'business_management',
    'instagram_basic',
    'instagram_content_publish',
  ].join(',');

  const configId = (process.env.META_LOGIN_CONFIG_ID || '').trim();
  const configParam = configId ? `&config_id=${encodeURIComponent(configId)}` : '';

  logger.info({ appId, redirectUri: decodeURIComponent(redirectUri), hasConfigId: Boolean(configId) }, 'Generating official Meta OAuth URL');
  return `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&state=${state}&scope=${scopes}${configParam}&response_type=code&auth_type=rerequest`;
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
    const accountsFields =
      'id,name,access_token,fan_count,followers_count,picture.type(large){url},instagram_business_account{id,username,profile_picture_url,followers_count}';
    let accountsUrl: string | null =
      `https://graph.facebook.com/v20.0/me/accounts?fields=${encodeURIComponent(accountsFields)}&limit=100&access_token=${encodeURIComponent(longLivedToken)}`;
    const rawPages: any[] = [];
    let accountsError: any = null;

    while (accountsUrl) {
      const accountsRes = await fetch(accountsUrl);
      const accountsData = (await accountsRes.json()) as any;
      if (accountsData?.error) {
        accountsError = accountsData.error;
        break;
      }
      if (Array.isArray(accountsData?.data)) {
        rawPages.push(...accountsData.data);
      }
      accountsUrl = accountsData?.paging?.next || null;
    }

    // Fallback: if nested fields failed on /me/accounts, fetch minimal page list
    if (accountsError && rawPages.length === 0) {
      const minimalRes = await fetch(
        `https://graph.facebook.com/v20.0/me/accounts?fields=id,name,access_token&limit=100&access_token=${encodeURIComponent(longLivedToken)}`
      );
      const minimalData = (await minimalRes.json()) as any;
      if (Array.isArray(minimalData?.data) && minimalData.data.length > 0) {
        accountsError = null;
        rawPages.push(...minimalData.data);
      }
    }

    // Also inspect Business Portfolio Pages non-fatally if /me/accounts returned 0
    if (rawPages.length === 0) {
      const bizQueries = [
        `id,name,owned_pages{${accountsFields}},client_pages{${accountsFields}}`,
        'id,name,owned_pages{id,name,fan_count,followers_count,picture.type(large){url},instagram_business_account{id,username,profile_picture_url,followers_count}},client_pages{id,name,fan_count,followers_count,picture.type(large){url},instagram_business_account{id,username,profile_picture_url,followers_count}}',
      ];
      for (const bizFields of bizQueries) {
        try {
          const bizUrl = `https://graph.facebook.com/v20.0/me/businesses?fields=${encodeURIComponent(bizFields)}&limit=50&access_token=${encodeURIComponent(longLivedToken)}`;
          const bizRes = await fetch(bizUrl);
          const bizData = (await bizRes.json()) as any;
          if (Array.isArray(bizData?.data) && bizData.data.length > 0) {
            const seenIds = new Set<string>();
            for (const biz of bizData.data) {
              for (const listKey of ['owned_pages', 'client_pages']) {
                const pList = biz?.[listKey]?.data;
                if (Array.isArray(pList)) {
                  for (const p of pList) {
                    if (p?.id && !seenIds.has(p.id)) {
                      seenIds.add(p.id);
                      rawPages.push(p);
                    }
                  }
                }
              }
            }
            if (rawPages.length > 0) break;
          }
        } catch {
          // Non-fatal: business_management scope may not be granted
        }
      }
    }

    // Ensure every Page has a valid access token (fetch /{pageId}?fields=access_token if missing)
    for (const p of rawPages) {
      if (!p.access_token && p.id) {
        try {
          const ptRes = await fetch(
            `https://graph.facebook.com/v20.0/${encodeURIComponent(p.id)}?fields=access_token&access_token=${encodeURIComponent(longLivedToken)}`
          );
          const ptData = (await ptRes.json()) as any;
          if (ptData?.access_token) {
            p.access_token = ptData.access_token;
          }
        } catch {}
      }
    }

    if (accountsError && rawPages.length === 0) {
      logger.error({ error: accountsError }, 'Meta me/accounts API error');
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
      throw new Error(accountsError.message || 'Failed to fetch user Facebook pages from Meta');
    }

    // Log token granular_scopes diagnostic when Meta returns 0 Pages
    if (rawPages.length === 0) {
      try {
        const dbgRes = await fetch(
          `https://graph.facebook.com/v20.0/debug_token?input_token=${encodeURIComponent(longLivedToken)}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
        );
        const dbgData = (await dbgRes.json()) as any;
        logger.warn(
          {
            userId: userProfile?.id,
            appId,
            granularScopes: dbgData?.data?.granular_scopes,
            scopes: dbgData?.data?.scopes,
          },
          'Meta /me/accounts returned 0 Pages — check Facebook Business Integrations page opt-in or Meta App Review'
        );
      } catch {}
    } else {
      logger.info({ rawPagesCount: rawPages.length }, 'Fetched Meta pages for user');
    }

    const pages: MetaPageCandidate[] = rawPages.map((page: any) => ({
      pageId: page.id,
      pageName: page.name,
      pageToken: page.access_token || longLivedToken,
      isProfile: false,
      avatarUrl: page.picture?.data?.url,
      followers:
        page.followers_count !== undefined
          ? Number(page.followers_count)
          : page.fan_count !== undefined
            ? Number(page.fan_count)
            : 0,
      instagram: page.instagram_business_account
        ? {
            id: page.instagram_business_account.id,
            username: (page.instagram_business_account.username || '').replace(/^@+/, ''),
            profilePictureUrl: page.instagram_business_account.profile_picture_url,
            followersCount:
              page.instagram_business_account.followers_count !== undefined
                ? Number(page.instagram_business_account.followers_count)
                : 0,
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
