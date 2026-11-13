import assert from 'node:assert/strict';
import { FacebookPublisher } from '../src/modules/publishers/facebook.publisher.js';
import { InstagramPublisher } from '../src/modules/publishers/instagram.publisher.js';
import { ThreadsPublisher } from '../src/modules/publishers/threads.publisher.js';
import { LinkedInPublisher } from '../src/modules/publishers/linkedin.publisher.js';
import { XPublisher } from '../src/modules/publishers/x.publisher.js';
import { TikTokPublisher } from '../src/modules/publishers/tiktok.publisher.js';
import { PinterestPublisher } from '../src/modules/publishers/pinterest.publisher.js';
import { YouTubePublisher } from '../src/modules/publishers/youtube.publisher.js';
import { StorageService } from '../src/lib/storage.js';

console.log('================================================================');
console.log('🧪 RUNNING REAL-ONLY PUBLISHERS & STORAGE TEST SUITE');
console.log('================================================================\n');

async function runTests() {
  // 1. Ensure ZERO publishers allow fake mock_ / manual_ publishing
  console.log('👉 [Test 1] All 8 publishers reject mock/manual channels instead of faking publish');
  const mockChannel = {
    id: 'ch_mock',
    externalId: 'manual_acc_1',
    accessTokenEnc: 'manual_pass_secret',
  };
  const publishers = [
    new FacebookPublisher(),
    new InstagramPublisher(),
    new ThreadsPublisher(),
    new LinkedInPublisher(),
    new XPublisher(),
    new TikTokPublisher(),
    new PinterestPublisher(),
    new YouTubePublisher(),
  ];

  for (const pub of publishers) {
    let threw = false;
    try {
      await pub.publish({
        postId: 'p1',
        targetId: 't1',
        caption: 'Test caption',
        mediaUrls: ['https://example.com/photo.jpg'],
        channel: mockChannel,
      });
    } catch (err: any) {
      threw = true;
      assert.match(err.message, /requires an official/i);
    }
    assert.equal(threw, true, `${pub.constructor.name} must throw for manual/mock tokens`);
  }
  console.log('   ✅ PASS (all 8 rejected fake mock publish)\n');

  // 2. FacebookPublisher real feed, photo & video paths with mocked fetch
  console.log('👉 [Test 2] FacebookPublisher calls live v20.0 /feed and /videos cleanly');
  const origFetch = globalThis.fetch;
  try {
    const calledUrls: string[] = [];
    globalThis.fetch = (async (url: any) => {
      calledUrls.push(String(url));
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: '121333084234366_99999' }),
      } as any;
    }) as any;

    const fb = new FacebookPublisher();
    const feedRes = await fb.publish({
      postId: 'p2',
      targetId: 't2',
      caption: 'Real Facebook page post',
      mediaUrls: [],
      channel: { id: 'c1', externalId: '121333084234366', accessTokenEnc: 'EAA_REAL_TOKEN' },
    });
    assert.equal(feedRes.externalPostId, '121333084234366_99999');
    assert.deepEqual(feedRes.metrics, { impressions: 0, reach: 0, likes: 0, comments: 0 });
    assert.ok(calledUrls[0].includes('/v20.0/121333084234366/feed'));

    const vidRes = await fb.publish({
      postId: 'p3',
      targetId: 't3',
      caption: 'Real video',
      mediaUrls: ['/uploads/media/test.mp4'],
      channel: { id: 'c1', externalId: '121333084234366', accessTokenEnc: 'EAA_REAL_TOKEN' },
    });
    assert.equal(vidRes.externalPostId, '121333084234366_99999');
    assert.ok(calledUrls[1].includes('/v20.0/121333084234366/videos'));
    console.log('   ✅ PASS\n');

    // 3. InstagramPublisher polls status_code FINISHED and surfaces error_user_msg
    console.log('👉 [Test 3] InstagramPublisher polls container status & surfaces Meta restrictions');
    const igUrls: string[] = [];
    globalThis.fetch = (async (url: any) => {
      const s = String(url);
      igUrls.push(s);
      if (s.endsWith('/17841458410775180/media')) {
        return { ok: true, status: 200, json: async () => ({ id: 'container_123' }) } as any;
      }
      if (s.includes('fields=status_code')) {
        return { ok: true, status: 200, json: async () => ({ status_code: 'FINISHED' }) } as any;
      }
      if (s.endsWith('/17841458410775180/media_publish')) {
        return { ok: true, status: 200, json: async () => ({ id: 'ig_published_456' }) } as any;
      }
      throw new Error(`Unexpected IG URL: ${s}`);
    }) as any;

    const ig = new InstagramPublisher();
    const igOk = await ig.publish({
      postId: 'p4',
      targetId: 't4',
      caption: 'IG image',
      mediaUrls: ['https://vs-hub-1.onrender.com/uploads/test.jpg'],
      channel: { id: 'c2', externalId: '17841458410775180', accessTokenEnc: 'EAA_REAL_IG' },
    });
    assert.equal(igOk.externalPostId, 'ig_published_456');
    assert.equal(igOk.metaContainerId, 'container_123');
    assert.ok(igUrls.some((u) => u.includes('fields=status_code')));

    // Restricted account test (subcode 2207050)
    globalThis.fetch = (async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          message: 'User access is restricted',
          error_user_msg: 'Instagram account is restricted.',
        },
      }),
    })) as any;

    let restrictedMsg = '';
    try {
      await ig.publish({
        postId: 'p5',
        targetId: 't5',
        caption: 'Restricted test',
        mediaUrls: ['https://vs-hub-1.onrender.com/uploads/test.jpg'],
        channel: { id: 'c2', externalId: '17841458410775180', accessTokenEnc: 'EAA_REAL_IG' },
      });
    } catch (e: any) {
      restrictedMsg = e.message;
    }
    assert.match(restrictedMsg, /User access is restricted.*Instagram account is restricted/);
    console.log('   ✅ PASS\n');
  } finally {
    globalThis.fetch = origFetch;
  }

  // 4. StorageService uses provided HTTPS public API base instead of localhost fallback
  console.log('👉 [Test 4] StorageService uses public HTTPS apiBaseUrl for upload-local URLs');
  const uploadResult = await StorageService.generatePresignedUploadUrl({
    workspaceId: 'ws_1',
    brandId: 'br_1',
    filename: 'workout.jpg',
    contentType: 'image/jpeg',
    byteSize: 2048,
    apiBaseUrl: 'https://vs-hub-1.onrender.com',
  });
  assert.ok(uploadResult.uploadUrl.startsWith('https://vs-hub-1.onrender.com/api/v1/library/upload-local'));
  assert.ok(uploadResult.publicUrl.startsWith('https://vs-hub-1.onrender.com/uploads/media/ws_1/br_1/'));
  console.log('   ✅ PASS\n');

  console.log('================================================================');
  console.log('🎉 ALL REAL-ONLY PUBLISHER & STORAGE TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});

