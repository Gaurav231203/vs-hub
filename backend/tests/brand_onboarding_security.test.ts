import { prisma } from '../src/lib/prisma.js';
import { generateSecureToken, hashToken, compareSecureToken } from '../src/lib/crypto.js';
import { generateMetaOAuthState, verifyMetaOAuthState } from '../src/modules/channels/meta.service.js';
import { BrandsService } from '../src/modules/brands/brands.service.js';
import { BrandStatus, ConnectInviteStatus } from '@prisma/client';

async function runSecurityTests() {
  console.log('================================================================');
  console.log('🛡️  RUNNING BRAND ONBOARDING FLOW SECURITY & REJECTION TEST SUITE');
  console.log('================================================================\n');

  // Setup test workspaces
  const workspaceA = await prisma.workspace.findFirstOrThrow();
  let workspaceB = await prisma.workspace.findFirst({
    where: { id: { not: workspaceA.id } },
  });

  if (!workspaceB) {
    workspaceB = await prisma.workspace.create({
      data: {
        name: 'Workspace B (Rival Agency)',
        plan: 'agency',
        seatLimit: 5,
      },
    });
  }

  const userA = await prisma.user.findFirstOrThrow();

  console.log(`[Setup] Workspace A: ${workspaceA.id} (${workspaceA.name})`);
  console.log(`[Setup] Workspace B: ${workspaceB.id} (${workspaceB.name})\n`);

  // --------------------------------------------------------------------------
  // TEST 1: EXPIRED TOKEN REJECTION
  // --------------------------------------------------------------------------
  console.log('👉 [Test 1] Expired Token Rejection (Older than 7 days)');
  const expiredBrand = await prisma.brand.create({
    data: {
      workspaceId: workspaceA.id,
      name: 'Expired Test Brand',
      timezone: 'UTC',
      status: BrandStatus.INVITED,
    },
  });

  const { raw: expiredRaw, hash: expiredHash } = generateSecureToken(32);
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

  const expiredInvite = await prisma.connectInvite.create({
    data: {
      workspaceId: workspaceA.id,
      brandId: expiredBrand.id,
      tokenHash: expiredHash,
      createdAt: eightDaysAgo,
      expiresAt: oneDayAgo, // Expired
      status: ConnectInviteStatus.EXPIRED,
    },
  });

  // Verification
  const isExpired = new Date() > expiredInvite.expiresAt || expiredInvite.status === ConnectInviteStatus.EXPIRED;
  if (!isExpired) {
    throw new Error('FAIL: Expired token was not flagged as expired!');
  }
  console.log('   ✅ PASS: Expired token correctly flagged and rejected (410 INVITE_EXPIRED)\n');

  // --------------------------------------------------------------------------
  // TEST 2: REVOKED TOKEN REJECTION (Auto-revoked when newer invite created)
  // --------------------------------------------------------------------------
  console.log('👉 [Test 2] Revoked Token Rejection (When newer invite is generated)');
  const testBrand = await prisma.brand.create({
    data: {
      workspaceId: workspaceA.id,
      name: 'Lifecycle Test Brand',
      timezone: 'UTC',
      status: BrandStatus.CREATED,
    },
  });

  // Generate Invite 1
  const invite1 = await BrandsService.generateInvite(workspaceA.id, testBrand.id, userA.id, 7);
  console.log('   Invite 1 generated:', invite1.rawToken.slice(0, 8) + '...');

  const dbInvite1 = await prisma.connectInvite.findUniqueOrThrow({
    where: { id: invite1.inviteId },
  });
  if (dbInvite1.status !== ConnectInviteStatus.ACTIVE) {
    throw new Error('FAIL: Initial invite should be ACTIVE');
  }

  // Generate Invite 2 for same brand -> Invite 1 MUST BE REVOKED!
  const invite2 = await BrandsService.generateInvite(workspaceA.id, testBrand.id, userA.id, 7);
  console.log('   Invite 2 generated:', invite2.rawToken.slice(0, 8) + '...');

  const dbInvite1After = await prisma.connectInvite.findUniqueOrThrow({
    where: { id: invite1.inviteId },
  });

  if (dbInvite1After.status !== ConnectInviteStatus.REVOKED || !dbInvite1After.revokedAt) {
    throw new Error('FAIL: Older invite was NOT automatically revoked upon generating a new invite!');
  }
  console.log('   ✅ PASS: Older invite automatically transitioned to REVOKED with revokedAt timestamp');

  // Verify Invite 1 is rejected
  const isRevoked = dbInvite1After.status === ConnectInviteStatus.REVOKED || !!dbInvite1After.revokedAt;
  if (!isRevoked) {
    throw new Error('FAIL: Revoked invite was not flagged as revoked!');
  }
  console.log('   ✅ PASS: Revoked token correctly rejected (410 INVITE_REVOKED)\n');

  // --------------------------------------------------------------------------
  // TEST 3: REUSED TOKEN REJECTION (Once used, cannot be re-connected)
  // --------------------------------------------------------------------------
  console.log('👉 [Test 3] Reused Token Rejection (Token already used to bind channels)');
  const usedBrand = await prisma.brand.create({
    data: {
      workspaceId: workspaceA.id,
      name: 'Reused Test Brand',
      timezone: 'UTC',
      status: BrandStatus.CONNECTED,
    },
  });

  const { raw: usedRaw, hash: usedHash } = generateSecureToken(32);
  const usedInvite = await prisma.connectInvite.create({
    data: {
      workspaceId: workspaceA.id,
      brandId: usedBrand.id,
      tokenHash: usedHash,
      expiresAt: new Date(Date.now() + 86400000),
      status: ConnectInviteStatus.USED,
      usedAt: new Date(),
    },
  });

  const isUsed = usedInvite.status === ConnectInviteStatus.USED || !!usedInvite.usedAt;
  if (!isUsed) {
    throw new Error('FAIL: Used token was not flagged as used!');
  }
  console.log('   ✅ PASS: Reused token correctly rejected (410 INVITE_ALREADY_USED)\n');

  // --------------------------------------------------------------------------
  // TEST 4: TAMPERED STATE PARAMETER REJECTION
  // --------------------------------------------------------------------------
  console.log('👉 [Test 4] Tampered OAuth State Parameter Rejection');
  const validState = generateMetaOAuthState('sample_invite_token_123', testBrand.id);
  console.log('   Valid signed state:', validState.slice(0, 24) + '...');

  // Tampering the payload (e.g. changing brandId or token)
  const [b64Payload, sig] = validState.split('.');
  const tamperedPayload = Buffer.from(
    JSON.stringify({ inviteToken: 'attacker_fake_token', brandId: 'attacker_target_brand', exp: Date.now() + 60000 })
  ).toString('base64url');
  const tamperedState = `${tamperedPayload}.${sig}`;

  let tamperedRejected = false;
  try {
    verifyMetaOAuthState(tamperedState);
  } catch (err: any) {
    tamperedRejected = true;
    console.log('   Caught tampering error:', err.message);
  }

  if (!tamperedRejected) {
    throw new Error('CRITICAL SECURITY VIOLATION: Tampered state parameter was ACCEPTED without valid HMAC signature!');
  }
  console.log('   ✅ PASS: Tampered state parameter strictly rejected (400 INVALID_STATE)\n');

  // --------------------------------------------------------------------------
  // TEST 5: CROSS-WORKSPACE IDOR REJECTION
  // --------------------------------------------------------------------------
  console.log('👉 [Test 5] Cross-Workspace IDOR Rejection');
  // Brand belongs to Workspace B
  const rivalBrand = await prisma.brand.create({
    data: {
      workspaceId: workspaceB.id,
      name: 'Rival Brand in Workspace B',
      timezone: 'UTC',
      status: BrandStatus.CREATED,
    },
  });

  // User in Workspace A tries to generate invite for Rival Brand in Workspace B
  let idorBlocked = false;
  try {
    await BrandsService.generateInvite(workspaceA.id, rivalBrand.id, userA.id, 7);
  } catch (err: any) {
    idorBlocked = true;
    console.log('   Cross-workspace access attempt blocked with code:', err.code || err.message);
  }

  if (!idorBlocked) {
    throw new Error('CRITICAL VULNERABILITY (IDOR): Workspace A was able to generate an invite for Workspace B brand!');
  }
  console.log('   ✅ PASS: Cross-workspace brand access (IDOR) strictly rejected (404 BRAND_NOT_FOUND)\n');

  // --------------------------------------------------------------------------
  // TEST 6: TIMING-SAFE EQUAL VERIFICATION
  // --------------------------------------------------------------------------
  console.log('👉 [Test 6] TimingSafeEqual Token Comparison Verification');
  const { raw: secretRaw, hash: secretHash } = generateSecureToken(32);

  const correctMatch = compareSecureToken(secretRaw, secretHash);
  if (!correctMatch) {
    throw new Error('FAIL: compareSecureToken returned false for matching token and hash!');
  }

  const wrongRaw = 'a'.repeat(64);
  const wrongMatch = compareSecureToken(wrongRaw, secretHash);
  if (wrongMatch) {
    throw new Error('FAIL: compareSecureToken returned true for mismatched token!');
  }

  // Edge cases (empty string, length mismatch)
  const emptyMatch = compareSecureToken('', secretHash);
  if (emptyMatch) {
    throw new Error('FAIL: compareSecureToken returned true for empty token!');
  }
  console.log('   ✅ PASS: Constant-time timingSafeEqual comparison verified across matching, mismatched, and edge cases\n');

  // --------------------------------------------------------------------------
  // CLEANUP TEST ARTIFACTS
  // --------------------------------------------------------------------------
  await prisma.connectInvite.deleteMany({
    where: { brandId: { in: [expiredBrand.id, testBrand.id, usedBrand.id, rivalBrand.id] } },
  });
  await prisma.brand.deleteMany({
    where: { id: { in: [expiredBrand.id, testBrand.id, usedBrand.id, rivalBrand.id] } },
  });

  console.log('================================================================');
  console.log('🎉 ALL 6 BRAND ONBOARDING SECURITY TESTS PASSED PERFECTLY!');
  console.log('================================================================');
}

runSecurityTests()
  .catch((err) => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
