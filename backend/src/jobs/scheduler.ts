import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { JobQueue } from './queue.js';
import { PostStatus, JobStatus } from '@prisma/client';

export class Scheduler {
  /**
   * Run a single tick of the post scheduler:
   * 1. Detect posts due for publication (SCHEDULED and scheduledAt <= NOW())
   * 2. Flip status atomically SCHEDULED -> PUBLISHING
   * 3. Track in publish_jobs table and enqueue publishTarget jobs for each target
   * 4. Recover stuck RUNNING jobs older than 10 minutes
   */
  static async tick(): Promise<{ duePostsCount: number; enqueuedTargetsCount: number }> {
    const now = new Date();

    // 1. Recover stale RUNNING jobs
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60000);
    const staleRecovered = await prisma.job.updateMany({
      where: {
        status: JobStatus.RUNNING,
        lockedAt: { lt: tenMinutesAgo },
      },
      data: {
        status: JobStatus.QUEUED,
        lockedAt: null,
      },
    });

    if (staleRecovered.count > 0) {
      logger.warn({ count: staleRecovered.count }, 'Recovered stale RUNNING jobs');
    }

    // 2. Find due posts
    const duePosts = await prisma.post.findMany({
      where: {
        status: PostStatus.SCHEDULED,
        scheduledAt: { lte: now },
      },
      include: {
        targets: true,
        brand: true,
      },
      take: 50,
    });

    if (duePosts.length === 0) {
      return { duePostsCount: 0, enqueuedTargetsCount: 0 };
    }

    let enqueuedCount = 0;

    for (const post of duePosts) {
      // If post is set to MANUAL mode, send notification and do not auto-publish via API
      if (post.publishMode === 'MANUAL') {
        // Prevent duplicate notifications by creating one only if not created recently
        const existingNotif = await prisma.notification.findFirst({
          where: {
            workspaceId: post.workspaceId,
            type: 'MANUAL_POST_REMINDER',
            link: `/calendar?post=${post.id}&action=manual_post`,
          },
        });

        if (!existingNotif) {
          await prisma.notification.create({
            data: {
              workspaceId: post.workspaceId,
              userId: post.authorId,
              type: 'MANUAL_POST_REMINDER',
              title: `⏰ Time to post: ${post.brand?.name || 'Brand'}`,
              body: post.caption?.slice(0, 120) || 'Your scheduled post is ready for manual publish.',
              link: `/calendar?post=${post.id}&action=manual_post`,
            },
          });
        }
        continue;
      }

      // Atomic state transition: SCHEDULED -> PUBLISHING
      const claimed = await prisma.post.updateMany({
        where: {
          id: post.id,
          status: PostStatus.SCHEDULED,
        },
        data: {
          status: PostStatus.PUBLISHING,
        },
      });

      // If already claimed by another concurrent tick or status changed, skip
      if (claimed.count === 0) {
        continue;
      }

      // Enqueue job per target and record in publish_jobs
      for (const target of post.targets) {
        // Create or update PublishJob record
        await prisma.publishJob.create({
          data: {
            postId: post.id,
            targetId: target.id,
            metaContainerId: target.metaContainerId || null,
            status: JobStatus.QUEUED,
            scheduledAt: post.scheduledAt || now,
          },
        });

        await JobQueue.enqueue(
          'publishTarget',
          { targetId: target.id, postId: post.id },
          {
            dedupeKey: `target:${target.id}:attempt:${target.attempts + 1}`,
          }
        );
        enqueuedCount++;
      }
    }

    logger.info({ duePostsCount: duePosts.length, enqueuedCount }, 'Scheduler tick processed due posts');
    return { duePostsCount: duePosts.length, enqueuedTargetsCount: enqueuedCount };
  }
}
