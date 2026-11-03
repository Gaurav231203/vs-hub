import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { ROLE_PERMISSIONS, UserContext } from '@postdesk/shared';
import { AppError } from './error.js';

export async function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId || !req.workspaceId) {
    return next(new AppError('UNAUTHENTICATED', 'Missing authentication context', 401));
  }

  try {
    const membership = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: req.workspaceId,
          userId: req.userId,
        },
      },
      include: {
        brands: true,
      },
    });

    if (!membership) {
      return next(new AppError('FORBIDDEN', 'User is not a member of this workspace', 403));
    }

    if (membership.status === 'SUSPENDED') {
      return next(new AppError('FORBIDDEN', 'Your account has been suspended by an administrator', 403));
    }

    let brandIds: string[] = [];
    if (membership.allBrands) {
      const allBrands = await prisma.brand.findMany({
        where: { workspaceId: req.workspaceId },
        select: { id: true },
      });
      brandIds = allBrands.map((b) => b.id);
    } else {
      brandIds = membership.brands.map((b) => b.brandId);
    }

    const perms = ROLE_PERMISSIONS[membership.role] || [];

    const ctx: UserContext = {
      userId: req.userId,
      workspaceId: req.workspaceId,
      role: membership.role,
      perms,
      allBrands: membership.allBrands,
      brandIds,
    };

    req.ctx = ctx;
    next();
  } catch (err) {
    next(err);
  }
}
