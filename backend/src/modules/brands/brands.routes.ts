import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { BrandsService } from './brands.service.js';

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
      const result = await BrandsService.createBrand(ctx.workspaceId, ctx.userId, req.body);
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
      const expiresInDays = req.body.expiresInDays ? Number(req.body.expiresInDays) : 7;
      const result = await BrandsService.generateInvite(
        ctx.workspaceId,
        req.params.id,
        ctx.userId,
        expiresInDays
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

