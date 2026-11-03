import { prisma } from '../src/lib/prisma.js';
import { PostsService } from '../src/modules/posts/posts.service.js';
import { PostStatus } from '@prisma/client';

async function runTest() {
  console.log('--- [TDD TEST 1] Race Condition: 5 Concurrent Withdraws ---');

  const author = await prisma.user.findFirstOrThrow();
  const workspace = await prisma.workspace.findFirstOrThrow();
  const brand = await prisma.brand.findFirstOrThrow({ where: { workspaceId: workspace.id } });

  const ctx: any = {
    userId: author.id,
    workspaceId: workspace.id,
    role: 'OWNER',
    brandIds: [brand.id],
    allBrands: true,
    perms: ['post.create', 'post.update', 'post.publish', 'post.delete'],
  };

  const burstPost = await prisma.post.create({
    data: {
      workspaceId: workspace.id,
      brandId: brand.id,
      authorId: author.id,
      caption: 'TDD Concurrency Test Post',
      status: PostStatus.PENDING,
    },
  });

  try {
    // Fire 5 simultaneous withdraw requests
    const results = await Promise.allSettled(
      Array.from({ length: 5 }).map(() => PostsService.withdraw(ctx, burstPost.id))
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    console.log(`Results: ${fulfilled.length} fulfilled, ${rejected.length} rejected`);

    // Verify exactly 1 succeeded
    if (fulfilled.length !== 1) {
      throw new Error(`FAIL: Expected exactly 1 withdraw to succeed, but ${fulfilled.length} succeeded!`);
    }

    // Verify DB records
    const reviews = await prisma.review.findMany({
      where: { postId: burstPost.id, decision: 'WITHDRAWN' },
    });
    if (reviews.length !== 1) {
      throw new Error(`FAIL: Expected exactly 1 Review record, found ${reviews.length}!`);
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: burstPost.id, action: 'post.withdrawn' },
    });
    if (auditLogs.length !== 1) {
      throw new Error(`FAIL: Expected exactly 1 AuditLog record, found ${auditLogs.length}!`);
    }

    console.log('✅ TDD TEST 1 PASSED: Exactly 1 withdraw succeeded, exactly 1 Review & 1 AuditLog created.');
  } finally {
    await prisma.review.deleteMany({ where: { postId: burstPost.id } });
    await prisma.auditLog.deleteMany({ where: { entityId: burstPost.id } });
    await prisma.post.delete({ where: { id: burstPost.id } });
  }
}

runTest().catch((err) => {
  console.error('❌ TDD TEST 1 FAILED:', err.message);
  process.exit(1);
});
