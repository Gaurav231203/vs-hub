import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { PostStatus, JobStatus, ConnectInviteStatus } from '@prisma/client';
import { JobQueue } from './queue.js';
import { EmailService } from '../lib/email.js';
import { env } from '../config/env.js';

export class Sweeper {
  /**
   * Sweeper runs periodically (e.g., every 5 minutes):
   * 1. Detects missed SCHEDULED posts (scheduledAt <= now - 2 min) that weren't picked up
   * 2. Recovers posts stuck in PUBLISHING state for > 15 minutes
   */
  static async run(): Promise<{ missedScheduledCount: number; stuckPublishingCount: number }> {
    const now = new Date();
    logger.info('[Sweeper] Running missed post & stuck state check');

    // 1. Find missed SCHEDULED posts
    const missedPosts = await prisma.post.findMany({
      where: {
        status: PostStatus.SCHEDULED,
        scheduledAt: { lte: now },
      },
      include: {
        targets: true,
      },
      take: 100,
    });

    let missedScheduledCount = 0;

    for (const post of missedPosts) {
      // If the scheduled post is expired beyond the acceptable publish window (> 15 minutes overdue),
      // do NOT publish it; flag as NEEDS_RESCHEDULE so the agency/client can choose a new time.
      const isPastGrace = post.scheduledAt && (now.getTime() - post.scheduledAt.getTime() > 15 * 60000);

      if (isPastGrace) {
        const rescheduleClaim = await prisma.post.updateMany({
          where: {
            id: post.id,
            status: PostStatus.SCHEDULED,
          },
          data: {
            status: PostStatus.NEEDS_RESCHEDULE,
          },
        });

        if (rescheduleClaim.count > 0) {
          logger.warn({ postId: post.id }, '[Sweeper] Scheduled post expired beyond grace period; flagged as NEEDS_RESCHEDULE');
          await prisma.auditLog.create({
            data: {
              workspaceId: post.workspaceId,
              actorId: post.authorId,
              action: 'post.needs_reschedule',
              entity: 'Post',
              entityId: post.id,
              brandId: post.brandId,
              meta: { reason: 'Expired scheduled time window' },
            },
          });
        }
        continue;
      }

      // Atomic claim for rescue within acceptable window
      const updated = await prisma.post.updateMany({
        where: {
          id: post.id,
          status: PostStatus.SCHEDULED,
        },
        data: {
          status: PostStatus.PUBLISHING,
        },
      });

      if (updated.count === 0) continue;

      for (const target of post.targets) {
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
            dedupeKey: `target:${target.id}:attempt:${target.attempts + 1}:sweeper`,
          }
        );
      }

      missedScheduledCount++;
      logger.warn({ postId: post.id }, '[Sweeper] Rescued missed SCHEDULED post');
    }

    // 2. Identify posts stuck in PUBLISHING for > 15 minutes
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60000);
    const stuckPosts = await prisma.post.findMany({
      where: {
        status: PostStatus.PUBLISHING,
        updatedAt: { lt: fifteenMinutesAgo },
      },
      include: {
        targets: true,
      },
      take: 50,
    });

    let stuckPublishingCount = 0;

    for (const post of stuckPosts) {
      const incompleteTargets = post.targets.filter((t) => t.status !== 'PUBLISHED' && t.status !== 'FAILED');
      if (incompleteTargets.length > 0) {
        // Re-enqueue incomplete targets
        for (const target of incompleteTargets) {
          await JobQueue.enqueue(
            'publishTarget',
            { targetId: target.id, postId: post.id },
            {
              dedupeKey: `target:${target.id}:retry:${Date.now()}`,
            }
          );
        }
        stuckPublishingCount++;
        logger.warn({ postId: post.id, count: incompleteTargets.length }, '[Sweeper] Re-enqueued stuck targets');
      }
    }

    // 3. Rescue orphaned jobs stuck in RUNNING for > 10 minutes (e.g. following process restart)
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60000);
    const orphanedJobs = await prisma.job.updateMany({
      where: {
        status: JobStatus.RUNNING,
        lockedAt: { lt: tenMinutesAgo },
      },
      data: {
        status: JobStatus.QUEUED,
        lockedAt: null,
      },
    });

    if (orphanedJobs.count > 0) {
      logger.warn({ count: orphanedJobs.count }, '[Sweeper] Rescued orphaned RUNNING jobs back to QUEUED');
    }

    // 4. Send 3-day automated reminder emails for pending invites
    try {
      await Sweeper.sendPendingInviteReminders();
    } catch (err: any) {
      logger.error({ err: err.message }, '[Sweeper] Error in sendPendingInviteReminders');
    }

    return { missedScheduledCount, stuckPublishingCount };
  }

  /**
   * 3-Day Automated Reminder Check:
   * Finds pending ACTIVE connect invites created >= 3 days ago where reminderSentAt is NULL
   * and expiresAt is still in the future. Dispatches reminder email via Resend and updates reminderSentAt.
   */
  static async sendPendingInviteReminders(): Promise<number> {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const now = new Date();

    const pendingInvites = await prisma.connectInvite.findMany({
      where: {
        status: ConnectInviteStatus.ACTIVE,
        reminderSentAt: null,
        createdAt: { lte: threeDaysAgo },
        expiresAt: { gt: now },
      },
      include: {
        brand: {
          include: {
            workspace: { select: { id: true, name: true } },
            contacts: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
      take: 50,
    });

    let reminderCount = 0;
    for (const invite of pendingInvites) {
      const contact = invite.brand.contacts[0];
      if (contact?.email) {
        await EmailService.sendConnectReminder({
          toEmail: contact.email,
          clientName: contact.name,
          brandName: invite.brand.name,
          agencyName: invite.brand.workspace.name,
          inviteUrl: `${env.WEB_URL}/connect/pending?brandId=${invite.brandId}`,
        });
      }

      await prisma.connectInvite.update({
        where: { id: invite.id },
        data: { reminderSentAt: now },
      });
      reminderCount++;
    }

    if (reminderCount > 0) {
      logger.info({ reminderCount }, '[Sweeper] Sent 3-day connect reminders to pending brand invites');
    }

    return reminderCount;
  }
}
