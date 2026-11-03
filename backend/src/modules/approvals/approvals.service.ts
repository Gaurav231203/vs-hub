import { prisma } from '../../lib/prisma.js';
import { UserContext, PostStatus, ReviewDecision } from '@postdesk/shared';
import { AppError } from '../../middleware/error.js';
import { createUndoToken, consumeUndoToken } from '../../lib/undo.js';

export class ApprovalsService {
  static async getQueue(ctx: UserContext, tab: string = 'mine', brandIdFilter?: string | null) {
    // Brand boundary check
    let allowedBrandIds = ctx.brandIds;
    if (brandIdFilter) {
      if (!ctx.allBrands && !ctx.brandIds.includes(brandIdFilter)) {
        throw new AppError('NOT_FOUND', 'Brand not found or access denied', 404);
      }
      allowedBrandIds = [brandIdFilter];
    }

    const where: any = {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      brandId: ctx.allBrands && !brandIdFilter ? undefined : { in: allowedBrandIds },
    };

    const now = new Date();

    switch (tab) {
      case 'mine':
        // Waiting for ME: status PENDING, brand in scope, I am not author
        where.status = 'PENDING';
        where.authorId = { not: ctx.userId };
        break;

      case 'pending':
        // All pending posts in scope
        where.status = 'PENDING';
        break;

      case 'changes':
        // Changes requested
        where.status = 'CHANGES';
        break;

      case 'submitted':
        // My submissions awaiting action or returned with changes
        where.authorId = ctx.userId;
        where.status = { in: ['PENDING', 'CHANGES'] };
        break;

      case 'approved': {
        // Recently approved (last 14 days)
        const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        where.status = { in: ['SCHEDULED', 'PUBLISHING', 'PUBLISHED'] };
        where.reviews = {
          some: {
            decision: 'APPROVED',
            voided: false,
            at: { gte: fourteenDaysAgo },
          },
        };
        break;
      }

      default:
        where.status = 'PENDING';
    }

    const posts = await prisma.post.findMany({
      where,
      orderBy: { scheduledAt: 'asc' },
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
        media: {
          orderBy: { position: 'asc' },
          include: { asset: true },
        },
        targets: {
          include: {
            channel: {
              select: {
                id: true,
                network: true,
                handle: true,
                status: true,
                avatarUrl: true,
              },
            },
          },
        },
        reviews: {
          where: { voided: false },
          orderBy: { at: 'desc' },
        },
      },
    });

    const userIds = [...new Set(posts.flatMap((p) => p.reviews.map((r) => r.byId)))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return posts.map((p) => ({
      ...p,
      reviews: p.reviews.map((r) => ({
        ...r,
        by: userMap.get(r.byId) || { id: r.byId, name: 'Reviewer' },
      })),
    }));
  }

