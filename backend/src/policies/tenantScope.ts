import { UserContext } from '@postdesk/shared';

export function tenantScope(ctx: UserContext, brandIdFilter?: string | null) {
  const base: any = {
    workspaceId: ctx.workspaceId,
  };

  if (brandIdFilter) {
    if (!ctx.allBrands && !ctx.brandIds.includes(brandIdFilter)) {
      // Force empty match if requested brand is not permitted
      base.brandId = 'none';
    } else {
      base.brandId = brandIdFilter;
    }
  } else if (!ctx.allBrands) {
    base.brandId = { in: ctx.brandIds };
  }

  return base;
}
