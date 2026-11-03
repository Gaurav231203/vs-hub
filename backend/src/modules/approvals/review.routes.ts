import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../lib/logger.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { AppError } from '../../middleware/error.js';
import { hashToken, generateSecureToken } from '../../lib/crypto.js';
import { reviewRateLimiter } from '../../middleware/rateLimit.js';
import { clientApproveSchema, clientRequestChangesSchema } from '../../lib/sanitize.js';
import { PostStatus, ReviewDecision, ApprovalTokenStatus } from '@prisma/client';

export const reviewRouter = Router();

/* ==========================================================================
   1. AGENCY AUTHENTICATED ENDPOINTS: Generate Review Link
   ========================================================================== */

/**
 * POST /api/v1/posts/:id/review-link
 * Agency creates an expiring, post-linked client review token
 */
reviewRouter.post(
  '/posts/:id/review-link',
  authenticate,
  tenantMiddleware,
  requirePerm('post.publish'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const { id } = req.params;

      const post = await prisma.post.findFirst({
        where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
        include: { brand: true },
      });

      if (!post) {
        throw new AppError('POST_NOT_FOUND', 'Post not found or has been deleted', 404);
      }

      // Check brand access
      if (!ctx.allBrands && !ctx.brandIds.includes(post.brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }

      // Layer 1: Invalidate all existing ACTIVE review tokens for this post
      await prisma.approvalToken.updateMany({
        where: { postId: id, status: ApprovalTokenStatus.ACTIVE },
        data: { status: ApprovalTokenStatus.REVOKED, revokedAt: new Date() },
      });

      // Generate cryptographically secure random token & SHA-256 hash
      const { raw, hash } = generateSecureToken(32);
      const baseExpiryDays = 14;
      const expiresAt = new Date(Date.now() + baseExpiryDays * 24 * 60 * 60 * 1000);

      const approvalToken = await prisma.approvalToken.create({
        data: {
          postId: id,
          tokenHash: hash,
          expiresAt,
          postVersion: post.version,
          status: ApprovalTokenStatus.ACTIVE,
        },
      });

      const reviewUrl = `${env.WEB_URL}/review/${raw}`;

      logger.info({ postId: id, version: post.version, tokenId: approvalToken.id }, 'Generated fresh client review link');

      return res.status(201).json({
        postId: id,
        reviewUrl,
        rawToken: raw,
        expiresAt: approvalToken.expiresAt,
        version: post.version,
        status: approvalToken.status,
      });
    } catch (err) {
      next(err);
    }
  }
);

/* ==========================================================================
   2. PUBLIC CLIENT REVIEW ENDPOINTS (ZERO LOGIN, RATE-LIMITED)
   ========================================================================== */

/**
 * GET /api/v1/public/review/:token
 * Client views the live preview of the post without logging in
 */
