import assert from 'node:assert/strict';
import { ChannelStatus, Network } from '@prisma/client';
import {
  ChannelSyncService,
  computeChannelGrowthPct,
  computeDaysLeft,
} from '../src/modules/channels/sync.service.js';
import { bindMetaAccountsToBrand } from '../src/modules/invites/invites.routes.js';

console.log('================================================================');
console.log('🔄 RUNNING REAL SOCIAL MIDDLE HANDLER & SYNC TEST SUITE');
console.log('================================================================\n');

async function runTests() {
  // ------------------------------------------------------------------
  // Test 1: Facebook Business Page live sync (real followers, insights, posts)
  // ------------------------------------------------------------------
  console.log('👉 [Test 1] Syncing real Facebook Business Page followers, insights & posts');
  const postCreates: any[] = [];
  const metricUpserts: any[] = [];
  const channelUpdates: any[] = [];

  const mockPageDb = {
    channel: {
      findUnique: async () => ({
        id: 'ch_fb_page_1',
        workspaceId: 'ws_1',
        brandId: 'br_1',
        network: Network.FACEBOOK,
        externalId: '9988776655',
        handle: 'Old Handle',
        followers: 0,
        accessTokenEnc: 'v1:mock:enc:token',
        connectedById: 'user_1',
      }),
      update: async ({ data }: any) => {
        channelUpdates.push(data);
        return {
          id: 'ch_fb_page_1',
          network: Network.FACEBOOK,
          handle: data.handle || 'Gaurilifts Official',
          followers: data.followers,
        };
      },
    },
    metricDaily: {
      upsert: async (args: any) => {
        metricUpserts.push(args.create);
        return args.create;
      },
      findMany: async () => [
        { date: new Date('2026-10-15T00:00:00Z'), followers: 8000 },
        { date: new Date('2026-11-12T00:00:00Z'), followers: 8420 },
      ],
    },
    postTarget: {
      findFirst: async () => null,
    },
    post: {
      create: async ({ data }: any) => {
        postCreates.push(data);
        return data;
      },
    },
  };

  const mockPageFetch = async (url: string | URL) => {
    const s = String(url);
    if (s.includes('/9988776655?fields=id,name,followers_count')) {
      return {
        json: async () => ({
          id: '9988776655',
          name: 'Gaurilifts Official',
          followers_count: 8420,
          fan_count: 8390,
          picture: { data: { url: 'https://cdn.example.com/page-avatar.jpg' } },
        }),
      } as any;
    }
    if (s.includes('/9988776655/posts?')) {
      return {
        json: async () => ({
          data: [
            {
              id: '9988776655_101',
              message: 'Morning workout drop!',
              created_time: '2026-11-11T09:00:00+0000',
              permalink_url: 'https://facebook.com/9988776655/posts/101',
              likes: { summary: { total_count: 120 } },
              comments: { summary: { total_count: 14 } },
              shares: { count: 9 },
            },
          ],
        }),
      } as any;
    }
    if (s.includes('/9988776655/insights?')) {
      return {
        json: async () => ({
          data: [
            { name: 'page_impressions', values: [{ value: 19400 }] },
            { name: 'page_post_engagements', values: [{ value: 320 }] },
          ],
        }),
      } as any;
    }
    throw new Error(`Unexpected URL in Test 1: ${s}`);
  };

  const fbOutcome = await ChannelSyncService.syncChannel('ch_fb_page_1', {
    db: mockPageDb,
    fetchImpl: mockPageFetch as any,
    decryptFn: () => 'EAAG_LIVE_PAGE_TOKEN',
    nowFn: () => new Date('2026-11-12T06:00:00Z'),
  });

  assert.equal(fbOutcome.synced, true);
  assert.equal(fbOutcome.accountType, 'page');
  assert.equal(fbOutcome.followers, 8420);
  assert.equal(fbOutcome.postsSynced, 1);
  assert.equal(fbOutcome.growthPct, 5.3); // (8420 - 8000)/8000 * 100 = 5.25 -> 5.3
  assert.equal(channelUpdates[0].followers, 8420);
  assert.equal(channelUpdates[0].avatarUrl, 'https://cdn.example.com/page-avatar.jpg');
  assert.equal(metricUpserts[0].impressions, 19400);
  assert.equal(metricUpserts[0].engagements, 320);
  assert.equal(postCreates[0].caption, 'Morning workout drop!');
  console.log('   ✅ PASS\n');

  // ------------------------------------------------------------------
  // Test 2: Instagram Business live sync
  // ------------------------------------------------------------------
  console.log('👉 [Test 2] Syncing real Instagram Business followers & media');
  const igPosts: any[] = [];
  const mockIgDb = {
    channel: {
      findUnique: async () => ({
        id: 'ch_ig_1',
        workspaceId: 'ws_1',
        brandId: 'br_1',
        network: Network.INSTAGRAM,
        externalId: '17841400001',
        handle: '@old_ig',
        followers: 4800,
        accessTokenEnc: 'v1:mock:enc:token',
        connectedById: 'user_1',
      }),
      update: async ({ data }: any) => ({
        id: 'ch_ig_1',
        network: Network.INSTAGRAM,
        handle: data.handle,
        followers: data.followers,
      }),
    },
    metricDaily: {
      upsert: async ({ create }: any) => create,
      findMany: async () => [{ date: new Date('2026-11-12T00:00:00Z'), followers: 15230 }],
    },
    postTarget: { findFirst: async () => null },
    post: {
      create: async ({ data }: any) => {
        igPosts.push(data);
        return data;
      },
    },
  };

  const mockIgFetch = async (url: string | URL) => {
    const s = String(url);
    if (s.includes('/17841400001?fields=id,username,followers_count')) {
      return {
        json: async () => ({
          id: '17841400001',
          username: 'gaurilifts_ig',
          followers_count: 15230,
          media_count: 42,
          profile_picture_url: 'https://cdn.example.com/ig-avatar.jpg',
        }),
      } as any;
    }
    if (s.includes('/17841400001/media?')) {
      return {
        json: async () => ({
          data: [
            {
              id: 'ig_m_55',
              caption: 'Reel day 1',
              timestamp: '2026-11-10T10:00:00+0000',
              like_count: 450,
              comments_count: 23,
              permalink: 'https://instagram.com/p/abc',
            },
          ],
        }),
      } as any;
    }
    throw new Error(`Unexpected URL in Test 2: ${s}`);
  };

  const igOutcome = await ChannelSyncService.syncChannel('ch_ig_1', {
    db: mockIgDb,
    fetchImpl: mockIgFetch as any,
    decryptFn: () => 'EAAG_LIVE_IG_TOKEN',
  });

  assert.equal(igOutcome.synced, true);
  assert.equal(igOutcome.accountType, 'instagram_business');
  assert.equal(igOutcome.handle, '@gaurilifts_ig');
  assert.equal(igOutcome.followers, 15230);
  assert.equal(igOutcome.postsSynced, 1);
  assert.equal(igOutcome.growthPct, null); // Only 1 snapshot -> must NOT fabricate +4.8%
  assert.equal(igPosts[0].caption, 'Reel day 1');
  console.log('   ✅ PASS\n');

  // ------------------------------------------------------------------
  // Test 3: Personal Facebook Profile wipes legacy dummy 1250 without fabricating growth
  // ------------------------------------------------------------------
  console.log('👉 [Test 3] Facebook Personal Profile clears fake 1250 -> 0 & growthPct -> null');
  let clearedFollowers = -1;
  const mockProfileDb = {
    channel: {
      findUnique: async () => ({
        id: 'ch_fb_profile',
        workspaceId: 'ws_1',
        brandId: 'br_1',
        network: Network.FACEBOOK,
        externalId: '2324760611591484',
        handle: 'Gaurav Bisht',
        followers: 1250, // legacy fake count
        accessTokenEnc: 'v1:mock:enc:token',
      }),
      update: async ({ data }: any) => {
        clearedFollowers = data.followers;
        return {
          id: 'ch_fb_profile',
          network: Network.FACEBOOK,
          handle: data.handle,
          followers: data.followers,
        };
      },
    },
    metricDaily: {
      findMany: async () => [],
    },
  };

  const mockProfileFetch = async (url: string | URL) => {
    const s = String(url);
    if (s.includes('followers_count,fan_count')) {
      return {
        json: async () => ({
          error: {
            message: '(#100) Tried accessing nonexisting field (fan_count) on node type (User)',
            code: 100,
          },
        }),
      } as any;
    }
    return {
      json: async () => ({
        id: '2324760611591484',
        name: 'Gaurav Bisht',
        picture: { data: { url: 'https://cdn.example.com/gb-pic.jpg' } },
      }),
    } as any;
  };

  const profileOutcome = await ChannelSyncService.syncChannel('ch_fb_profile', {
    db: mockProfileDb,
    fetchImpl: mockProfileFetch as any,
    decryptFn: () => 'EAAG_USER_PROFILE_TOKEN',
  });

  assert.equal(profileOutcome.synced, true);
  assert.equal(profileOutcome.accountType, 'profile');
  assert.equal(clearedFollowers, 0);
  assert.equal(profileOutcome.followers, 0);
  assert.equal(profileOutcome.growthPct, null);
  console.log('   ✅ PASS\n');

  // ------------------------------------------------------------------
  // Test 4: bindMetaAccountsToBrand stores real followers (no 1250 / 4800) & runs sync
  // ------------------------------------------------------------------
  console.log('👉 [Test 4] bindMetaAccountsToBrand never injects hardcoded 1250 / 4800 followers');
  const upserts: any[] = [];
  const syncedIds: string[] = [];

  await bindMetaAccountsToBrand({
    workspaceId: 'ws_1',
    brandId: 'br_1',
    page: {
      pageId: 'page_555',
      pageName: 'Real Bakery Page',
      pageToken: 'EAAG_PAGE_SECRET',
      isProfile: false,
      followers: 312,
      avatarUrl: 'https://cdn.example.com/bakery.jpg',
      instagram: {
        id: 'ig_777',
        username: 'realbakery',
        profilePictureUrl: 'https://cdn.example.com/ig-bakery.jpg',
        followersCount: 945,
      },
    },
    deps: {
      encryptFn: (s) => `enc:${s}`,
      syncChannel: async (id) => {
        syncedIds.push(id);
      },
      db: {
        channel: {
          upsert: async (args: any) => {
            upserts.push(args);
            return { id: `id_${args.create.externalId}`, ...args.create };
          },
        },
      },
    },
  });

  assert.equal(upserts[0].create.followers, 312);
  assert.equal(upserts[1].create.followers, 945);
  assert.deepEqual(syncedIds, ['id_page_555', 'id_ig_777']);

  // Personal profile bind must store 0, not 1250
  upserts.length = 0;
  await bindMetaAccountsToBrand({
    workspaceId: 'ws_1',
    brandId: 'br_1',
    page: {
      pageId: 'user_123',
      pageName: 'Personal User',
      pageToken: 'EAAG_USER_SECRET',
      isProfile: true,
    },
    deps: {
      encryptFn: (s) => `enc:${s}`,
      syncChannel: async () => {},
      db: {
        channel: {
          upsert: async (args: any) => {
            upserts.push(args);
            return { id: 'id_user_123', ...args.create };
          },
        },
      },
    },
  });
  assert.equal(upserts[0].create.followers, 0);
  console.log('   ✅ PASS\n');

  // ------------------------------------------------------------------
  // Test 5: Growth & daysLeft helper sanity checks
  // ------------------------------------------------------------------
  console.log('👉 [Test 5] Growth & token daysLeft calculations remain truthful');
  assert.equal(computeChannelGrowthPct([]), null);
  assert.equal(
    computeChannelGrowthPct([{ date: '2026-11-12', followers: 500 }]),
    null
  );
  assert.equal(
    computeChannelGrowthPct([
      { date: '2026-11-01', followers: 1000 },
      { date: '2026-11-12', followers: 1105 },
    ]),
    10.5
  );
  const future30 = new Date(Date.now() + 30 * 86400000);
  assert.ok(computeDaysLeft(future30) >= 29 && computeDaysLeft(future30) <= 31);
  assert.equal(ChannelStatus.CONNECTED, 'CONNECTED');
  console.log('   ✅ PASS\n');

  console.log('================================================================');
  console.log('🎉 ALL 5 REAL SOCIAL SYNC MIDDLE HANDLER TESTS PASSED!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