  static async getSummary(ctx: UserContext) {
    const brandFilter = ctx.allBrands ? {} : { brandId: { in: ctx.brandIds } };
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Waiting for me
    const waitingForMeCount = await prisma.post.count({
      where: {
        workspaceId: ctx.workspaceId,
        status: 'PENDING',
        authorId: { not: ctx.userId },
        deletedAt: null,
        ...brandFilter,
      },
    });

    // 2. Oldest age in minutes of pending posts
    const oldestPending = await prisma.post.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        status: 'PENDING',
        deletedAt: null,
        ...brandFilter,
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });

    let oldestAgeMinutes = 0;
    if (oldestPending) {
      oldestAgeMinutes = Math.max(0, Math.floor((now.getTime() - oldestPending.createdAt.getTime()) / 60000));
    }

    // 3. Changes requested
    const changesCount = await prisma.post.count({
      where: {
        workspaceId: ctx.workspaceId,
        status: 'CHANGES',
        deletedAt: null,
        ...brandFilter,
      },
    });

    // 4. Approved this week
    const approvedThisWeekCount = await prisma.review.count({
      where: {
        post: {
          workspaceId: ctx.workspaceId,
          ...brandFilter,
        },
        decision: 'APPROVED',
        voided: false,
        at: { gte: sevenDaysAgo },
      },
    });

    // 5. Avg time to approve in hours (last 30 days)
    const recentApprovedReviews = await prisma.review.findMany({
      where: {
        post: {
          workspaceId: ctx.workspaceId,
          ...brandFilter,
        },
        decision: 'APPROVED',
        voided: false,
        at: { gte: thirtyDaysAgo },
      },
      include: {
        post: {
          select: { createdAt: true },
        },
      },
      take: 50,
    });

    let avgTimeToApproveHours = 4.2; // default benchmark
    if (recentApprovedReviews.length > 0) {
      const totalHours = recentApprovedReviews.reduce((sum, r) => {
        const diffMs = r.at.getTime() - r.post.createdAt.getTime();
        return sum + Math.max(0.1, diffMs / (1000 * 60 * 60));
      }, 0);
      avgTimeToApproveHours = Number((totalHours / recentApprovedReviews.length).toFixed(1));
    }

    return {
      waitingForMe: waitingForMeCount,
      oldestAgeMinutes,
      changesRequested: changesCount,
      approvedThisWeek: approvedThisWeekCount,
      avgTimeToApproveHours,
    };
  }

  static async approve(ctx: UserContext, postId: string, version: number, note?: string) {
    // 1. Fetch post and verify permissions
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { brand: true, targets: true },
    });

    if (!post || post.workspaceId !== ctx.workspaceId || post.deletedAt) {
      throw new AppError('NOT_FOUND', 'Post not found', 404);
    }

    // Brand scope check
    if (!ctx.allBrands && !ctx.brandIds.includes(post.brandId)) {
      throw new AppError('NOT_FOUND', 'Post not found', 404);
    }

    if (post.status !== 'PENDING') {
      throw new AppError('CONFLICT', `Post cannot be approved because current status is ${post.status}`, 409);
    }

    // Version conflict guard
    if (post.version !== version) {
      throw new AppError(
        'CONFLICT',
        'This post has been edited by the author or updated by another reviewer. Please refresh and review the latest content.',
        409
      );
    }

    // Self-approval rule (03_LOGIC.md §4)
    if (post.authorId === ctx.userId) {
      // Check if author is OWNER and the only possible approver
      const otherApprovers = await prisma.membership.count({
        where: {
          workspaceId: ctx.workspaceId,
          userId: { not: ctx.userId },
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN', 'MANAGER', 'CLIENT'] },
          OR: [
            { allBrands: true },
            { brands: { some: { brandId: post.brandId } } },
          ],
        },
      });

      if (ctx.role !== 'OWNER' || otherApprovers > 0) {
        throw new AppError('FORBIDDEN', 'Self-approval is forbidden. An author cannot approve their own post.', 403);
      }
    }

    // Target validity check
    if (post.targets.length === 0) {
      throw new AppError('VALIDATION', 'Post has no valid destination channels selected', 422);
    }

    const now = new Date();
    let newScheduledAt = post.scheduledAt;
    // If scheduledAt is within 1 minute or in the past, push forward to now + 2 min
    if (post.scheduledAt && post.scheduledAt.getTime() <= now.getTime() + 60000) {
      newScheduledAt = new Date(now.getTime() + 2 * 60000);
    }

    // Transaction
    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: {
          status: 'SCHEDULED',
          scheduledAt: newScheduledAt,
        },
      });

      const review = await tx.review.create({
        data: {
          postId,
          byId: ctx.userId,
          decision: 'APPROVED',
          note: note || 'Approved for publication',
          postVersion: post.version,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.approved',
          entity: 'Post',
          entityId: postId,
          brandId: post.brandId,
          meta: { note, previousStatus: 'PENDING', newStatus: 'SCHEDULED' },
        },
      });

      return { updatedPost, review };
    });

    // Generate 8s undo token
    const undoToken = createUndoToken({
      postId,
      actorId: ctx.userId,
      transition: 'approve',
      previousStatus: 'PENDING',
      newStatus: 'SCHEDULED',
      reviewId: result.review.id,
      previousScheduledAt: post.scheduledAt,
    });

    return {
      post: result.updatedPost,
      review: result.review,
      undoToken,
    };
  }

  static async requestChanges(ctx: UserContext, postId: string, note: string, version?: number) {
    if (!note || note.trim().length === 0) {
      throw new AppError('VALIDATION', 'A note explaining the requested changes is required', 422);
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { brand: true },
    });

    if (!post || post.workspaceId !== ctx.workspaceId || post.deletedAt) {
      throw new AppError('NOT_FOUND', 'Post not found', 404);
    }

    if (!ctx.allBrands && !ctx.brandIds.includes(post.brandId)) {
      throw new AppError('NOT_FOUND', 'Post not found', 404);
    }

    if (post.status !== 'PENDING') {
      throw new AppError('CONFLICT', `Cannot request changes on post in ${post.status} status`, 409);
    }

    if (version && post.version !== version) {
      throw new AppError('CONFLICT', 'Post version has changed. Please refresh and review again.', 409);
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPost = await tx.post.update({
        where: { id: postId },
        data: {
          status: 'CHANGES',
        },
      });

      const review = await tx.review.create({
        data: {
          postId,
          byId: ctx.userId,
          decision: 'CHANGES_REQUESTED',
          note: note.trim(),
          postVersion: post.version,
        },
      });

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.changes_requested',
          entity: 'Post',
          entityId: postId,
          brandId: post.brandId,
          meta: { note: note.trim(), previousStatus: 'PENDING', newStatus: 'CHANGES' },
        },
      });

      return { updatedPost, review };
    });

    const undoToken = createUndoToken({
      postId,
      actorId: ctx.userId,
      transition: 'request_changes',
      previousStatus: 'PENDING',
      newStatus: 'CHANGES',
      reviewId: result.review.id,
    });

    return {
      post: result.updatedPost,
      review: result.review,
      undoToken,
    };
  }

  static async bulkApprove(ctx: UserContext, postIds: string[]) {
    const results: { postId: string; success: boolean; reason?: string; undoToken?: string }[] = [];

    for (const id of postIds) {
      try {
        const post = await prisma.post.findUnique({
          where: { id },
          select: { version: true },
        });

        if (!post) {
          results.push({ postId: id, success: false, reason: 'Post not found' });
          continue;
        }

        const res = await this.approve(ctx, id, post.version);
        results.push({
          postId: id,
          success: true,
          undoToken: res.undoToken,
        });
      } catch (err: any) {
        results.push({
          postId: id,
          success: false,
          reason: err.message || 'Approval failed',
        });
      }
    }

    return { results };
  }

  static async undo(ctx: UserContext, postId: string, undoToken: string) {
    const undoData = consumeUndoToken(undoToken, ctx.userId, postId);
    if (!undoData) {
      throw new AppError('CONFLICT', 'Undo window has expired or token is invalid (8-second window elapsed)', 409);
    }

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post || post.status !== undoData.newStatus) {
      throw new AppError('CONFLICT', 'Cannot undo action because the post status has already transitioned', 409);
    }

    // Check 30-second publishing boundary
    if (undoData.transition === 'approve' && post.scheduledAt) {
      const diffMs = post.scheduledAt.getTime() - Date.now();
      if (diffMs <= 30000) {
        throw new AppError('FORBIDDEN', 'Cannot undo approval within 30 seconds of publishing', 403);
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.post.update({
        where: { id: postId },
        data: {
          status: undoData.previousStatus as PostStatus,
          scheduledAt: undoData.previousScheduledAt,
        },
      });

      if (undoData.reviewId) {
        await tx.review.update({
          where: { id: undoData.reviewId },
          data: { voided: true },
        });
      }

      await tx.auditLog.create({
        data: {
          workspaceId: ctx.workspaceId,
          actorId: ctx.userId,
          action: 'post.undone',
          entity: 'Post',
          entityId: postId,
          brandId: post.brandId,
          meta: { revertedTransition: undoData.transition },
        },
      });
    });

    return {
      success: true,
      postId,
      revertedTo: undoData.previousStatus,
    };
  }
}
