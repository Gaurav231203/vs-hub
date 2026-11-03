import { Request, Response, NextFunction } from 'express';
import { Permission } from '@postdesk/shared';
import { AppError } from './error.js';

export function requirePerm(perm: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.ctx) {
      return next(new AppError('UNAUTHENTICATED', 'Missing authentication context', 401));
    }

    if (!req.ctx.perms.includes(perm)) {
      return next(
        new AppError(
          'FORBIDDEN',
          `You do not have the required permission (${perm}) to perform this action`,
          403
        )
      );
    }

    next();
  };
}

export function assertBrandAccess(ctx: Request['ctx'], brandId: string) {
  if (!ctx) {
    throw new AppError('UNAUTHENTICATED', 'Missing authentication context', 401);
  }

  if (ctx.allBrands) return true;

  if (!ctx.brandIds.includes(brandId)) {
    // Critical Rule 5: Resource outside tenant scope returns 404 (not 403) to prevent ID probing
    throw new AppError('NOT_FOUND', 'Brand or resource not found', 404);
  }

  return true;
}
