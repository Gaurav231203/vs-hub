import { PrismaClient, Role, Network, ChannelStatus, PostStatus, ReviewDecision, ConvoType, Sentiment, KeywordKind } from '@prisma/client';
import argon2 from 'argon2';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const prisma = new PrismaClient();

const VERSION = 'v1';
const ALG = 'aes-256-gcm';

function encrypt(plain: string): string {
  const hexKey = process.env.ENCRYPTION_KEY || 'a0f75d7838903dc219062b2aa04e629df0ecddaa141b01a123b9382c7e368760';
  const key = Buffer.from(hexKey, 'hex');
  const iv = crypto.randomBytes(12);
  const cip = crypto.createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cip.update(plain, 'utf8'), cip.final()]);
  const tag = cip.getAuthTag();
  return `${VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

async function main() {
  console.log('🌱 Starting database seed...');

  const shouldReset = process.argv.includes('--reset') || true;
  if (shouldReset && process.env.NODE_ENV !== 'production') {
    console.log('Cleaning up existing demo data...');
    await prisma.approvalToken.deleteMany();
    await prisma.connectInvite.deleteMany();
    await prisma.publishJob.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.metricDaily.deleteMany();
    await prisma.mention.deleteMany();
    await prisma.keyword.deleteMany();
    await prisma.hashtagSet.deleteMany();
    await prisma.template.deleteMany();
    await prisma.savedReply.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.review.deleteMany();
    await prisma.postTarget.deleteMany();
    await prisma.postMedia.deleteMany();
    await prisma.post.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.mediaAsset.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.membershipBrand.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.brand.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.invite.deleteMany();
    await prisma.user.deleteMany();
    await prisma.workspace.deleteMany();
  }

  // 1. Workspace
  const workspace = await prisma.workspace.create({
    data: {
      name: 'VS Adda Agency',
      timezone: 'UTC',
      weekStart: 1,
      approvalMode: 'BY_ROLE',
      shortenLinks: true,
      utmEnabled: true,
      utmSource: 'vsadda',
      plan: 'agency',
      seatLimit: 15,
    },
  });

  console.log(`✓ Workspace created: ${workspace.name} (${workspace.id})`);

  // 2. Brands
  const brandsData = [
    { name: 'Hollow Home', color: '#f2b740', description: 'Nordic interior design & handcrafted furniture' },
    { name: 'Vantage Garage', color: '#4F46E5', description: 'High-performance automotive & motorsport' },
    { name: 'Acme Corp', color: '#4F46E5', description: 'Enterprise B2B Cloud Solutions' },
    { name: 'Starlight Bakery', color: '#EC4899', description: 'Artisanal organic bakery & pastries' },
    { name: 'Nexus Tech', color: '#0EA5E9', description: 'Next-gen consumer AI electronics' },
    { name: 'Zenith Fitness', color: '#10B981', description: 'Holistic wellness and boutique athletic gym' },
  ];

  const brands = [];
  for (const b of brandsData) {
    const brand = await prisma.brand.create({
      data: {
        workspaceId: workspace.id,
        name: b.name,
        color: b.color,
        description: b.description,
      },
    });
    brands.push(brand);
  }
  console.log(`✓ Created ${brands.length} brands`);

  // 3. Users (one per role)
  const defaultPassword = 'Password123!@#';
  const hashedPassword = await argon2.hash(defaultPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const usersConfig: { email: string; name: string; title: string; role: Role; allBrands: boolean }[] = [
    { email: process.env.SEED_OWNER_EMAIL || 'owner@example.com', name: 'Devon Miles', title: 'Agency Founder & CEO', role: 'OWNER', allBrands: true },
    { email: 'admin@example.com', name: 'Sophia Chen', title: 'Operations Director', role: 'ADMIN', allBrands: true },
    { email: 'manager@example.com', name: 'Marcus Vance', title: 'Senior Brand Strategist', role: 'MANAGER', allBrands: false },
    { email: 'editor@example.com', name: 'Aria Montgomery', title: 'Creative Content Writer', role: 'EDITOR', allBrands: false },
    { email: 'community@example.com', name: 'Liam Davies', title: 'Community & Engagement Specialist', role: 'COMMUNITY', allBrands: false },
    { email: 'analyst@example.com', name: 'Elena Rostova', title: 'Data & Growth Analyst', role: 'ANALYST', allBrands: true },
    { email: 'client@example.com', name: 'Victoria Sterling', title: 'Acme VP Marketing', role: 'CLIENT', allBrands: false },
  ];

  const createdUsers: Record<Role, any> = {} as any;

  for (const u of usersConfig) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        name: u.name,
        title: u.title,
        passwordHash: hashedPassword,
      },
    });

    createdUsers[u.role] = user;

    const membership = await prisma.membership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: u.role,
        status: 'ACTIVE',
        allBrands: u.allBrands,
      },
    });

    if (!u.allBrands) {
      // Assign specific brands
      if (u.role === 'CLIENT') {
        // Client only has Acme Corp
        await prisma.membershipBrand.create({
          data: { membershipId: membership.id, brandId: brands[0].id },
        });
      } else {
        // Manager, Editor, Community get first 2-3 brands
        await prisma.membershipBrand.create({
          data: { membershipId: membership.id, brandId: brands[0].id },
        });
        await prisma.membershipBrand.create({
          data: { membershipId: membership.id, brandId: brands[1].id },
        });
        if (u.role === 'MANAGER') {
          await prisma.membershipBrand.create({
            data: { membershipId: membership.id, brandId: brands[2].id },
          });
        }
      }
    }
  }

  console.log(`✓ Created 7 users with default credentials:`);
  console.log(`-----------------------------------------------------------------`);
  console.log(`Default password for all seed accounts: ${defaultPassword}`);
  console.log(`Owner:     ${usersConfig[0].email}`);
  console.log(`Admin:     admin@example.com`);
  console.log(`Manager:   manager@example.com`);
  console.log(`Editor:    editor@example.com`);
  console.log(`Community: community@example.com`);
  console.log(`Analyst:   analyst@example.com`);
  console.log(`Client:    client@example.com`);
  console.log(`-----------------------------------------------------------------`);

  // 4. Channels (Mock channels properly mapped to each brand)
  const channelConfigs: { brandIdx: number; network: Network; handle: string; followers: number }[] = [
    // 0. Hollow Home
    { brandIdx: 0, network: 'INSTAGRAM', handle: 'hollowhome', followers: 248400 },
    { brandIdx: 0, network: 'PINTEREST', handle: 'hollowhome', followers: 110200 },
    { brandIdx: 0, network: 'FACEBOOK', handle: 'Hollow Home', followers: 74500 },
    { brandIdx: 0, network: 'YOUTUBE', handle: 'Hollow Home', followers: 148500 },

    // 1. Vantage Garage
    { brandIdx: 1, network: 'INSTAGRAM', handle: 'vantagegarage', followers: 154200 },
    { brandIdx: 1, network: 'FACEBOOK', handle: 'Vantage Garage', followers: 82000 },
    { brandIdx: 1, network: 'YOUTUBE', handle: 'Vantage Garage', followers: 210000 },
    { brandIdx: 1, network: 'TIKTOK', handle: 'vantagegarage', followers: 98000 },

    // 2. Acme Corp
    { brandIdx: 2, network: 'LINKEDIN', handle: 'acme-corp-global', followers: 42800 },
    { brandIdx: 2, network: 'X', handle: 'AcmeHQ', followers: 28400 },
    { brandIdx: 2, network: 'INSTAGRAM', handle: 'acmecorp_official', followers: 18500 },
    { brandIdx: 2, network: 'FACEBOOK', handle: 'Acme Corporation', followers: 35000 },

    // 3. Starlight Bakery
    { brandIdx: 3, network: 'INSTAGRAM', handle: 'starlight_bakes', followers: 64200 },
    { brandIdx: 3, network: 'FACEBOOK', handle: 'StarlightBakeryShop', followers: 23100 },
    { brandIdx: 3, network: 'TIKTOK', handle: 'starlightbakery', followers: 98400 },
    { brandIdx: 3, network: 'PINTEREST', handle: 'starlightbakery', followers: 45000 },

    // 4. Nexus Tech
    { brandIdx: 4, network: 'X', handle: 'NexusTechAI', followers: 154000 },
    { brandIdx: 4, network: 'LINKEDIN', handle: 'nexus-technologies', followers: 89000 },
    { brandIdx: 4, network: 'YOUTUBE', handle: 'NexusTechOfficial', followers: 210000 },
    { brandIdx: 4, network: 'TIKTOK', handle: 'nexustech', followers: 75000 },

    // 5. Zenith Fitness
    { brandIdx: 5, network: 'INSTAGRAM', handle: 'zenith_fitclub', followers: 51200 },
    { brandIdx: 5, network: 'THREADS', handle: 'zenithfit', followers: 12400 },
    { brandIdx: 5, network: 'TIKTOK', handle: 'zenith_workouts', followers: 77900 },
    { brandIdx: 5, network: 'YOUTUBE', handle: 'Zenith Fitness', followers: 92000 },
  ];

  const createdChannels: any[] = [];
  for (const c of channelConfigs) {
    const brand = brands[c.brandIdx];
    const channel = await prisma.channel.create({
      data: {
        workspaceId: workspace.id,
        brandId: brand.id,
        network: c.network,
        externalId: `mock_${c.network.toLowerCase()}_${brand.id.slice(-4)}`,
        handle: c.handle,
        followers: c.followers,
        status: 'CONNECTED',
        postingEnabled: true,
        accessTokenEnc: encrypt(`mock_token_for_${c.handle}`),
        lastSyncAt: new Date(),
      },
    });
    createdChannels.push(channel);
  }
  console.log(`✓ Created ${createdChannels.length} social channels`);

  // 5. Media Assets
  const mediaAssets = [];
  const assetTitles = [
    'Brand Keynote 2026 Slide',
    'Morning Sourdough Loaf Closeup',
    'AI Neural Engine Diagram',
    'Sunset Outdoor HIIT Training',
    'Product Launch Teaser Reel',
    'Customer Success Quote Card',
    'Weekend Croissant Basket',
    'Team Collaboration Workspace',
  ];

  for (let i = 0; i < assetTitles.length; i++) {
    const brand = brands[i % brands.length];
    const asset = await prisma.mediaAsset.create({
      data: {
        workspaceId: workspace.id,
        brandId: brand.id,
        kind: i % 4 === 1 ? 'video' : 'image',
        url: `https://images.unsplash.com/photo-${1500000000000 + i * 1000}?auto=format&fit=crop&w=1200&q=80`,
        thumbUrl: `https://images.unsplash.com/photo-${1500000000000 + i * 1000}?auto=format&fit=crop&w=400&q=80`,
        title: assetTitles[i],
        tags: ['marketing', 'visual', brand.name.toLowerCase().replace(/\s+/g, '-')],
        bytes: 1024 * (500 + i * 200),
        starred: i % 3 === 0,
      },
    });
    mediaAssets.push(asset);
  }
  console.log(`✓ Created ${mediaAssets.length} media assets`);

  // 6. Posts (60 posts across all statuses and 3 weeks)
  const now = new Date();
  const statuses: PostStatus[] = ['PUBLISHED', 'SCHEDULED', 'PENDING', 'CHANGES', 'DRAFT', 'FAILED'];
  
  console.log('Generating 60 posts with realistic lifecycle data...');
  for (let i = 0; i < 60; i++) {
    const status = statuses[i % statuses.length];
    const brand = brands[i % brands.length];
    const author = i % 2 === 0 ? createdUsers.EDITOR : createdUsers.MANAGER;

    let scheduledAt: Date | null = null;
    let publishedAt: Date | null = null;

    if (status === 'PUBLISHED') {
      const daysAgo = (i % 14) + 1;
      publishedAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000 + i * 3600000);
      scheduledAt = publishedAt;
    } else if (status === 'SCHEDULED') {
      const daysAhead = (i % 7) + 1;
      scheduledAt = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000 + (i % 8) * 3600000);
    } else if (status === 'PENDING') {
      const daysAhead = (i % 5) + 2;
      scheduledAt = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    } else if (status === 'CHANGES') {
      scheduledAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    }

    const post = await prisma.post.create({
      data: {
        workspaceId: workspace.id,
        brandId: brand.id,
        authorId: author.id,
        caption: `Exciting updates from ${brand.name}! We are redefining modern standards with passion and craft. #excellence #${brand.name.replace(/\s+/g, '')} #update [Post #${i + 1}]`,
        firstComment: brand.name === 'Acme Corp' ? 'Read our full whitepaper here: https://example.com/research' : null,
        status,
        scheduledAt,
        publishedAt,
        version: status === 'CHANGES' ? 2 : 1,
      },
    });

    // Link a media asset
    const asset = mediaAssets[i % mediaAssets.length];
    await prisma.postMedia.create({
      data: {
        postId: post.id,
        assetId: asset.id,
        position: 0,
        altText: `High resolution creative asset for ${brand.name}`,
      },
    });

    // Link targets (brand channels)
    const brandChannels = createdChannels.filter((ch) => ch.brandId === brand.id);
    for (const channel of brandChannels) {
      await prisma.postTarget.create({
        data: {
          postId: post.id,
          channelId: channel.id,
          status: status === 'PUBLISHED' ? 'PUBLISHED' : status === 'FAILED' ? 'FAILED' : 'QUEUED',
          externalPostId: status === 'PUBLISHED' ? `ext_pub_${post.id.slice(-6)}_${channel.network}` : null,
          publishedAt,
          metrics:
            status === 'PUBLISHED'
              ? {
                  impressions: 1200 + (i * 37) % 5000,
                  reach: 980 + (i * 29) % 4200,
                  likes: 85 + (i * 7) % 350,
                  comments: 12 + (i * 3) % 45,
                  shares: 8 + (i * 2) % 30,
                  saves: 20 + i % 50,
                  clicks: 45 + (i * 4) % 180,
                }
              : undefined,
        },
      });
    }

    // Reviews
    if (status === 'PENDING') {
      await prisma.review.create({
        data: {
          postId: post.id,
          byId: author.id,
          decision: 'SUBMITTED',
          postVersion: 1,
          note: 'Ready for client review and approval.',
        },
      });
    } else if (status === 'CHANGES') {
      await prisma.review.create({
        data: {
          postId: post.id,
          byId: createdUsers.CLIENT.id,
          decision: 'CHANGES_REQUESTED',
          postVersion: 1,
          note: 'Please update the CTA link and mention the 20% spring promotion in the first sentence.',
        },
      });
    } else if (status === 'SCHEDULED' || status === 'PUBLISHED') {
      await prisma.review.create({
        data: {
          postId: post.id,
          byId: createdUsers.CLIENT.id,
          decision: 'APPROVED',
          postVersion: 1,
          note: 'Approved for broadcast! Looking great.',
        },
      });
    }
  }

  // 7. Conversations & Messages in Inbox (30 conversations)
  console.log('Generating 30 conversations with thread history...');
  const sentiments: Sentiment[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
  const authors = ['Alex Rivera', 'Maya Lin', 'David K.', 'Sarah Connor', 'Jordan Bell', 'Priya Patel'];

  for (let i = 0; i < 30; i++) {
    const channel = createdChannels[i % createdChannels.length];
    const sentiment = sentiments[i % sentiments.length];
    const authorName = authors[i % authors.length];
    const isPriority = sentiment === 'NEGATIVE' || i % 7 === 0;

    const convo = await prisma.conversation.create({
      data: {
        workspaceId: workspace.id,
        channelId: channel.id,
        type: i % 3 === 0 ? 'DM' : i % 3 === 1 ? 'COMMENT' : 'MENTION',
        externalId: `msg_${channel.network.toLowerCase()}_${i + 1}`,
        authorName,
        authorHandle: `@${authorName.toLowerCase().replace(/[^a-z]/g, '')}`,
        status: i % 4 === 0 ? 'CLOSED' : 'OPEN',
        sentiment,
        priority: isPriority,
        unread: i % 3 !== 0,
        assigneeId: i % 2 === 0 ? createdUsers.COMMUNITY.id : null,
        lastMessageAt: new Date(now.getTime() - i * 1800000),
      },
    });

    // Inbound message
    await prisma.message.create({
      data: {
        conversationId: convo.id,
        direction: 'IN',
        body:
          sentiment === 'POSITIVE'
            ? 'Absolutely loved the new release! How can I order in bulk for our team?'
            : sentiment === 'NEGATIVE'
            ? 'We have been waiting for our order delivery for 5 days with no tracking updates. Please assist!'
            : 'Could you please confirm if this product is compatible with iOS 18?',
        sentAt: new Date(now.getTime() - i * 1800000 - 300000),
      },
    });

    // Reply or internal note
    if (i % 2 === 0) {
      await prisma.message.create({
        data: {
          conversationId: convo.id,
          direction: 'OUT',
          authorUserId: createdUsers.COMMUNITY.id,
          body: `Hi ${authorName.split(' ')[0]}! Thanks for reaching out. We have flagged this for immediate priority handling.`,
          sentAt: new Date(now.getTime() - i * 1800000),
        },
      });
    } else if (isPriority) {
      await prisma.message.create({
        data: {
          conversationId: convo.id,
          direction: 'NOTE',
          authorUserId: createdUsers.COMMUNITY.id,
          body: 'Internal note: Customer contacted support email previously, escalated to account team.',
          sentAt: new Date(now.getTime() - i * 1800000),
        },
      });
    }
  }

  // 8. Keywords and Listening Mentions
  console.log('Generating listening keywords and mentions...');
  const keywordData: { brandIdx: number; kind: KeywordKind; term: string }[] = [
    { brandIdx: 0, kind: 'BRAND', term: 'Acme Cloud' },
    { brandIdx: 0, kind: 'COMPETITOR', term: 'GlobalCloud Inc' },
    { brandIdx: 1, kind: 'BRAND', term: 'Starlight Bakery' },
    { brandIdx: 1, kind: 'HASHTAG', term: '#OrganicSourdough' },
    { brandIdx: 2, kind: 'TOPIC', term: 'Edge AI inference' },
    { brandIdx: 3, kind: 'BRAND', term: 'Zenith Fitness' },
  ];

  for (const kw of keywordData) {
    const keyword = await prisma.keyword.create({
      data: {
        brandId: brands[kw.brandIdx].id,
        kind: kw.kind,
        term: kw.term,
      },
    });

    for (let m = 0; m < 5; m++) {
      await prisma.mention.create({
        data: {
          workspaceId: workspace.id,
          keywordId: keyword.id,
          network: m % 2 === 0 ? 'X' : 'LINKEDIN',
          externalId: `mention_${keyword.id.slice(-4)}_${m}`,
          authorName: `IndustryVoice_${m}`,
          authorHandle: `@voice_${m}`,
          text: `Talking about ${kw.term}: solid innovation happening this quarter! Really looking forward to the next steps.`,
          reach: 2500 + m * 1400,
          sentiment: m % 3 === 0 ? 'POSITIVE' : 'NEUTRAL',
          postedAt: new Date(now.getTime() - m * 86400000),
        },
      });
    }
  }

  // 9. MetricDaily (90 days history for channels)
  console.log('Generating 90 days of daily metrics per channel...');
  for (const channel of createdChannels) {
    for (let d = 0; d < 90; d++) {
      const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
      const dateOnly = new Date(date.toISOString().split('T')[0]);
      await prisma.metricDaily.create({
        data: {
          channelId: channel.id,
          date: dateOnly,
          followers: channel.followers - Math.floor(d * 15 * (1 + (channel.followers % 3))),
          impressions: 800 + Math.floor(Math.sin(d) * 300) + (d % 5) * 200,
          reach: 600 + Math.floor(Math.sin(d) * 200) + (d % 4) * 150,
          engagements: 45 + (d % 20) * 8,
          clicks: 18 + (d % 10) * 4,
          postsPublished: d % 3 === 0 ? 1 : 0,
        },
      });
    }
  }

  // 10. Templates, Hashtags, Saved Replies
  await prisma.savedReply.createMany({
    data: [
      { workspaceId: workspace.id, title: 'Order Status Inquiry', body: 'Hi {name}! Thanks for checking in. Our support team is tracking your package and we will update you within the hour.' },
      { workspaceId: workspace.id, title: 'Partnership & Collab', body: 'Hello {name}! We would love to explore a collaboration with {brand}. Please send your media deck to partners@vsadda.local.' },
      { workspaceId: workspace.id, title: 'Pricing & Tiers', body: 'Hi {name}! You can view our detailed pricing packages directly on our website or book an intro call with our specialists.' },
    ],
  });

  await prisma.template.createMany({
    data: [
      { workspaceId: workspace.id, title: 'Product Launch Announcement', body: 'Exciting news! We are officially introducing {blank} to our lineup. Designed specifically for {blank}. Available now: {blank}' },
      { workspaceId: workspace.id, title: 'Customer Spotlight Feature', body: 'Huge shoutout to {blank} for achieving {blank} with our tools! Discover their full story here: {blank}' },
    ],
  });

  await prisma.hashtagSet.createMany({
    data: [
      { brandId: brands[0].id, name: 'B2B Enterprise', tags: ['cloud', 'enterprise', 'cybersecurity', 'saas', 'scalability'] },
      { brandId: brands[1].id, name: 'Bakery Favorites', tags: ['bakery', 'sourdough', 'pastrychef', 'artisanbread', 'morningbakes'] },
    ],
  });

  // 11. Initial Audit Logs
  await prisma.auditLog.createMany({
    data: [
      { workspaceId: workspace.id, actorId: createdUsers.OWNER.id, action: 'workspace.created', entity: 'Workspace', entityId: workspace.id, at: new Date(now.getTime() - 21 * 86400000) },
      { workspaceId: workspace.id, actorId: createdUsers.ADMIN.id, action: 'channel.connected', entity: 'Channel', entityId: createdChannels[0].id, brandId: brands[0].id, at: new Date(now.getTime() - 14 * 86400000) },
      { workspaceId: workspace.id, actorId: createdUsers.CLIENT.id, action: 'post.approved', entity: 'Post', brandId: brands[0].id, at: new Date(now.getTime() - 2 * 86400000) },
    ],
  });

  console.log('✅ Seed completed successfully! All entities, 60 posts, 30 conversations, and 90-day metrics created.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
