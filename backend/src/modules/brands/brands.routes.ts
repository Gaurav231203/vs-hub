import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { BrandsService } from './brands.service.js';
import { EmailService } from '../../lib/email.js';
import { getWebUrl } from '../../lib/urls.js';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export const brandsRouter = Router();

/**
 * POST /api/v1/brands
 * Admin creates a new brand with primary contact, timezone, and auto-generates first invite
 */
brandsRouter.post(
  '/brands',
  authenticate,
  tenantMiddleware,
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const baseUrl = getWebUrl(req);
      const result = await BrandsService.createBrand(ctx.workspaceId, ctx.userId, req.body, baseUrl);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/brands
 * List all brands in current workspace
 */
brandsRouter.get(
  '/brands',
  authenticate,
  tenantMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const brands = await BrandsService.listBrands(ctx.workspaceId, ctx.brandIds, ctx.allBrands);
      res.json({ brands });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/brands/email-status
 * Diagnostics endpoint to verify live email provider health (Brevo / Resend / SMTP) without exposing secrets
 */
brandsRouter.get(
  '/brands/email-status',
  authenticate,
  tenantMiddleware,
  requirePerm('channels.manage'),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const diagnostics = await EmailService.getDiagnostics();
      res.json(diagnostics);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/brands/test-email
 * Sends a diagnostic test email to confirm live inbox delivery
 */
brandsRouter.post(
  '/brands/test-email',
  authenticate,
  tenantMiddleware,
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const toEmail = String(req.body?.toEmail || '').trim();
      if (!toEmail || !toEmail.includes('@')) {
        res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Valid toEmail is required' } });
        return;
      }
      const delivery = await EmailService.sendConnectInvite({
        toEmail,
        clientName: 'Admin Test',
        brandName: 'Diagnostic Test Brand',
        agencyName: 'VS Adda',
        inviteUrl: `${getWebUrl(req)}/channels`,
        expiresInDays: 7,
      });
      res.status(delivery.sent ? 200 : 502).json({ emailDelivery: delivery });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/v1/brands/:id
 * Get single brand details
 */
brandsRouter.get(
  '/brands/:id',
  authenticate,
  tenantMiddleware,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const brand = await BrandsService.getBrand(ctx.workspaceId, req.params.id);
      res.json({ brand });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/brands/:id/invite
 * Generate/Resend fresh invite for brand (auto-revoking any older active invites)
 */
brandsRouter.post(
  '/brands/:id/invite',
  authenticate,
  tenantMiddleware,
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const baseUrl = getWebUrl(req);
      const expiresInDays = req.body.expiresInDays ? Number(req.body.expiresInDays) : 7;
      const emailOverride = typeof req.body?.email === 'string' ? req.body.email : undefined;
      const result = await BrandsService.generateInvite(
        ctx.workspaceId,
        req.params.id,
        ctx.userId,
        expiresInDays,
        baseUrl,
        emailOverride
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/v1/brands/:id
 * Delete brand and all related resources
 */
brandsRouter.delete(
  '/brands/:id',
  authenticate,
  tenantMiddleware,
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = req.ctx!;
      const result = await BrandsService.deleteBrand(ctx.workspaceId, req.params.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/v1/brands/clean-dummy
 * Remove all hardcoded seeded demo brands (Hollow Home, Vantage Garage, Acme, Starlight, etc.)
 */
brandsRouter.post(
  '/brands/clean-dummy',
  authenticate,
  tenantMiddleware,
  requirePerm('channels.manage'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dummyNames = [
        'Hollow Home',
        'Vantage Garage',
        'Starlight Bakery',
        'Acme Corp',
        'Zenith Fitness',
        'Nexus Tech',
        'Wildroot Botanics',
        'Northlight Studio',
      ];

      const dummyBrands = await prisma.brand.findMany({
        where: {
          workspaceId: req.ctx!.workspaceId,
          name: { in: dummyNames },
        },
        select: { id: true, name: true },
      });

      const deleted: string[] = [];
      for (const b of dummyBrands) {
        try {
          await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);
          await prisma.$executeRawUnsafe(`DELETE FROM PostTarget WHERE channelId IN (SELECT id FROM Channel WHERE brandId = '${b.id}') OR postId IN (SELECT id FROM Post WHERE brandId = '${b.id}');`);
          await prisma.$executeRawUnsafe(`DELETE FROM PublishJob WHERE postId IN (SELECT id FROM Post WHERE brandId = '${b.id}');`);
          await prisma.$executeRawUnsafe(`DELETE FROM PostMedia WHERE postId IN (SELECT id FROM Post WHERE brandId = '${b.id}');`);
          await prisma.$executeRawUnsafe(`DELETE FROM Review WHERE postId IN (SELECT id FROM Post WHERE brandId = '${b.id}');`);
          await prisma.$executeRawUnsafe(`DELETE FROM ApprovalToken WHERE postId IN (SELECT id FROM Post WHERE brandId = '${b.id}');`);
          await prisma.$executeRawUnsafe(`DELETE FROM Post WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM MetricDaily WHERE channelId IN (SELECT id FROM Channel WHERE brandId = '${b.id}');`);
          await prisma.$executeRawUnsafe(`DELETE FROM Message WHERE conversationId IN (SELECT id FROM Conversation WHERE channelId IN (SELECT id FROM Channel WHERE brandId = '${b.id}'));`);
          await prisma.$executeRawUnsafe(`DELETE FROM Conversation WHERE channelId IN (SELECT id FROM Channel WHERE brandId = '${b.id}');`);
          await prisma.$executeRawUnsafe(`DELETE FROM Channel WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM ConnectInvite WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM BrandContact WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM MembershipBrand WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM MediaAsset WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM Campaign WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM Mention WHERE keywordId IN (SELECT id FROM Keyword WHERE brandId = '${b.id}');`);
          await prisma.$executeRawUnsafe(`DELETE FROM Keyword WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM HashtagSet WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM OAuthSession WHERE brandId = '${b.id}';`);
          await prisma.$executeRawUnsafe(`DELETE FROM Brand WHERE id = '${b.id}';`);
          await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`);
          deleted.push(b.name);
        } catch (e: any) {
          logger.error({ e: e.message }, `Failed to clean dummy brand ${b.name}`);
        }
      }

      res.json({ success: true, deleted });
    } catch (err) {
      next(err);
    }
  }
);

