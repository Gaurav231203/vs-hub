import crypto from 'crypto';
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { AppError } from '../../middleware/error.js';
import { encrypt, hashToken, generateSecureToken, compareSecureToken } from '../../lib/crypto.js';
import {
  generateMetaOAuthState,
  verifyMetaOAuthState,
  getMetaAuthorizeUrl,
  exchangeMetaCodeForAccounts,
  MetaPageCandidate,
} from '../channels/meta.service.js';
import { connectRateLimiter, oauthRateLimiter } from '../../middleware/rateLimit.js';
import { ChannelStatus, Network, BrandStatus, ConnectInviteStatus } from '@prisma/client';
import { OAuthSessionService } from './oauthSession.service.js';
import { EmailService } from '../../lib/email.js';

export const invitesRouter = Router();

/* ==========================================================================
   1. AGENCY AUTHENTICATED ENDPOINTS
   ========================================================================== */

/**
 * POST /api/v1/invites/connect
 * Agency creates an expiring invite link for a client to connect social accounts.
 * Requirement 3: Automatically revokes any existing active invite for this brand.
 */
invitesRouter.post(
  '/invites/connect',
  authenticate,
  tenantMiddleware,
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const { brandId, expiresInDays = 7 } = req.body;

      if (!brandId) {
        throw new AppError('VALIDATION_ERROR', 'brandId is required', 400);
      }

      // Check brand access in workspace (Strict tenant isolation)
      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }

      const brand = await prisma.brand.findFirst({
        where: { id: brandId, workspaceId: ctx.workspaceId },
        include: {
          workspace: { select: { id: true, name: true } },
          contacts: { where: { isPrimary: true }, take: 1 },
        },
      });
      if (!brand) throw new AppError('BRAND_NOT_FOUND', 'Brand not found', 404);

      // Auto-revoke previous active invites for this brand
      await prisma.connectInvite.updateMany({
        where: { brandId, status: ConnectInviteStatus.ACTIVE },
        data: {
          status: ConnectInviteStatus.REVOKED,
          revokedAt: new Date(),
        },
      });

      // Generate cryptographically secure random token & SHA-256 hash
      const { raw, hash } = generateSecureToken(32);
      const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

      const invite = await prisma.connectInvite.create({
        data: {
          workspaceId: ctx.workspaceId,
          brandId,
          tokenHash: hash,
          expiresAt,
          status: ConnectInviteStatus.ACTIVE,
          createdBy: ctx.userId,
        },
      });

      // Update brand status to INVITED if it was CREATED
      if (brand.status === BrandStatus.CREATED) {
        await prisma.brand.update({
          where: { id: brandId },
          data: { status: BrandStatus.INVITED },
        });
      }

      const inviteUrl = `${env.WEB_URL}/connect/${raw}`;

      // Dispatch invite email if client contact exists
      const primaryContact = brand.contacts[0];
      if (primaryContact?.email) {
        await EmailService.sendConnectInvite({
          toEmail: primaryContact.email,
          clientName: primaryContact.name,
          brandName: brand.name,
          agencyName: brand.workspace.name,
          inviteUrl,
          expiresInDays,
        });
      }

      res.status(201).json({
        id: invite.id,
        brandId,
        brandName: brand.name,
        inviteUrl,
        rawToken: raw,
        expiresAt: invite.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ==========================================================================
   2. PUBLIC CLIENT CONNECT ENDPOINTS (ZERO LOGIN, RATE-LIMITED)
   ========================================================================== */

/**
 * GET /api/v1/public/connect/:token
 * Client views the branded connect invite page.
 * Uses constant-time token comparison (timingSafeEqual).
 */
invitesRouter.get(
  '/public/connect/:token',
  connectRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.token;
      if (!rawToken || typeof rawToken !== 'string') {
        throw new AppError('INVITE_NOT_FOUND', 'This connection link is invalid or does not exist.', 404);
      }

      const hash = hashToken(rawToken);

      const invite = await prisma.connectInvite.findUnique({
        where: { tokenHash: hash },
        include: {
          brand: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              color: true,
              description: true,
              workspace: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // Timing-safe verification
      if (!invite || !compareSecureToken(rawToken, invite.tokenHash)) {
        throw new AppError('INVITE_NOT_FOUND', 'This connection link is invalid or does not exist.', 404);
      }

      // Check Revoked status
      if (invite.status === ConnectInviteStatus.REVOKED || invite.revokedAt) {
        throw new AppError(
          'INVITE_REVOKED',
          'This connection link has been revoked or replaced with a newer link.',
          410
        );
      }

      // Check Used status
      if (invite.status === ConnectInviteStatus.USED || invite.usedAt) {
        throw new AppError(
          'INVITE_ALREADY_USED',
          'This connection link has already been used.',
          410
        );
      }

      // Check Expired status
      if (new Date() > invite.expiresAt || invite.status === ConnectInviteStatus.EXPIRED) {
        if (invite.status !== ConnectInviteStatus.EXPIRED) {
          await prisma.connectInvite.update({
            where: { id: invite.id },
            data: { status: ConnectInviteStatus.EXPIRED },
          });
        }
        throw new AppError(
          'INVITE_EXPIRED',
          'This connection link has expired. Please ask your agency to generate a new invite link.',
          410
        );
      }

      // Check current connected channels for this brand
      const existingChannels = await prisma.channel.findMany({
        where: { brandId: invite.brandId },
        select: {
          id: true,
          network: true,
          handle: true,
          status: true,
        },
      });

      res.json({
        valid: true,
        agencyName: invite.brand.workspace.name,
        brand: {
          id: invite.brand.id,
          name: invite.brand.name,
          logoUrl: invite.brand.logoUrl,
          color: invite.brand.color,
          description: invite.brand.description,
        },
        existingChannels,
        expiresAt: invite.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/public/connect/:token/request-new-link
 * Client requests a fresh link when their link has expired or been revoked.
 */
invitesRouter.post(
  '/public/connect/:token/request-new-link',
  connectRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.token;
      if (!rawToken || typeof rawToken !== 'string') {
        throw new AppError('INVITE_NOT_FOUND', 'Connection link not found', 404);
      }

      const hash = hashToken(rawToken);
      const invite = await prisma.connectInvite.findUnique({
        where: { tokenHash: hash },
        include: {
          brand: {
            include: {
              contacts: { where: { isPrimary: true }, take: 1 },
              workspace: {
                include: {
                  memberships: {
                    where: { role: 'OWNER' },
                    include: { user: { select: { email: true } } },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      });

      if (!invite || !compareSecureToken(rawToken, invite.tokenHash)) {
        throw new AppError('INVITE_NOT_FOUND', 'Connection link not found', 404);
      }

      const adminEmail = invite.brand.workspace.memberships[0]?.user.email || env.SEED_OWNER_EMAIL;
      const primaryContact = invite.brand.contacts[0];

      // Dispatch alert to agency admin
      await EmailService.sendNewLinkRequestedAlert({
        agencyAdminEmail: adminEmail,
        clientName: primaryContact?.name,
        clientEmail: primaryContact?.email,
        brandName: invite.brand.name,
      });

      logger.info(
        { brandId: invite.brandId, adminEmail },
        'Client requested new connection link; admin notified'
      );

      res.json({
        success: true,
        message: 'Your agency has been notified and will email you a fresh connection link.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/public/connect/:token/oauth/meta
 * Client initiates Meta OAuth connection with CSRF state
 */
invitesRouter.get(
  '/public/connect/:token/oauth/meta',
  oauthRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.token;
      const hash = hashToken(rawToken);

      const invite = await prisma.connectInvite.findUnique({
        where: { tokenHash: hash },
      });

      if (
        !invite ||
        !compareSecureToken(rawToken, invite.tokenHash) ||
        invite.status !== ConnectInviteStatus.ACTIVE ||
        invite.usedAt ||
        invite.revokedAt ||
        new Date() > invite.expiresAt
      ) {
        throw new AppError('INVITE_INVALID', 'Invite link is expired or invalid', 400);
      }

      // Generate signed state parameter
      const state = generateMetaOAuthState(rawToken, invite.brandId);
      const authUrl = getMetaAuthorizeUrl(state);

      res.json({ authUrl });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/oauth/meta/callback
 * Meta OAuth callback handler (verifies CSRF state, exchanges 60-day token)
 */
invitesRouter.get(
  '/oauth/meta/callback',
  oauthRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { code, state, error, error_description, mock } = req.query;

      if (error) {
        logger.warn({ error, error_description }, 'Meta OAuth denied by user');
        return res.redirect(`${env.WEB_URL}/connect/error?message=${encodeURIComponent(String(error_description || error))}`);
      }

      if (!state || typeof state !== 'string') {
        throw new AppError('MISSING_STATE', 'State parameter is missing from Meta callback', 400);
      }

      // 1. Verify CSRF State
      const { inviteToken, brandId } = verifyMetaOAuthState(state);
      const hash = hashToken(inviteToken);

      const invite = await prisma.connectInvite.findUnique({
        where: { tokenHash: hash },
      });

      if (
        !invite ||
        !compareSecureToken(inviteToken, invite.tokenHash) ||
        invite.status !== ConnectInviteStatus.ACTIVE ||
        invite.usedAt ||
        invite.revokedAt ||
        new Date() > invite.expiresAt
      ) {
        throw new AppError('INVITE_INVALID', 'Invite link has expired or was already used', 400);
      }

      // 2. Exchange code for candidate pages & accounts
      const candidatePages = await exchangeMetaCodeForAccounts(
        String(code || 'mock_code'),
        mock === 'true'
      );

      if (candidatePages.length === 0) {
        return res.redirect(
          `${env.WEB_URL}/connect/${inviteToken}?error=NO_PAGES_FOUND&message=No%20Facebook%20Pages%20found%20under%20your%20Meta%20account.`
        );
      }

      // 3. If multiple pages found: store session in DB with AES encryption and redirect to Page Picker step
      if (candidatePages.length > 1) {
        const sessionId = await OAuthSessionService.saveSession({
          inviteToken,
          brandId,
          workspaceId: invite.workspaceId,
          candidates: candidatePages,
        });

        return res.redirect(
          `${env.WEB_URL}/connect/${inviteToken}?step=select-page&sessionId=${sessionId}`
        );
      }

      // 4. If single page: bind immediately
      const page = candidatePages[0];
      await bindMetaAccountsToBrand({
        workspaceId: invite.workspaceId,
        brandId,
        page,
      });

      // Mark invite as used and update brand status
      await prisma.connectInvite.update({
        where: { id: invite.id },
        data: {
          status: ConnectInviteStatus.USED,
          usedAt: new Date(),
        },
      });

      await prisma.brand.update({
        where: { id: brandId },
        data: { status: BrandStatus.CONNECTED },
      });

      return res.redirect(`${env.WEB_URL}/connect/${inviteToken}?status=success`);
    } catch (err: any) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/public/connect/:token/pages/:sessionId
 * Fetch candidate pages for client selection step
 */
invitesRouter.get(
  '/public/connect/:token/pages/:sessionId',
  connectRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.params;
      const candidates = await OAuthSessionService.getCandidatesForClient(sessionId);
      res.json({ candidates });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/public/connect/:token/select-page
 * Client selects their desired Facebook Page & Instagram account from candidates
 */
invitesRouter.post(
  '/public/connect/:token/select-page',
  connectRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sessionId, selectedPageId } = req.body;
      const rawToken = req.params.token;

      const { selectedPage, workspaceId, brandId } =
        await OAuthSessionService.consumeSessionAndGetPage(sessionId, rawToken, selectedPageId);

      // Bind accounts with AES-256 encrypted tokens
      await bindMetaAccountsToBrand({
        workspaceId,
        brandId,
        page: selectedPage,
      });

      // Mark invite as used and update brand status
      const hash = hashToken(rawToken);
      await prisma.connectInvite.updateMany({
        where: { tokenHash: hash },
        data: {
          status: ConnectInviteStatus.USED,
          usedAt: new Date(),
        },
      });

      await prisma.brand.update({
        where: { id: brandId },
        data: { status: BrandStatus.CONNECTED },
      });

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

/* ==========================================================================
   HELPER: Bind & Encrypt Meta Accounts in DB
   ========================================================================== */
async function bindMetaAccountsToBrand({
  workspaceId,
  brandId,
  page,
}: {
  workspaceId: string;
  brandId: string;
  page: MetaPageCandidate;
}) {
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days
  const encryptedPageToken = encrypt(page.pageToken);

  // 1. Bind / Upsert Facebook Page Channel
  await prisma.channel.upsert({
    where: {
      brandId_network_externalId: {
        brandId,
        network: Network.FACEBOOK,
        externalId: page.pageId,
      },
    },
    create: {
      workspaceId,
      brandId,
      network: Network.FACEBOOK,
      externalId: page.pageId,
      handle: page.pageName,
      status: ChannelStatus.CONNECTED,
      postingEnabled: true,
      accessTokenEnc: encryptedPageToken,
      tokenExpiresAt: expiresAt,
      followers: 1250,
    },
    update: {
      handle: page.pageName,
      status: ChannelStatus.CONNECTED,
      accessTokenEnc: encryptedPageToken,
      tokenExpiresAt: expiresAt,
      lastError: null,
    },
  });

  // 2. If an Instagram Business Account is linked to this page, bind / upsert it
  if (page.instagram) {
    await prisma.channel.upsert({
      where: {
        brandId_network_externalId: {
          brandId,
          network: Network.INSTAGRAM,
          externalId: page.instagram.id,
        },
      },
      create: {
        workspaceId,
        brandId,
        network: Network.INSTAGRAM,
        externalId: page.instagram.id,
        handle: `@${page.instagram.username}`,
        avatarUrl: page.instagram.profilePictureUrl,
        status: ChannelStatus.CONNECTED,
        postingEnabled: true,
        accessTokenEnc: encryptedPageToken,
        tokenExpiresAt: expiresAt,
        followers: 4800,
      },
      update: {
        handle: `@${page.instagram.username}`,
        avatarUrl: page.instagram.profilePictureUrl,
        status: ChannelStatus.CONNECTED,
        accessTokenEnc: encryptedPageToken,
        tokenExpiresAt: expiresAt,
        lastError: null,
      },
    });
  }

  logger.info(
    { brandId, pageId: page.pageId, igId: page.instagram?.id },
    'Meta channels connected and encrypted successfully'
  );
}
