import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { JobStatus } from '@prisma/client';

export interface EnqueueOptions {
  runAt?: Date;
  maxAttempts?: number;
  dedupeKey?: string;
}

export class JobQueue {
  /**
   * Enqueue a background job with optional dedupeKey and scheduling
   */
  static async enqueue(type: string, payload: any, options: EnqueueOptions = {}) {
    const { runAt = new Date(), maxAttempts = 3, dedupeKey } = options;

    if (dedupeKey) {
      // Check if job with dedupeKey already exists
      const existing = await prisma.job.findUnique({
        where: { dedupeKey },
      });
      if (existing) {
        return existing;
      }
    }

    try {
      return await prisma.job.create({
        data: {
          type,
          payload,
          status: JobStatus.QUEUED,
          runAt,
          maxAttempts,
          dedupeKey: dedupeKey || null,
        },
      });
    } catch (err: any) {
      // Handle race condition on unique dedupeKey
      if (err.code === 'P2002' && dedupeKey) {
        return prisma.job.findUnique({ where: { dedupeKey } });
      }
      throw err;
    }
  }
}
