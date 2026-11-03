import { prisma } from '../../lib/prisma.js';
import { UserContext } from '@postdesk/shared';
import { AppError } from '../../middleware/error.js';
import { StorageService } from '../../lib/storage.js';

export class LibraryService {
  private static getBrandScope(ctx: UserContext, brandId?: string) {
    if (brandId) {
      if (!ctx.allBrands && !ctx.brandIds.includes(brandId)) {
        throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
      }
      return { brandId };
    }
    if (!ctx.allBrands) {
      return { brandId: { in: ctx.brandIds } };
    }
    return {};
  }

  // --- 1. MEDIA ASSETS ---
  static async listAssets(
    ctx: UserContext,
    query: {
      brandId?: string;
      starred?: boolean;
      kind?: string;
      search?: string;
      sort?: 'newest' | 'most_used';
      page?: number;
      limit?: number;
    }
  ) {
    const brandScope = this.getBrandScope(ctx, query.brandId);
    const { starred, kind, search, sort = 'newest', page = 1, limit = 40 } = query;

    const where: any = {
      workspaceId: ctx.workspaceId,
      ...brandScope,
      ...(starred !== undefined ? { starred } : {}),
      ...(kind ? { kind } : {}),
    };

    if (search && search.trim()) {
      where.title = { contains: search.trim() };
    }

    const [total, assets] = await Promise.all([
      prisma.mediaAsset.count({ where }),
      prisma.mediaAsset.findMany({
        where,
        orderBy:
          sort === 'most_used'
            ? { usedIn: { _count: 'desc' } }
            : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          brand: { select: { id: true, name: true, color: true } },
          _count: { select: { usedIn: true } },
          usedIn: {
            take: 10,
            include: {
              post: {
                select: {
                  id: true,
                  caption: true,
                  status: true,
                  scheduledAt: true,
                  publishedAt: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      items: assets.map((a) => ({
        ...a,
        usageCount: a._count.usedIn,
        posts: a.usedIn.map((u) => u.post),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async createAsset(
    ctx: UserContext,
    data: {
      brandId: string;
      title: string;
      kind: 'IMAGE' | 'VIDEO';
      url: string;
      thumbUrl?: string;
      tags?: string[];
      width?: number;
      height?: number;
      bytes: number;
    }
  ) {
    if (!ctx.allBrands && !ctx.brandIds.includes(data.brandId)) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    return prisma.mediaAsset.create({
      data: {
        workspaceId: ctx.workspaceId,
        brandId: data.brandId,
        title: data.title.trim(),
        kind: data.kind,
        url: data.url,
        thumbUrl: data.thumbUrl,
        tags: data.tags || [],
        width: data.width,
        height: data.height,
        bytes: data.bytes,
      },
      include: {
        brand: true,
      },
    });
  }

  static async generateUploadUrl(
    ctx: UserContext,
    input: {
      brandId: string;
      filename: string;
      contentType: string;
      byteSize: number;
    }
  ) {
    if (!ctx.allBrands && !ctx.brandIds.includes(input.brandId)) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    const brand = await prisma.brand.findFirst({
      where: { id: input.brandId, workspaceId: ctx.workspaceId },
    });
    if (!brand) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    return StorageService.generatePresignedUploadUrl({
      workspaceId: ctx.workspaceId,
      brandId: input.brandId,
      filename: input.filename,
      contentType: input.contentType,
      byteSize: input.byteSize,
    });
  }

  static async confirmUpload(
    ctx: UserContext,
    data: {
      brandId: string;
      title: string;
      kind: 'IMAGE' | 'VIDEO';
      publicUrl: string;
      key: string;
      byteSize: number;
      contentType: string;
      width?: number;
      height?: number;
      thumbUrl?: string;
      tags?: string[];
    }
  ) {
    if (!ctx.allBrands && !ctx.brandIds.includes(data.brandId)) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    const brand = await prisma.brand.findFirst({
      where: { id: data.brandId, workspaceId: ctx.workspaceId },
    });
    if (!brand) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    // Verify key ownership structure: media/{workspaceId}/{brandId}/...
    if (!data.key.startsWith(`media/${ctx.workspaceId}/${data.brandId}/`)) {
      throw new AppError('FORBIDDEN', 'Media key does not match target brand or workspace', 403);
    }

    const asset = await prisma.mediaAsset.create({
      data: {
        workspaceId: ctx.workspaceId,
        brandId: data.brandId,
        title: data.title.trim() || 'Uploaded Media',
        kind: data.kind,
        url: data.publicUrl,
        thumbUrl: data.thumbUrl || null,
        tags: data.tags || [],
        width: data.width || null,
        height: data.height || null,
        bytes: data.byteSize,
      },
      include: {
        brand: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        workspaceId: ctx.workspaceId,
        actorId: ctx.userId,
        action: 'asset.uploaded',
        entity: 'MediaAsset',
        entityId: asset.id,
        brandId: data.brandId,
        meta: { url: asset.url, bytes: asset.bytes, kind: asset.kind },
      },
    });

    return asset;
  }

  static async updateAsset(
    ctx: UserContext,
    id: string,
    data: { title?: string; starred?: boolean; tags?: string[] }
  ) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!asset) throw new AppError('ASSET_NOT_FOUND', 'Asset not found', 404);

    if (!ctx.allBrands && !ctx.brandIds.includes(asset.brandId)) {
      throw new AppError('ASSET_NOT_FOUND', 'Asset not found', 404);
    }

    return prisma.mediaAsset.update({
      where: { id },
      data,
    });
  }

  static async deleteAsset(ctx: UserContext, id: string) {
    const asset = await prisma.mediaAsset.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!asset) throw new AppError('ASSET_NOT_FOUND', 'Asset not found', 404);

    if (!ctx.allBrands && !ctx.brandIds.includes(asset.brandId)) {
      throw new AppError('ASSET_NOT_FOUND', 'Asset not found', 404);
    }

    return prisma.mediaAsset.delete({ where: { id } });
  }

  // --- 2. TEMPLATES ---
  static async listTemplates(ctx: UserContext, brandId?: string) {
    const brandScope = this.getBrandScope(ctx, brandId);

    return prisma.template.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        OR: [{ brandId: null }, brandScope],
      },
      orderBy: { title: 'asc' },
    });
  }

  static async createTemplate(
    ctx: UserContext,
    data: { title: string; body: string; brandId?: string }
  ) {
    if (data.brandId && !ctx.allBrands && !ctx.brandIds.includes(data.brandId)) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    return prisma.template.create({
      data: {
        workspaceId: ctx.workspaceId,
        brandId: data.brandId || null,
        title: data.title.trim(),
        body: data.body.trim(),
      },
    });
  }

  static async updateTemplate(
    ctx: UserContext,
    id: string,
    data: { title?: string; body?: string }
  ) {
    const template = await prisma.template.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!template) throw new AppError('TEMPLATE_NOT_FOUND', 'Template not found', 404);

    return prisma.template.update({
      where: { id },
      data,
    });
  }

  static async deleteTemplate(ctx: UserContext, id: string) {
    const template = await prisma.template.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!template) throw new AppError('TEMPLATE_NOT_FOUND', 'Template not found', 404);

    return prisma.template.delete({ where: { id } });
  }

  // --- 3. HASHTAG SETS ---
  static async listHashtagSets(ctx: UserContext, brandId?: string) {
    const brandScope = this.getBrandScope(ctx, brandId);

    return prisma.hashtagSet.findMany({
      where: brandScope,
      include: {
        brand: { select: { id: true, name: true, color: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  static async createHashtagSet(
    ctx: UserContext,
    data: { brandId: string; name: string; tags: string[] }
  ) {
    if (!ctx.allBrands && !ctx.brandIds.includes(data.brandId)) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    return prisma.hashtagSet.create({
      data: {
        brandId: data.brandId,
        name: data.name.trim(),
        tags: data.tags,
      },
      include: { brand: true },
    });
  }

  static async updateHashtagSet(
    ctx: UserContext,
    id: string,
    data: { name?: string; tags?: string[] }
  ) {
    const set = await prisma.hashtagSet.findUnique({
      where: { id },
      include: { brand: true },
    });
    if (!set) throw new AppError('HASHTAG_SET_NOT_FOUND', 'Hashtag set not found', 404);

    if (!ctx.allBrands && !ctx.brandIds.includes(set.brandId)) {
      throw new AppError('HASHTAG_SET_NOT_FOUND', 'Hashtag set not found', 404);
    }

    return prisma.hashtagSet.update({
      where: { id },
      data,
    });
  }

  static async deleteHashtagSet(ctx: UserContext, id: string) {
    const set = await prisma.hashtagSet.findUnique({
      where: { id },
      include: { brand: true },
    });
    if (!set) throw new AppError('HASHTAG_SET_NOT_FOUND', 'Hashtag set not found', 404);

    if (!ctx.allBrands && !ctx.brandIds.includes(set.brandId)) {
      throw new AppError('HASHTAG_SET_NOT_FOUND', 'Hashtag set not found', 404);
    }

    return prisma.hashtagSet.delete({ where: { id } });
  }

  // --- 4. SAVED REPLIES ---
  static async listSavedReplies(ctx: UserContext) {
    return prisma.savedReply.findMany({
      where: { workspaceId: ctx.workspaceId },
      orderBy: { title: 'asc' },
    });
  }

  static async createSavedReply(ctx: UserContext, data: { title: string; body: string }) {
    return prisma.savedReply.create({
      data: {
        workspaceId: ctx.workspaceId,
        title: data.title.trim(),
        body: data.body.trim(),
      },
    });
  }

  static async updateSavedReply(
    ctx: UserContext,
    id: string,
    data: { title?: string; body?: string }
  ) {
    const reply = await prisma.savedReply.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!reply) throw new AppError('SAVED_REPLY_NOT_FOUND', 'Saved reply not found', 404);

    return prisma.savedReply.update({
      where: { id },
      data,
    });
  }

  static async deleteSavedReply(ctx: UserContext, id: string) {
    const reply = await prisma.savedReply.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!reply) throw new AppError('SAVED_REPLY_NOT_FOUND', 'Saved reply not found', 404);

    return prisma.savedReply.delete({ where: { id } });
  }
}
