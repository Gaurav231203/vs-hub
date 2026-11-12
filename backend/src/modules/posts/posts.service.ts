import { prisma } from '../../lib/prisma.js';
import { UserContext, requiresApproval } from '@postdesk/shared';
import { PostStatus } from '@prisma/client';
import { AppError } from '../../middleware/error.js';
import { validatePostContent } from '../../lib/validation.js';
import { transitionPost } from './posts.transitions.js';
import { handlePublishTarget } from '../../jobs/handlers/publishTarget.js';

function validateScheduledDate(dateInput: any): Date | null {
  if (dateInput === undefined || dateInput === null) return null;
  const parsedDate = new Date(dateInput);
  const now = Date.now();
  if (
    isNaN(parsedDate.getTime()) ||
    parsedDate.getTime() < now + 5 * 60_000 ||
    parsedDate.getTime() > now + 365 * 86_400_000
  ) {
    throw new AppError(
      'VALIDATION_ERROR',
      'scheduledAt must be at least 5 minutes in the future and at most 1 year ahead',
      400
    );
  }
  return parsedDate;
}

function validateChannelIds(channelIds: any): string[] | undefined {
  if (channelIds === undefined) return undefined;
  if (!Array.isArray(channelIds)) {
    throw new AppError('VALIDATION_ERROR', 'channelIds must be an array of channel ID strings', 400);
  }
  for (const cid of channelIds) {
    if (typeof cid !== 'string' || cid.trim().length === 0) {
      throw new AppError('VALIDATION_ERROR', 'All channelIds must be non-empty strings', 400);
    }
  }
  return channelIds;
}

async function syncPostMedia(
  tx: any,
  postId: string,
  workspaceId: string,
  brandId: string,
  media?: Array<{ assetId: string; position: number; altText?: string | null }>,
  mediaUrls?: string[]
) {
  if (Array.isArray(media) && media.length > 0) {
    await tx.postMedia.deleteMany({ where: { postId } });
    for (const m of media) {
      await tx.postMedia.create({
        data: {
          postId,
          assetId: m.assetId,
          position: m.position,
          altText: m.altText || null,
        },
      });
    }
  } else if (Array.isArray(mediaUrls)) {
    await tx.postMedia.deleteMany({ where: { postId } });
    for (let i = 0; i < mediaUrls.length; i++) {
      const url = mediaUrls[i];
      if (!url || typeof url !== 'string') continue;
      let asset = await tx.mediaAsset.findFirst({
        where: { workspaceId, url },
      });
      if (!asset) {
        asset = await tx.mediaAsset.create({
          data: {
            workspaceId,
            brandId,
            title: `Media ${i + 1}`,
            kind: url.match(/\.(mp4|mov|webm)(\?|$)/i) ? 'VIDEO' : 'IMAGE',
            url,
            bytes: 1024,
            tags: [],
          },
        });
      }
      await tx.postMedia.create({
        data: {
          postId,
          assetId: asset.id,
          position: i,
        },
      });
    }
  } else if (Array.isArray(media)) {
    await tx.postMedia.deleteMany({ where: { postId } });
  }
}

export class PostsService {
  static async create(ctx: UserContext, input: any) {
    if (!ctx.allBrands && !ctx.brandIds.includes(input.brandId)) {
      throw new AppError('NOT_FOUND', 'Brand not found or access denied', 404);
    }

    const brand = await prisma.brand.findUnique({
      where: { id: input.brandId },
    });
    if (!brand || brand.workspaceId !== ctx.workspaceId) {
      throw new AppError('NOT_FOUND', 'Brand not found', 404);
    }

    const scheduledAt = validateScheduledDate(input.scheduledAt);
    const channelIds = validateChannelIds(input.channelIds);

    // Strict Multi-Tenant Boundary: Validate that all target channels belong to this brand & workspace
    if (Array.isArray(channelIds) && channelIds.length > 0) {
      const validChannels = await prisma.channel.findMany({
        where: {
          id: { in: channelIds },
          workspaceId: ctx.workspaceId,
          brandId: input.brandId,
        },
        select: { id: true },
      });

      if (validChannels.length !== channelIds.length) {
        throw new AppError(
          'INVALID_CHANNELS',
          'One or more selected channels do not exist or do not belong to this brand/workspace.',
          403
        );
      }
    }

    const post = await prisma.$transaction(async (tx) => {
      const created = await tx.post.create({
        data: {
          workspaceId: ctx.workspaceId,
          brandId: input.brandId,
          authorId: ctx.userId,
          campaignId: input.campaignId || null,
          caption: input.caption || '',
          firstComment: input.firstComment || null,
          status: 'DRAFT',
          scheduledAt,
          publishMode: input.publishMode || 'AUTOMATIC',
          version: 1,
        },
      });

      // Targets (bulk insert avoids multiple round-trips inside transaction)
      if (Array.isArray(input.channelIds) && input.channelIds.length > 0) {
        await tx.postTarget.createMany({
          data: input.channelIds.map((channelId: string) => ({
            postId: created.id,
            channelId,
            status: 'QUEUED',
          })),
        });
      }

      // Media
      await syncPostMedia(tx, created.id, ctx.workspaceId, input.brandId, input.media, input.mediaUrls);

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.created',
          entity: 'Post',
          entityId: created.id,
          brandId: input.brandId,
          meta: { status: 'DRAFT' },
        },
      });

