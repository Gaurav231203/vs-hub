import { prisma } from '../src/lib/prisma.js';
import { PostsService } from '../src/modules/posts/posts.service.js';

async function runTest() {
  console.log('--- [TDD TEST] MediaAsset to Post Linking & UsedIn Tracking ---');

  const timestamp = Date.now();
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

  // 1. Create a MediaAsset in the library
  const assetUrl = `https://storage.murmura.local/assets/photo_${timestamp}.jpg`;
  const asset = await prisma.mediaAsset.create({
    data: {
      workspaceId: workspace.id,
      brandId: brand.id,
      title: `Living room photo ${timestamp}`,
      kind: 'IMAGE',
      url: assetUrl,
      bytes: 102400,
      tags: ['interior', 'living'],
    },
  });
  console.log(`Created test MediaAsset: ${asset.id} (${asset.url})`);

  // 2. Create a Post passing mediaUrls: [assetUrl] (the way ComposeView submits it)
  const createdPost = await PostsService.create(ctx, {
    brandId: brand.id,
    caption: 'Cozy living room setup with our handcrafted oak chair.',
    mediaUrls: [assetUrl],
  });

  console.log(`Created Post: ${createdPost.id}`);

  // 3. Verify that PostMedia was created in the database!
  const postWithMedia = await prisma.post.findUnique({
    where: { id: createdPost.id },
    include: {
      media: {
        include: { asset: true },
      },
    },
  });

  if (!postWithMedia || postWithMedia.media.length === 0) {
    throw new Error('FAIL: PostMedia was NOT created when mediaUrls was provided!');
  }

  const linkedAsset = postWithMedia.media[0].asset;
  if (linkedAsset.id !== asset.id) {
    throw new Error(`FAIL: Expected linked assetId to be ${asset.id}, got ${linkedAsset.id}`);
  }
  console.log(`✅ PostMedia successfully created with assetId: ${linkedAsset.id}`);

  // 4. Verify MediaAsset usedIn relationship
  const assetWithUsedIn = await prisma.mediaAsset.findUnique({
    where: { id: asset.id },
    include: {
      usedIn: {
        include: { post: true },
      },
      _count: { select: { usedIn: true } },
    },
  });

  if (!assetWithUsedIn || assetWithUsedIn.usedIn.length === 0 || assetWithUsedIn._count.usedIn !== 1) {
    throw new Error('FAIL: MediaAsset.usedIn count was not incremented in the database!');
  }
  console.log(`✅ MediaAsset._count.usedIn is ${assetWithUsedIn._count.usedIn}. Used in post: ${assetWithUsedIn.usedIn[0].post.caption}`);

  // Clean up
  await prisma.postMedia.deleteMany({ where: { postId: createdPost.id } });
  await prisma.post.delete({ where: { id: createdPost.id } });
  await prisma.mediaAsset.delete({ where: { id: asset.id } });

  console.log('\n✅ PASS: Post to MediaAsset linking and usedIn tracking verified successfully!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ TEST FAILED:', err.message);
  process.exit(1);
});