reviewRouter.get(
  '/public/review/:token',
  reviewRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.token;
      const tokenHash = hashToken(rawToken);

      const approvalToken = await prisma.approvalToken.findUnique({
        where: { tokenHash },
        include: {
          post: {
            include: {
              brand: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                  logoUrl: true,
                },
              },
              media: {
                include: {
                  asset: {
                    select: {
                      id: true,
                      url: true,
                      thumbUrl: true,
                      kind: true,
                      width: true,
                      height: true,
                    },
                  },
                },
                orderBy: { position: 'asc' },
              },
              targets: {
                include: {
                  channel: {
                    select: {
                      id: true,
                      network: true,
                      handle: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
              reviews: {
                orderBy: { at: 'desc' },
                take: 5,
                select: {
                  id: true,
                  decision: true,
                  note: true,
                  postVersion: true,
                  at: true,
                },
              },
            },
          },
        },
      });

      if (!approvalToken || !approvalToken.post || approvalToken.post.deletedAt) {
        throw new AppError('REVIEW_NOT_FOUND', 'This review link is invalid or the post was removed.', 404);
      }

      const p = approvalToken.post;

      // Layer 3: Client Friendly Status Messages on Inactive / Outdated Links
      if (approvalToken.status === ApprovalTokenStatus.REVOKED) {
        return res.status(200).json({
          valid: false,
          reason: 'REVOKED',
          message: 'Yeh link ab valid nahi hai kyunki post update ho gayi hai. Agency aapko naya link bhejegi.',
          canRequestNewLink: true,
          post: {
            id: p.id,
            brand: p.brand,
            version: p.version,
            tokenVersion: approvalToken.postVersion,
          },
        });
      }

      if (approvalToken.status === ApprovalTokenStatus.USED) {
        return res.status(200).json({
          valid: false,
          reason: 'USED',
          message: 'Yeh post pehle hi approve ki ja chuki hai.',
          canRequestNewLink: false,
          post: {
            id: p.id,
            brand: p.brand,
            status: p.status,
            version: p.version,
          },
        });
      }

      if (new Date() > approvalToken.expiresAt) {
        return res.status(200).json({
          valid: false,
          reason: 'EXPIRED',
          message: 'Yeh review link expire ho chuka hai. Kripya agency se naya link mangwayein.',
          canRequestNewLink: true,
          post: {
            id: p.id,
            brand: p.brand,
          },
        });
      }

      // Check if post version has changed while token was ACTIVE
      if (approvalToken.postVersion !== p.version) {
        return res.status(200).json({
          valid: false,
          reason: 'VERSION_MISMATCH',
          message: 'Yeh link ab valid nahi hai kyunki post update ho gayi hai. Agency aapko naya link bhejegi.',
          canRequestNewLink: true,
          post: {
            id: p.id,
            brand: p.brand,
            version: p.version,
            tokenVersion: approvalToken.postVersion,
          },
        });
      }

      return res.status(200).json({
        valid: true,
        expiresAt: approvalToken.expiresAt,
        tokenVersion: approvalToken.postVersion,
        isLatestVersion: approvalToken.postVersion === p.version,
        post: {
          id: p.id,
          brand: p.brand,
          caption: p.caption,
          firstComment: p.firstComment,
          status: p.status,
          version: p.version,
          scheduledAt: p.scheduledAt,
          publishedAt: p.publishedAt,
          media: p.media.map((m) => ({
            assetId: m.asset.id,
            url: m.asset.url,
            thumbUrl: m.asset.thumbUrl,
            kind: m.asset.kind,
            altText: m.altText,
          })),
          networks: p.targets.map((t) => ({
            network: t.channel.network,
            handle: t.channel.handle,
            avatarUrl: t.channel.avatarUrl,
          })),
          recentReviews: p.reviews,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/public/review/:token/approve
 * Client approves post (Status atomically becomes SCHEDULED)
 */
reviewRouter.post(
  '/public/review/:token/approve',
  reviewRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.token;
      const tokenHash = hashToken(rawToken);

      // Validate & sanitize optional note
      const parsedApproval = clientApproveSchema.safeParse(req.body);
      if (!parsedApproval.success) {
        throw new AppError('VALIDATION_ERROR', parsedApproval.error.errors[0]?.message || 'Invalid note', 400);
      }
      const sanitizedNote = parsedApproval.data.note || 'Approved by client via zero-login review link';

      const approvalToken = await prisma.approvalToken.findUnique({
        where: { tokenHash },
        include: { post: true },
      });

      if (!approvalToken || !approvalToken.post || approvalToken.post.deletedAt) {
        throw new AppError('REVIEW_NOT_FOUND', 'This review link is invalid.', 404);
      }

      const post = approvalToken.post;

      // Layer 2: Strict Status and Expiry Check (Idempotent for rapid client taps)
      if (approvalToken.status === ApprovalTokenStatus.USED) {
        if (post.status === PostStatus.SCHEDULED || post.status === PostStatus.PUBLISHED) {
          return res.status(200).json({
            success: true,
            idempotent: true,
            status: post.status,
            message: 'Post pehle hi safaltapoorvak approve ho chuki hai.',
            post: {
              id: post.id,
              status: post.status,
              version: post.version,
            },
          });
        }

        return res.status(409).json({
          error: {
            code: 'TOKEN_ALREADY_USED',
            message: 'Yeh post pehle hi approve ki ja chuki hai.',
          },
        });
      }

      if (approvalToken.status === ApprovalTokenStatus.REVOKED) {
        return res.status(409).json({
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Yeh link ab valid nahi hai kyunki post update ho gayi hai. Agency aapko naya link bhejegi.',
          },
        });
      }

      if (new Date() > approvalToken.expiresAt) {
        return res.status(410).json({
          error: {
            code: 'REVIEW_EXPIRED',
            message: 'Yeh review link expire ho chuka hai. Kripya agency se naya link mangwayein.',
          },
        });
      }

      // Layer 2: Explicit Version Check before attempting update
      if (approvalToken.postVersion !== post.version) {
        return res.status(409).json({
          error: {
            code: 'POST_CHANGED',
            message: 'Yeh link ab valid nahi hai kyunki post update ho gayi hai. Agency aapko naya link bhejegi.',
          },
        });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
      const userAgent = req.headers['user-agent'] || null;

      // Layer 2: Atomic Execution with updateMany to prevent race conditions
      const approvalResult = await prisma.$transaction(async (tx) => {
        // Atomic compare-and-swap on post id and version
        const updated = await tx.post.updateMany({
          where: {
            id: post.id,
            version: approvalToken.postVersion,
            status: { in: [PostStatus.PENDING, PostStatus.CHANGES, PostStatus.DRAFT] },
          },
          data: {
            status: PostStatus.SCHEDULED,
          },
        });

        if (updated.count === 0) {
          throw new AppError(
            'POST_CHANGED',
            'Yeh link ab valid nahi hai kyunki post update ho gayi hai. Agency aapko naya link bhejegi.',
            409
          );
        }

        // Mark token as USED
        await tx.approvalToken.update({
          where: { id: approvalToken.id },
          data: {
            status: ApprovalTokenStatus.USED,
            usedAt: new Date(),
          },
        });

        // Record audit-complete Review record
        await tx.review.create({
          data: {
            postId: post.id,
            byId: 'client_review',
            decision: ReviewDecision.APPROVED,
            postVersion: approvalToken.postVersion,
            note: sanitizedNote,
            tokenId: approvalToken.id,
            ip: clientIp,
            userAgent: userAgent,
          },
        });

        // Record audit log
        await tx.auditLog.create({
          data: {
            workspaceId: post.workspaceId,
            actorId: 'client_review',
            action: 'post.approved_by_client',
            entity: 'Post',
            entityId: post.id,
            brandId: post.brandId,
            ip: clientIp,
            meta: {
              approvedVersion: approvalToken.postVersion,
              tokenId: approvalToken.id,
              userAgent,
              timestamp: new Date(),
            },
          },
        });

        return true;
      });

      logger.info({ postId: post.id, version: approvalToken.postVersion }, 'Post atomically approved by client');

      return res.status(200).json({
        success: true,
        status: PostStatus.SCHEDULED,
        message: 'Post approved successfully! It is now scheduled for publishing.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/public/review/:token/request-changes
 * Client requests changes on post (Status becomes CHANGES)
 */
reviewRouter.post(
  '/public/review/:token/request-changes',
  reviewRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.token;
      const tokenHash = hashToken(rawToken);

      // Validate & sanitize feedback note (min 3, max 1000, HTML-neutralized)
      const parsedChanges = clientRequestChangesSchema.safeParse(req.body);
      if (!parsedChanges.success) {
        throw new AppError('VALIDATION_ERROR', parsedChanges.error.errors[0]?.message || 'Please provide clear feedback', 400);
      }
      const sanitizedNote = parsedChanges.data.note;

      const approvalToken = await prisma.approvalToken.findUnique({
        where: { tokenHash },
        include: { post: true },
      });

      if (!approvalToken || !approvalToken.post || approvalToken.post.deletedAt) {
        throw new AppError('REVIEW_NOT_FOUND', 'This review link is invalid.', 404);
      }

      const post = approvalToken.post;

      if (approvalToken.status === ApprovalTokenStatus.REVOKED) {
        return res.status(409).json({
          error: {
            code: 'TOKEN_REVOKED',
            message: 'Yeh link ab valid nahi hai kyunki post update ho gayi hai. Agency aapko naya link bhejegi.',
          },
        });
      }

      if (approvalToken.status === ApprovalTokenStatus.USED) {
        return res.status(409).json({
          error: {
            code: 'TOKEN_ALREADY_USED',
            message: 'Yeh post pehle hi approve ho chuki hai.',
          },
        });
      }

      if (new Date() > approvalToken.expiresAt) {
        throw new AppError('REVIEW_EXPIRED', 'This review link has expired.', 410);
      }

      if (approvalToken.postVersion !== post.version) {
        return res.status(409).json({
          error: {
            code: 'POST_CHANGED',
            message: 'Yeh link ab valid nahi hai kyunki post update ho gayi hai. Agency aapko naya link bhejegi.',
          },
        });
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;
      const userAgent = req.headers['user-agent'] || null;

      await prisma.$transaction(async (tx) => {
        const updateRes = await tx.post.updateMany({
          where: {
            id: post.id,
            version: approvalToken.postVersion,
            status: { in: [PostStatus.PENDING, PostStatus.DRAFT] },
          },
          data: {
            status: PostStatus.CHANGES,
          },
        });

        if (updateRes.count === 0) {
          throw new AppError('POST_CHANGED', 'Post content or version changed.', 409);
        }

        await tx.approvalToken.update({
          where: { id: approvalToken.id },
          data: {
            feedback: sanitizedNote,
          },
        });

        await tx.review.create({
          data: {
            postId: post.id,
            byId: 'client_review',
            decision: ReviewDecision.CHANGES_REQUESTED,
            postVersion: approvalToken.postVersion,
            note: sanitizedNote,
            tokenId: approvalToken.id,
            ip: clientIp,
            userAgent: userAgent,
          },
        });

        await tx.auditLog.create({
          data: {
            workspaceId: post.workspaceId,
            actorId: 'client_review',
            action: 'post.changes_requested_by_client',
            entity: 'Post',
            entityId: post.id,
            brandId: post.brandId,
            ip: clientIp,
            meta: {
              feedback: sanitizedNote,
              version: approvalToken.postVersion,
              tokenId: approvalToken.id,
            },
          },
        });
      });

      logger.info({ postId: post.id }, 'Changes requested by client with version lock');

      return res.status(200).json({
        success: true,
        status: PostStatus.CHANGES,
        message: 'Feedback submitted to your agency team. They will update the post accordingly.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/public/review/:token/request-new-link
 * Client requests a fresh review link from agency when their link is revoked/expired
 */
reviewRouter.post(
  '/public/review/:token/request-new-link',
  reviewRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawToken = req.params.token;
      const tokenHash = hashToken(rawToken);

      const approvalToken = await prisma.approvalToken.findUnique({
        where: { tokenHash },
        include: { post: { include: { brand: true } } },
      });

      if (!approvalToken || !approvalToken.post) {
        throw new AppError('REVIEW_NOT_FOUND', 'This review link is invalid.', 404);
      }

      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip;

      // Create an audit log / notification entry for agency
      await prisma.auditLog.create({
        data: {
          workspaceId: approvalToken.post.workspaceId,
          actorId: 'client_review',
          action: 'review.new_link_requested',
          entity: 'Post',
          entityId: approvalToken.postId,
          brandId: approvalToken.post.brandId,
          ip: clientIp,
          meta: {
            tokenId: approvalToken.id,
            postVersion: approvalToken.post.version,
            tokenVersion: approvalToken.postVersion,
            reason: approvalToken.status,
          },
        },
      });

      logger.info({ postId: approvalToken.postId }, 'Client requested new review link from agency');

      return res.status(200).json({
        success: true,
        message: 'Agency ko naye link ki request bhej di gayi hai. Woh jald hi naya link bhejenge.',
      });
    } catch (err) {
      next(err);
    }
  }
);
