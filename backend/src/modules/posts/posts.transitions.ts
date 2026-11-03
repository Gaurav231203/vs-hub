import { Prisma, PostStatus } from '@prisma/client';
import { AppError } from '../../middleware/error.js';

export const VALID_POST_TRANSITIONS: Record<PostStatus, PostStatus[]> = {
  [PostStatus.DRAFT]: [PostStatus.PENDING, PostStatus.SCHEDULED],
  [PostStatus.PENDING]: [PostStatus.DRAFT, PostStatus.SCHEDULED, PostStatus.CHANGES],
  [PostStatus.CHANGES]: [PostStatus.DRAFT, PostStatus.PENDING],
  [PostStatus.SCHEDULED]: [PostStatus.PUBLISHING, PostStatus.DRAFT, PostStatus.NEEDS_RESCHEDULE],
  [PostStatus.NEEDS_RESCHEDULE]: [PostStatus.SCHEDULED, PostStatus.DRAFT],
  [PostStatus.PUBLISHING]: [PostStatus.PUBLISHED, PostStatus.FAILED],
  [PostStatus.PUBLISHED]: [],
  [PostStatus.FAILED]: [PostStatus.DRAFT, PostStatus.SCHEDULED],
};

export interface TransitionPostParams {
  postId: string;
  workspaceId: string;
  from: PostStatus | PostStatus[];
  to: PostStatus;
  extraData?: Prisma.PostUpdateInput;
}

/**
 * Atomic Compare-And-Swap (CAS) state transition engine for Post state machine.
 * Enforces valid transition paths, workspace scoping, and version increment.
 * Throws 409 Conflict if post is not in the expected 'from' state.
 */
export async function transitionPost(
  tx: Prisma.TransactionClient,
  params: TransitionPostParams
): Promise<{ count: number }> {
  const { postId, workspaceId, from, to, extraData = {} } = params;

  // Validate allowed state machine transitions
  const allowedFrom = Array.isArray(from) ? from : [from];
  for (const f of allowedFrom) {
    const allowedTargets = VALID_POST_TRANSITIONS[f] || [];
    if (!allowedTargets.includes(to)) {
      throw new AppError(
        'ILLEGAL_TRANSITION',
        `Illegal state transition from ${f} to ${to}`,
        400
      );
    }
  }

  // Atomic conditional update
  const res = await tx.post.updateMany({
    where: {
      id: postId,
      workspaceId,
      status: Array.isArray(from) ? { in: from } : from,
    },
    data: {
      status: to,
      version: { increment: 1 },
      ...extraData,
    },
  });

  if (res.count === 0) {
    throw new AppError(
      'CONFLICT',
      `INVALID_STATE_TRANSITION: Post ${postId} is no longer in state ${Array.isArray(from) ? from.join('/') : from}`,
      409
    );
  }

  return res;
}
