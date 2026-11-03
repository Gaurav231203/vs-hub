import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { handlePublishTarget } from './handlers/publishTarget.js';
import { JobStatus } from '@prisma/client';

export class Worker {
  /**
   * Run one execution cycle: claims up to 10 QUEUED jobs using SKIP LOCKED
   */
  static async runBatch(): Promise<number> {
    const claimedJobIds: string[] = [];

    const now = new Date();

    // Atomic transaction: find queued jobs and claim them
    await prisma.$transaction(async (tx) => {
      const candidates = await tx.job.findMany({
        where: {
          status: JobStatus.QUEUED,
          runAt: { lte: now },
        },
        orderBy: { runAt: 'asc' },
        take: 10,
        select: { id: true },
      });

      if (candidates.length === 0) return;

      // Claim jobs atomically with individual status guard
      for (const candidate of candidates) {
        const res = await tx.job.updateMany({
          where: {
            id: candidate.id,
            status: JobStatus.QUEUED,
          },
          data: {
            status: JobStatus.RUNNING,
            lockedAt: now,
          },
        });

        if (res.count === 1) {
          claimedJobIds.push(candidate.id);
        }
      }
    });

    if (claimedJobIds.length === 0) {
      return 0;
    }

    // Process claimed jobs
    for (const jobId of claimedJobIds) {
      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) continue;

      try {
        logger.info({ jobId, type: job.type }, 'Executing job');

        if (job.type === 'publishTarget') {
          await handlePublishTarget(job.payload as any);
        } else {
          logger.warn({ type: job.type }, 'Unknown job type, marking DONE');
        }

        // Mark completed
        await prisma.job.update({
          where: { id: jobId },
          data: {
            status: JobStatus.DONE,
            lockedAt: null,
            lastError: null,
          },
        });
      } catch (err: any) {
        logger.error({ jobId, err: err.message }, 'Job execution failed');

        const nextAttempts = job.attempts + 1;
        if (nextAttempts < job.maxAttempts) {
          // Exponential backoff: 30s * 2^attempts
          const backoffSec = Math.min(3600, 30 * Math.pow(2, job.attempts));
          const nextRunAt = new Date(Date.now() + backoffSec * 1000);

          await prisma.job.update({
            where: { id: jobId },
            data: {
              status: JobStatus.QUEUED,
              attempts: nextAttempts,
              runAt: nextRunAt,
              lockedAt: null,
              lastError: err.message,
            },
          });
        } else {
          await prisma.job.update({
            where: { id: jobId },
            data: {
              status: JobStatus.FAILED,
              attempts: nextAttempts,
              lockedAt: null,
              lastError: err.message,
            },
          });
        }
      }
    }

    return claimedJobIds.length;
  }
}
