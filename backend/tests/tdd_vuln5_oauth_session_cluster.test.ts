import { prisma } from '../src/lib/prisma.js';
import { generateSecureToken, decrypt, encrypt } from '../src/lib/crypto.js';
import { OAuthSessionService } from '../src/modules/invites/oauthSession.service.js';
import { Network } from '@prisma/client';

async function runTest() {
  console.log('--- [TDD TEST 5] Multi-Instance Resilient Encrypted OAuth Sessions ---');

  const workspace = await prisma.workspace.findFirstOrThrow();
  const brand = await prisma.brand.findFirstOrThrow({ where: { workspaceId: workspace.id } });
  const author = await prisma.user.findFirstOrThrow();

  const { raw, hash } = generateSecureToken(32);
  const invite = await prisma.connectInvite.create({
    data: {
      workspaceId: workspace.id,
      brandId: brand.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 86400000),
      createdBy: author.id,
    },
  });

  const rawPageToken = 'EAAX_SUPER_SECRET_TOKEN_12345';
  const candidates = [
    {
      pageId: 'page_1001',
      pageName: 'Bakery Main Page',
      pageToken: rawPageToken,
      instagram: {
        id: 'ig_1001',
        username: 'bakery_ig',
      },
    },
    {
      pageId: 'page_1002',
      pageName: 'Bakery Outlet 2',
      pageToken: 'EAAX_SUPER_SECRET_TOKEN_67890',
    },
  ];

  try {
    // 1. Save Session to DB (Simulating Instance A OAuth Callback)
    const sessionId = await OAuthSessionService.saveSession({
      inviteToken: raw,
      workspaceId: workspace.id,
      brandId: brand.id,
      candidates,
      ttlMs: 15 * 60 * 1000,
    });
    console.log('Session created on Instance A with ID:', sessionId);

    // 2. Direct DB Inspection: Verify AES-256-GCM encryption at rest!
    const rawDbRecord = await prisma.oAuthSession.findUniqueOrThrow({ where: { id: sessionId } });
    if (rawDbRecord.candidatesEnc.includes(rawPageToken)) {
      throw new Error('CRITICAL SECURITY VIOLATION: Page tokens are stored in PLAINTEXT in the database!');
    }
    if (!rawDbRecord.candidatesEnc.startsWith('v1:')) {
      throw new Error('FAIL: Database record is not encrypted with v1: AES-256-GCM format!');
    }
    console.log('✅ Verified: Candidate page tokens are AES-256-GCM encrypted at rest.');

    // 3. Multi-Instance Fetch: Simulate Instance B reading session from DB
    const fetchedCandidates = await OAuthSessionService.getCandidatesForClient(sessionId);
    if (fetchedCandidates.length !== 2 || fetchedCandidates[0].pageId !== 'page_1001') {
      throw new Error('FAIL: Instance B failed to retrieve candidate pages from database session!');
    }
    // Verify client view does NOT expose sensitive raw pageToken
    if ((fetchedCandidates[0] as any).pageToken !== undefined) {
      throw new Error('FAIL: Client endpoint exposed internal pageToken!');
    }
    console.log('✅ Verified: Instance B retrieved sanitized candidate pages across cluster.');

    // 4. Page Selection & Token Binding
    const selected = await OAuthSessionService.consumeSessionAndGetPage(sessionId, raw, 'page_1001');
    if (selected.pageId !== 'page_1001' || selected.pageToken !== rawPageToken) {
      throw new Error('FAIL: Failed to decrypt and retrieve full page credentials on selection!');
    }

    // Verify session record is consumed and deleted (single-use)
    const sessionAfterConsume = await prisma.oAuthSession.findUnique({ where: { id: sessionId } });
    if (sessionAfterConsume !== null) {
      throw new Error('FAIL: OAuthSession was not purged from DB after consume!');
    }
    console.log('✅ Verified: Session safely consumed and purged from database.');

    // 5. Expiration Test (TTL)
    const expiredSessionId = await OAuthSessionService.saveSession({
      inviteToken: raw,
      workspaceId: workspace.id,
      brandId: brand.id,
      candidates,
      ttlMs: -1000, // already expired
    });

    let expiredThrew = false;
    try {
      await OAuthSessionService.getCandidatesForClient(expiredSessionId);
    } catch (e: any) {
      expiredThrew = true;
      console.log('✅ Expired session correctly rejected with message:', e.message);
    }
    if (!expiredThrew) {
      throw new Error('FAIL: Expired session was accepted!');
    }

    console.log('✅ TDD TEST 5 PASSED: Multi-instance encrypted OAuth sessions verified.');
  } finally {
    await prisma.connectInvite.delete({ where: { id: invite.id } });
  }
}

runTest().catch((err) => {
  console.error('❌ TDD TEST 5 FAILED:', err.message);
  process.exit(1);
});
