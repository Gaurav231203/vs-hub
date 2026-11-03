import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fixing brand channels...');
  const brands = await prisma.brand.findMany();
  console.log('Found brands:', brands.map(b => b.name));

  const brandByName = (str: string) => brands.find(b => b.name.toLowerCase().includes(str.toLowerCase()));

  const acme = brandByName('Acme');
  const hollow = brandByName('Hollow');
  const vantage = brandByName('Vantage');
  const nexus = brandByName('Nexus');
  const starlight = brandByName('Starlight');
  const zenith = brandByName('Zenith');

  // Delete all existing channels to do a clean, accurate reassignment
  await prisma.postTarget.deleteMany();
  await prisma.channel.deleteMany();

  const brandMap = [
    {
      brand: acme,
      channels: [
        { network: 'LINKEDIN', handle: 'acme-corp-global', followers: 42800 },
        { network: 'X', handle: 'AcmeHQ', followers: 28400 },
        { network: 'INSTAGRAM', handle: 'acmecorp_official', followers: 18500 },
        { network: 'FACEBOOK', handle: 'Acme Corporation', followers: 35000 },
      ]
    },
    {
      brand: hollow,
      channels: [
        { network: 'INSTAGRAM', handle: 'hollowhome', followers: 248400 },
        { network: 'PINTEREST', handle: 'hollowhome', followers: 110200 },
        { network: 'FACEBOOK', handle: 'Hollow Home', followers: 74500 },
        { network: 'YOUTUBE', handle: 'Hollow Home', followers: 148500 },
      ]
    },
    {
      brand: vantage,
      channels: [
        { network: 'INSTAGRAM', handle: 'vantagegarage', followers: 154200 },
        { network: 'FACEBOOK', handle: 'Vantage Garage', followers: 82000 },
        { network: 'YOUTUBE', handle: 'Vantage Garage', followers: 210000 },
        { network: 'TIKTOK', handle: 'vantagegarage', followers: 98000 },
      ]
    },
    {
      brand: nexus,
      channels: [
        { network: 'X', handle: 'NexusTechAI', followers: 154000 },
        { network: 'LINKEDIN', handle: 'nexus-technologies', followers: 89000 },
        { network: 'YOUTUBE', handle: 'NexusTechOfficial', followers: 210000 },
        { network: 'TIKTOK', handle: 'nexustech', followers: 75000 },
      ]
    },
    {
      brand: starlight,
      channels: [
        { network: 'INSTAGRAM', handle: 'starlight_bakes', followers: 64200 },
        { network: 'FACEBOOK', handle: 'StarlightBakeryShop', followers: 23100 },
        { network: 'TIKTOK', handle: 'starlightbakery', followers: 98400 },
        { network: 'PINTEREST', handle: 'starlightbakery', followers: 45000 },
      ]
    },
    {
      brand: zenith,
      channels: [
        { network: 'INSTAGRAM', handle: 'zenith_fitclub', followers: 51200 },
        { network: 'THREADS', handle: 'zenithfit', followers: 12400 },
        { network: 'TIKTOK', handle: 'zenith_workouts', followers: 77900 },
        { network: 'YOUTUBE', handle: 'Zenith Fitness', followers: 92000 },
      ]
    }
  ];

  for (const entry of brandMap) {
    if (!entry.brand) continue;
    console.log(`Setting up channels for ${entry.brand.name}...`);
    for (const c of entry.channels) {
      await prisma.channel.create({
        data: {
          workspaceId: entry.brand.workspaceId,
          brandId: entry.brand.id,
          network: c.network as any,
          externalId: `mock_${c.network.toLowerCase()}_${entry.brand.id.slice(-4)}`,
          handle: c.handle,
          followers: c.followers,
          status: 'CONNECTED',
          postingEnabled: true,
          accessTokenEnc: 'mock_token',
          lastSyncAt: new Date(),
        }
      });
    }
  }

  console.log('Channels properly re-assigned and seeded!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