      return created;
    }, { timeout: 20000, maxWait: 10000 });

    return await this.getById(ctx, post.id);
  }

  static async list(ctx: UserContext, filters: { brandId?: string; status?: any; limit?: number }) {
    const where: any = {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
    };

    if (filters.brandId && filters.brandId !== 'all') {
      where.brandId = filters.brandId;
    } else if (!ctx.allBrands) {
      where.brandId = { in: ctx.brandIds };
    }

    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: [
        { publishedAt: 'desc' },
        { scheduledAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: filters.limit || 50,
      include: {
        brand: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            title: true,
          },
        },
        targets: {
          include: {
            channel: true,
          },
        },
        media: {
          include: {
            asset: true,
          },
        },
      },
    });

    return posts;
  }

  static async getById(ctx: UserContext, id: string) {
    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        brand: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            title: true,
          },
        },
        campaign: true,
        media: {
          orderBy: { position: 'asc' },
          include: { asset: true },
        },
        targets: {
          include: {
            channel: true,
          },
        },
        reviews: {
          where: { voided: false },
          orderBy: { at: 'desc' },
        },
      },
    });

    if (!post || post.workspaceId !== ctx.workspaceId || post.deletedAt) {
      throw new AppError('NOT_FOUND', 'Post not found', 404);
    }

    if (!ctx.allBrands && !ctx.brandIds.includes(post.brandId)) {
      throw new AppError('NOT_FOUND', 'Post not found', 404);
    }

    return post;
  }

  static async update(ctx: UserContext, id: string, input: any) {
    const post = await this.getById(ctx, id);

    // Read-only state check
    if (post.status === 'PUBLISHING' || post.status === 'PUBLISHED') {
      throw new AppError('CONFLICT', 'Published or currently publishing posts cannot be edited', 409);
    }

    // Version check if provided
    if (input.version && input.version !== post.version) {
      throw new AppError('CONFLICT', 'Post content was modified by another user. Please reload.', 409);
    }

    // Determine workspace approval mode
    const workspace = await prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
    });
    const needsApproval = requiresApproval(ctx, workspace?.approvalMode || 'BY_ROLE');

    let newStatus = post.status;
    let bumpedVersion = post.version;
    let auditAction = 'post.updated';

    // Layer 1: Post Edit Invalidation Rules
    const isContentEdited =
      (input.caption !== undefined && input.caption !== post.caption) ||
      (input.firstComment !== undefined && input.firstComment !== post.firstComment) ||
      (input.campaignId !== undefined && input.campaignId !== post.campaignId) ||
      input.channelIds !== undefined ||
      input.media !== undefined ||
      input.mediaUrls !== undefined ||
      (input.scheduledAt !== undefined &&
        (input.scheduledAt ? new Date(input.scheduledAt).getTime() : null) !==
          (post.scheduledAt ? post.scheduledAt.getTime() : null));

    if (isContentEdited || post.status === 'PENDING' || post.status === 'SCHEDULED') {
      bumpedVersion = post.version + 1;

      if (post.status === 'SCHEDULED') {
        // Revert to DRAFT per user requirement
        newStatus = 'DRAFT';
        auditAction = 'post.reverted_to_draft_on_edit';
      } else if (post.status === 'PENDING') {
        auditAction = 'post.reapproval_required';
      }
    }

    const scheduledAt =
      input.scheduledAt !== undefined ? validateScheduledDate(input.scheduledAt) : post.scheduledAt;
    const channelIds = validateChannelIds(input.channelIds);

    // Validate channel ownership BEFORE opening transaction to avoid holding locks across network latency
    if (Array.isArray(channelIds) && channelIds.length > 0) {
      const validChannels = await prisma.channel.findMany({
        where: {
          id: { in: channelIds },
          workspaceId: ctx.workspaceId,
          brandId: post.brandId,
        },
        select: { id: true },
      });

      if (validChannels.length !== channelIds.length) {
        throw new AppError(
          'INVALID_CHANNELS',
          'One or more selected channels do not exist or do not belong to this brand/workspace.',
          403
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      // a) Update post record
      await tx.post.update({
        where: { id },
        data: {
          caption: input.caption !== undefined ? input.caption : post.caption,
          firstComment: input.firstComment !== undefined ? input.firstComment : post.firstComment,
          campaignId: input.campaignId !== undefined ? input.campaignId : post.campaignId,
          scheduledAt,
          publishMode: input.publishMode !== undefined ? input.publishMode : post.publishMode,
          status: newStatus as PostStatus,
          version: bumpedVersion,
        },
      });

      // b) Revoke active review tokens only if post was under review/scheduled
      if (post.status === 'PENDING' || post.status === 'SCHEDULED') {
        await tx.approvalToken.updateMany({
          where: { postId: id, status: 'ACTIVE' },
          data: { status: 'REVOKED', revokedAt: new Date() },
        });
      }

      // c) Purge queued publish jobs only when editing a previously scheduled post
      if (post.status === 'SCHEDULED') {
        await tx.publishJob.deleteMany({
          where: { postId: id, status: 'QUEUED' },
        });

        await tx.job.deleteMany({
          where: {
            status: 'QUEUED',
            payload: {
              path: '$.postId',
              equals: id,
            },
          },
        });
      }

      // Update channels if provided
      if (Array.isArray(channelIds)) {
        await tx.postTarget.deleteMany({ where: { postId: id } });
        if (channelIds.length > 0) {
          await tx.postTarget.createMany({
            data: channelIds.map((chId) => ({
              postId: id,
              channelId: chId,
              status: 'QUEUED',
            })),
          });
        }
      }

      // Update media if provided
      if (input.media !== undefined || input.mediaUrls !== undefined) {
        await syncPostMedia(tx, id, ctx.workspaceId, post.brandId, input.media, input.mediaUrls);
      }

      if (post.status === 'SCHEDULED' || post.status === 'PENDING') {
        await tx.review.create({
          data: {
            postId: id,
            byId: ctx.userId,
            decision: 'SUBMITTED',
            note: 'Content edited after sign-off link created - review links revoked and re-approval required',
            postVersion: bumpedVersion,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: auditAction,
          entity: 'Post',
          entityId: id,
          brandId: post.brandId,
          meta: { previousStatus: post.status, newStatus, version: bumpedVersion },
        },
      });
    }, { timeout: 20000, maxWait: 10000 });

    return await this.getById(ctx, id);
  }

  static async delete(ctx: UserContext, id: string) {
    const post = await this.getById(ctx, id);

    // Own-resource rule: author can delete own post. Others need post.delete
    if (post.authorId !== ctx.userId && !ctx.perms.includes('post.delete')) {
      throw new AppError('FORBIDDEN', 'You do not have permission to delete this post', 403);
    }

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.deleted',
          entity: 'Post',
          entityId: id,
          brandId: post.brandId,
        },
      });
    });

    return { success: true, message: 'Post moved to trash' };
  }

  static async submitForReview(ctx: UserContext, id: string) {
    return this.submit(ctx, id);
  }

  static async submit(ctx: UserContext, id: string) {
    const post = await this.getById(ctx, id);

    if (post.status !== 'DRAFT' && post.status !== 'CHANGES') {
      throw new AppError('CONFLICT', `Cannot submit post with status ${post.status}`, 409);
    }

    // Run validation
    const channels = post.targets.map((t) => ({
      id: t.channel.id,
      network: t.channel.network,
      handle: t.channel.handle,
      status: t.channel.status,
      postingEnabled: t.channel.postingEnabled,
    }));

    const media = post.media.map((m) => ({
      kind: m.asset.kind,
      url: m.asset.url,
    }));

    const issues = validatePostContent({
      caption: post.caption,
      channels,
      media,
      scheduledAt: post.scheduledAt,
      isSubmitting: true,
    });

    const errors = issues.filter((i) => i.severity === 'error');
    if (errors.length > 0) {
      throw new AppError('VALIDATION', 'Validation failed: ' + errors[0].message, 422, { issues });
    }

    // Verify at least 1 channel attached before submitting for review
    if (!post.targets || post.targets.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Post must have at least one channel before submitting for review', 400);
    }

    // Check if an eligible approver exists for this brand (03_LOGIC.md §4)
    const approversCount = await prisma.membership.count({
      where: {
        workspaceId: ctx.workspaceId,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN', 'MANAGER', 'CLIENT'] },
        OR: [
          { allBrands: true },
          { brands: { some: { brandId: post.brandId } } },
        ],
      },
    });

    if (approversCount === 0) {
      throw new AppError(
        'NO_APPROVER',
        'No eligible approver exists for this brand. Please ask an administrator to assign a manager or client approver.',
        422
      );
    }

    await prisma.$transaction(async (tx) => {
      await transitionPost(tx, {
        postId: id,
        workspaceId: ctx.workspaceId,
        from: [PostStatus.DRAFT, PostStatus.CHANGES],
        to: PostStatus.PENDING,
      });

      await tx.review.create({
        data: {
          postId: id,
          byId: ctx.userId,
          decision: 'SUBMITTED',
          postVersion: post.version,
          note: 'Submitted for sign-off',
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.submitted',
          entity: 'Post',
          entityId: id,
          brandId: post.brandId,
        },
      });
    });

    return await this.getById(ctx, id);
  }

  static async withdraw(ctx: UserContext, id: string) {
    const post = await this.getById(ctx, id);

    if (post.status !== 'PENDING') {
      throw new AppError('CONFLICT', `Cannot withdraw post with status ${post.status}`, 409);
    }

    // Only author or admin can withdraw
    if (post.authorId !== ctx.userId && ctx.role !== 'OWNER' && ctx.role !== 'ADMIN') {
      throw new AppError('FORBIDDEN', 'Only the post author may withdraw a pending submission', 403);
    }

    await prisma.$transaction(async (tx) => {
      await transitionPost(tx, {
        postId: id,
        workspaceId: ctx.workspaceId,
        from: PostStatus.PENDING,
        to: PostStatus.DRAFT,
      });

      await tx.review.create({
        data: {
          postId: id,
          byId: ctx.userId,
          decision: 'WITHDRAWN',
          postVersion: post.version,
          note: 'Submission withdrawn by author',
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.withdrawn',
          entity: 'Post',
          entityId: id,
          brandId: post.brandId,
        },
      });
    });

    return await this.getById(ctx, id);
  }

  static async schedule(ctx: UserContext, id: string) {
    const post = await this.getById(ctx, id);

    const workspace = await prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
    });
    if (requiresApproval(ctx, workspace?.approvalMode || 'BY_ROLE')) {
      throw new AppError('FORBIDDEN', 'Your role requires approval. Please submit for sign-off instead.', 403);
    }

    if (!post.scheduledAt || post.scheduledAt.getTime() < Date.now() + 5 * 60 * 1000) {
      throw new AppError('VALIDATION', 'Scheduling requires a date at least 5 minutes in the future', 422);
    }

    await prisma.$transaction(async (tx) => {
      await transitionPost(tx, {
        postId: id,
        workspaceId: ctx.workspaceId,
        from: [PostStatus.DRAFT, PostStatus.PENDING],
        to: PostStatus.SCHEDULED,
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.scheduled',
          entity: 'Post',
          entityId: id,
          brandId: post.brandId,
        },
      });
    });

    return await this.getById(ctx, id);
  }

  static async publishNow(ctx: UserContext, id: string) {
    const post = await this.getById(ctx, id);
    if (!post) {
      throw new AppError('POST_NOT_FOUND', 'Post not found', 404);
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
    });
    if (requiresApproval(ctx, workspace?.approvalMode || 'BY_ROLE')) {
      throw new AppError('FORBIDDEN', 'Your role requires approval before publishing.', 403);
    }

    if (!post.targets || post.targets.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Please select at least one channel to publish to.', 400);
    }

    if (!post.caption?.trim() && (!post.media || post.media.length === 0)) {
      throw new AppError('VALIDATION_ERROR', 'Please write a caption or attach media before publishing.', 400);
    }

    const now = new Date();
    await prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.PUBLISHING,
        scheduledAt: now,
      },
    });

    const errors: string[] = [];
    for (const t of post.targets) {
      try {
        await handlePublishTarget({ targetId: t.id, postId: id });
      } catch (err: any) {
        errors.push(`${t.channel?.network || 'Channel'} (${t.channel?.handle || ''}): ${err.message}`);
      }
    }

    const updatedPost = await this.getById(ctx, id);
    if (errors.length > 0 && (updatedPost.status === 'FAILED' || errors.length === post.targets.length)) {
      throw new AppError('PUBLISH_FAILED', `Publishing failed: ${errors.join(' | ')}`, 502);
    }

    return { post: updatedPost, warnings: errors };
  }

  static async publishManually(ctx: UserContext, id: string) {
    const post = await this.getById(ctx, id);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
          publishMode: 'MANUAL',
        },
      });

      for (const t of post.targets) {
        await tx.postTarget.update({
          where: { id: t.id },
          data: {
            status: 'PUBLISHED',
            externalPostId: `manual_${Date.now()}_${t.channel?.network || 'post'}`,
            publishedAt: now,
            lastError: null,
            metrics: {
              impressions: 0,
              reach: 0,
              likes: 0,
              comments: 0,
              shares: 0,
              clicks: 0,
            },
          },
        });
      }

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.manually_published',
          entity: 'Post',
          entityId: id,
          brandId: post.brandId,
        },
      });
    });

    return await this.getById(ctx, id);
  }

  static async reschedule(ctx: UserContext, id: string, newDateIso: string) {
    const post = await this.getById(ctx, id);
    const newScheduledAt = new Date(newDateIso);

    if (newScheduledAt.getTime() <= Date.now()) {
      throw new AppError('VALIDATION', 'Scheduled time cannot be in the past', 422);
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
    });
    const needsApproval = requiresApproval(ctx, workspace?.approvalMode || 'BY_ROLE');

    let newStatus = post.status;
    let bumpedVersion = post.version;

    // Rescheduling rules from 03_LOGIC.md §5
    if (post.status === 'SCHEDULED' && needsApproval) {
      newStatus = 'PENDING';
      bumpedVersion += 1;
    }

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: {
          scheduledAt: newScheduledAt,
          status: newStatus as PostStatus,
          version: bumpedVersion,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.rescheduled',
          entity: 'Post',
          entityId: id,
          brandId: post.brandId,
          meta: { previousTime: post.scheduledAt, newTime: newScheduledAt },
        },
      });
    });

    return await this.getById(ctx, id);
  }

  static async retry(ctx: UserContext, id: string) {
    const post = await this.getById(ctx, id);

    if (post.status !== 'FAILED') {
      throw new AppError('CONFLICT', `Cannot retry post in status ${post.status}`, 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id },
        data: { status: 'PUBLISHING', partialFailure: false },
      });

      // Re-queue failed targets
      await tx.postTarget.updateMany({
        where: { postId: id, status: 'FAILED' },
        data: { status: 'QUEUED', attempts: 0, lastError: null },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.retried',
          entity: 'Post',
          entityId: id,
          brandId: post.brandId,
        },
      });
    });

    return await this.getById(ctx, id);
  }

  static async validate(ctx: UserContext, input: any) {
    let channels = await prisma.channel.findMany({
      where: {
        id: { in: input.channelIds || [] },
        workspaceId: ctx.workspaceId,
      },
    });

    if (channels.length === 0 && Array.isArray(input.channelIds) && input.channelIds.length > 0) {
      const fallbackNets: Record<string, string> = {
        ig: 'INSTAGRAM',
        fb: 'FACEBOOK',
        tt: 'TIKTOK',
        th: 'THREADS',
        pin: 'PINTEREST',
        yt: 'YOUTUBE',
        li: 'LINKEDIN',
        x: 'X',
      };
      channels = input.channelIds.map((cid: string) => {
        const netKey = Object.keys(fallbackNets).find((k) => cid.toLowerCase().includes(k)) || 'ig';
        return {
          id: cid,
          network: fallbackNets[netKey] as any,
          handle: 'demo_user',
          status: 'CONNECTED',
          postingEnabled: true,
          workspaceId: ctx.workspaceId,
          brandId: input.brandId,
        } as any;
      });
    }

    let mediaList: { kind: string; url: string }[] = [];
    if (Array.isArray(input.mediaUrls) && input.mediaUrls.length > 0) {
      mediaList = input.mediaUrls.map((url: string) => ({
        kind: url.match(/\.(mp4|mov|webm)$/i) ? 'VIDEO' : 'IMAGE',
        url,
      }));
    } else if (Array.isArray(input.mediaAssetIds) && input.mediaAssetIds.length > 0) {
      const mediaAssets = await prisma.mediaAsset.findMany({
        where: {
          id: { in: input.mediaAssetIds },
          workspaceId: ctx.workspaceId,
        },
      });
      mediaList = mediaAssets.map((m) => ({ kind: m.kind, url: m.url }));
    }

    const issues = validatePostContent({
      caption: input.caption || '',
      channels: channels.map((c) => ({
        id: c.id,
        network: c.network,
        handle: c.handle,
        status: c.status,
        postingEnabled: c.postingEnabled,
      })),
      media: mediaList,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    });

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
    };
  }
}
