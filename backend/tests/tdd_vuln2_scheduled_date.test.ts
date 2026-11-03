import { prisma } from '../src/lib/prisma.js';
import { PostsService } from '../src/modules/posts/posts.service.js';
import { Sweeper } from '../src/jobs/sweeper.js';
import { PostStatus } from '@prisma/client';

async function runTest() {
  console.log('--- [TDD TEST 2] scheduledAt Temporal Boundaries & Sweeper ---');

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

  // 1. Create with past date (1900) should be REJECTED
  let rejectedPast = false;
  try {
    await PostsService.create(ctx, {
      brandId: brand.id,
      caption: 'Past date post',
      scheduledAt: '1900-01-01T00:00:00Z',
    });
  } catch (err: any) {
    rejectedPast = true;
    console.log('✅ Rejected past date (1900):', err.message);
  }
  if (!rejectedPast) {
    throw new Error('FAIL: PostsService.create accepted year 1900 past date!');
  }

  // 2. Create with less than 5 minutes future date should be REJECTED
  let rejectedTooSoon = false;
  try {
    const twoMinFuture = new Date(Date.now() + 2 * 60000).toISOString();
    await PostsService.create(ctx, {
      brandId: brand.id,
      caption: '2 min future post',
      scheduledAt: twoMinFuture,
    });
  } catch (err: any) {
    rejectedTooSoon = true;
    console.log('✅ Rejected < 5 min date:', err.message);
  }
  if (!rejectedTooSoon) {
    throw new Error('FAIL: PostsService.create accepted date less than 5 minutes in future!');
  }

  // 3. Sweeper should NOT publish expired scheduled post, but mark NEEDS_RESCHEDULE
  const expiredPost = await prisma.post.create({
    data: {
      workspaceId: workspace.id,
      brandId: brand.id,
      authorId: author.id,
      caption: 'Expired while pending review',
      status: PostStatus.SCHEDULED,
      scheduledAt: new Date(Date.now() - 30 * 60000), // 30 mins ago
    },
  });

  try {
    await Sweeper.run();

    const postAfterSweeper = await prisma.post.findUniqueOrThrow({ where: { id: expiredPost.id } });
    console.log(`Post status after sweeper: ${postAfterSweeper.status}`);

    if (postAfterSweeper.status !== PostStatus.NEEDS_RESCHEDULE) {
      throw new Error(`FAIL: Expected post to be marked NEEDS_RESCHEDULE, but got ${postAfterSweeper.status}!`);
    }

    console.log('✅ Sweeper properly flagged overdue post as NEEDS_RESCHEDULE without publishing.');
  } finally {
    await prisma.post.delete({ where: { id: expiredPost.id } });
  }

  console.log('✅ TDD TEST 2 PASSED: All temporal boundaries enforced.');
}

runTest().catch((err) => {
  console.error('❌ TDD TEST 2 FAILED:', err.message);
  process.exit(1);
});
