import { prisma } from '../src/lib/prisma.js';
import { PostsService } from '../src/modules/posts/posts.service.js';
import { PostStatus } from '@prisma/client';

async function runTest() {
  console.log('--- [TDD TEST 3] channelIds Service-Level Validation & submitForReview check ---');

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

  // 1. Fail-closed: null channelIds must be rejected with 400
  let rejectedNull = false;
  try {
    await PostsService.create(ctx, {
      brandId: brand.id,
      caption: 'Null channelIds post',
      channelIds: null as any,
    });
  } catch (err: any) {
    rejectedNull = true;
    console.log('✅ Rejected null channelIds:', err.message);
  }
  if (!rejectedNull) {
    throw new Error('FAIL: PostsService.create accepted null channelIds!');
  }

  // 2. Fail-closed: non-string object array must be rejected
  let rejectedObjectArray = false;
  try {
    await PostsService.create(ctx, {
      brandId: brand.id,
      caption: 'Object array channelIds post',
      channelIds: [{ id: 'fake' }] as any,
    });
  } catch (err: any) {
    rejectedObjectArray = true;
    console.log('✅ Rejected object array channelIds:', err.message);
  }
  if (!rejectedObjectArray) {
    throw new Error('FAIL: PostsService.create accepted object array channelIds!');
  }

  // 3. submitForReview on post with 0 channels must be rejected
  const emptyChannelsPost = await prisma.post.create({
    data: {
      workspaceId: workspace.id,
      brandId: brand.id,
      authorId: author.id,
      caption: 'Draft post without channels',
      status: PostStatus.DRAFT,
    },
  });

  try {
    let rejectedNoChannels = false;
    try {
      await PostsService.submitForReview(ctx, emptyChannelsPost.id);
    } catch (err: any) {
      rejectedNoChannels = true;
      console.log('✅ submitForReview rejected post with 0 channels:', err.message);
    }

    if (!rejectedNoChannels) {
      throw new Error('FAIL: submitForReview allowed submitting a post with 0 channels!');
    }
  } finally {
    await prisma.post.delete({ where: { id: emptyChannelsPost.id } });
  }

  console.log('✅ TDD TEST 3 PASSED: channelIds service validation and submitForReview checks enforced.');
}

runTest().catch((err) => {
  console.error('❌ TDD TEST 3 FAILED:', err.message);
  process.exit(1);
});
