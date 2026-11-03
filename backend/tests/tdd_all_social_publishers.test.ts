import { prisma } from '../src/lib/prisma.js';
import { PublisherFactory } from '../src/modules/publishers/publisher.factory.js';
import { Network } from '@prisma/client';
import { encrypt } from '../src/lib/crypto.js';

async function runTest() {
  console.log('--- [TDD TEST] Multi-Network Social Publishers Expansion ---');

  const workspace = await prisma.workspace.findFirstOrThrow();
  const brand = await prisma.brand.findFirstOrThrow({ where: { workspaceId: workspace.id } });

  const allNetworks: Network[] = [
    Network.FACEBOOK,
    Network.INSTAGRAM,
    Network.THREADS,
    Network.LINKEDIN,
    Network.YOUTUBE,
    Network.X,
    Network.TIKTOK,
    Network.PINTEREST,
  ];

  // 1. Factory Resolution Test: All 8 networks must resolve without throwing
  console.log('1. Testing PublisherFactory resolution for all 8 networks...');
  for (const net of allNetworks) {
    try {
      const pub = PublisherFactory.getPublisher(net);
      if (!pub || typeof pub.publish !== 'function') {
        throw new Error(`FAIL: Publisher for ${net} does not implement publish() method!`);
      }
      console.log(`✅ ${net} resolved cleanly via PublisherFactory.`);
    } catch (err: any) {
      throw new Error(`FAIL: PublisherFactory failed for ${net}: ${err.message}`);
    }
  }

  // 2. LinkedIn Publishing Execution Test
  console.log('2. Testing LinkedIn Publisher (Text + Image)...');
  const liPublisher = PublisherFactory.getPublisher(Network.LINKEDIN);
  const liResult = await liPublisher.publish({
    postId: 'post_li_test_1',
    targetId: 'target_li_test_1',
    caption: 'Exciting company milestone announcement on LinkedIn! 🚀',
    mediaUrls: ['https://images.unsplash.com/photo-1507679799987-c73779587ccf'],
    channel: {
      id: 'channel_li_1',
      network: Network.LINKEDIN,
      externalId: '12345678', // LinkedIn Org URN
      name: 'Acme Corp',
      handle: 'acme-corp',
      accessTokenEnc: encrypt('mock_linkedin_token'),
    },
  });
  if (!liResult.externalPostId || !liResult.externalPostId.startsWith('urn:li:share:')) {
    throw new Error(`FAIL: LinkedIn publisher failed to return valid share URN: ${liResult.externalPostId}`);
  }
  console.log('✅ LinkedIn publish executed. External ID:', liResult.externalPostId);

  // 3. YouTube Publishing Execution Test (Video / Shorts)
  console.log('3. Testing YouTube Publisher (Video upload)...');
  const ytPublisher = PublisherFactory.getPublisher(Network.YOUTUBE);
  const ytResult = await ytPublisher.publish({
    postId: 'post_yt_test_1',
    targetId: 'target_yt_test_1',
    caption: 'Delicious Sourdough Bread Baking Masterclass Tutorial\n\nFull step-by-step recipe!',
    mediaUrls: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'],
    channel: {
      id: 'channel_yt_1',
      network: Network.YOUTUBE,
      externalId: 'UC_x5XG1OV2P6uZZ5FSM9Ttw',
      name: 'Bakery Channel',
      handle: '@bakerychannel',
      accessTokenEnc: encrypt('mock_youtube_token'),
    },
  });
  if (!ytResult.externalPostId || !ytResult.externalPostId.startsWith('yt_vid_')) {
    throw new Error(`FAIL: YouTube publisher failed to return valid video ID: ${ytResult.externalPostId}`);
  }
  console.log('✅ YouTube publish executed. Video ID:', ytResult.externalPostId);

  // 4. X / Twitter Publishing Execution Test
  console.log('4. Testing X (Twitter) Publisher...');
  const xPublisher = PublisherFactory.getPublisher(Network.X);
  const xResult = await xPublisher.publish({
    postId: 'post_x_test_1',
    targetId: 'target_x_test_1',
    caption: 'Fresh morning bagels just out of the oven! 🥯 Hurry while they are warm.',
    mediaUrls: ['https://images.unsplash.com/photo-1509440159596-0249088772ff'],
    channel: {
      id: 'channel_x_1',
      network: Network.X,
      externalId: '987654321',
      name: 'Morning Bakery',
      handle: '@morningbakery',
      accessTokenEnc: encrypt('mock_x_token'),
    },
  });
  if (!xResult.externalPostId || !xResult.externalPostId.startsWith('tweet_')) {
    throw new Error(`FAIL: X publisher failed to return valid tweet ID: ${xResult.externalPostId}`);
  }
  console.log('✅ X publish executed. Tweet ID:', xResult.externalPostId);

  // 5. TikTok Publishing Execution Test
  console.log('5. Testing TikTok Publisher...');
  const tiktokPublisher = PublisherFactory.getPublisher(Network.TIKTOK);
  const ttResult = await tiktokPublisher.publish({
    postId: 'post_tt_test_1',
    targetId: 'target_tt_test_1',
    caption: 'Croissant lamination timelapse! 🥐 #baking #foodtiktok',
    mediaUrls: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'],
    channel: {
      id: 'channel_tt_1',
      network: Network.TIKTOK,
      externalId: 'tt_user_9988',
      name: 'Pastry Chef',
      handle: '@pastrychef',
      accessTokenEnc: encrypt('mock_tiktok_token'),
    },
  });
  if (!ttResult.externalPostId || !ttResult.externalPostId.startsWith('tiktok_publish_')) {
    throw new Error(`FAIL: TikTok publisher failed to return valid publish ID: ${ttResult.externalPostId}`);
  }
  console.log('✅ TikTok publish executed. Publish ID:', ttResult.externalPostId);

  // 6. Pinterest Publishing Execution Test
  console.log('6. Testing Pinterest Publisher (Pin Creation)...');
  const pinPublisher = PublisherFactory.getPublisher(Network.PINTEREST);
  const pinResult = await pinPublisher.publish({
    postId: 'post_pin_test_1',
    targetId: 'target_pin_test_1',
    caption: 'Rustic Artisan Sourdough Boule Recipe & Scoring Guide',
    mediaUrls: ['https://images.unsplash.com/photo-1549931319-a545dcf3bc73'],
    channel: {
      id: 'channel_pin_1',
      network: Network.PINTEREST,
      externalId: 'pin_board_5544',
      name: 'Bread Recipes Board',
      handle: '@breadboard',
      accessTokenEnc: encrypt('mock_pinterest_token'),
    },
  });
  if (!pinResult.externalPostId || !pinResult.externalPostId.startsWith('pin_')) {
    throw new Error(`FAIL: Pinterest publisher failed to return valid pin ID: ${pinResult.externalPostId}`);
  }
  console.log('✅ Pinterest publish executed. Pin ID:', pinResult.externalPostId);

  console.log('✅ TDD TEST ALL SOCIAL PUBLISHERS PASSED: All 8 networks supported and verified.');
}

runTest().catch((err) => {
  console.error('❌ TDD TEST FAILED:', err.message);
  process.exit(1);
});
