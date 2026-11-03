import { prisma } from '../src/lib/prisma.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { TeamService } from '../src/modules/team/team.service.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { Role } from '@prisma/client';

async function runTest() {
  console.log('--- [TDD TEST FIX 1] Safe Multi-Workspace Invite Flow (No Account Takeover) ---');

  const timestamp = Date.now();
  const existingUserEmail = `freelancer_${timestamp}@design.studio`;
  const originalPassword = 'OriginalSecretPassword123!';

  // 1. Workspace A: Freelancer is an active user with their own password
  const wsA = await prisma.workspace.create({
    data: { name: `Primary Agency ${timestamp}` },
  });

  const passHash = await hashPassword(originalPassword);
  const user = await prisma.user.create({
    data: {
      email: existingUserEmail,
      name: 'Original Freelancer',
      passwordHash: passHash,
    },
  });

  await prisma.membership.create({
    data: {
      workspaceId: wsA.id,
      userId: user.id,
      role: Role.EDITOR,
      allBrands: true,
    },
  });

  // 2. Workspace B: Another agency invites this freelancer
  const wsB = await prisma.workspace.create({
    data: { name: `Second Agency ${timestamp}` },
  });

  const agencyOwner = await prisma.user.create({
    data: {
      email: `owner_${timestamp}@secondagency.com`,
      name: 'Owner B',
      passwordHash: await hashPassword('OwnerPass123!'),
    },
  });

  await prisma.membership.create({
    data: {
      workspaceId: wsB.id,
      userId: agencyOwner.id,
      role: Role.OWNER,
      allBrands: true,
    },
  });

  const inviterCtx = {
    userId: agencyOwner.id,
    workspaceId: wsB.id,
    role: Role.OWNER,
    perms: ['team.manage'],
    allBrands: true,
    brandIds: [],
  };

  const inviteResult = await TeamService.createInvite(inviterCtx, {
    email: existingUserEmail,
    role: Role.CLIENT,
    brandIds: [],
  });

  const rawToken = inviteResult.inviteUrl.split('/accept-invite/')[1];
  console.log('Created invite for existing user. Raw token acquired.');

  // Attacker / or inadvertent user calls acceptInvite with a DIFFERENT password
  const result = await AuthService.acceptInvite(rawToken, 'Changed Name', 'BrandNewOverwritingPassword999!');

  // 1. Verify user joined Workspace B
  const membershipB = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: wsB.id,
        userId: result.user.id,
      },
    },
  });
  if (!membershipB || membershipB.status !== 'ACTIVE') {
    throw new Error('FAIL: User was not added to Workspace B as an active member');
  }

  // 2. CRITICAL VERIFICATION: Original password MUST NOT be overwritten
  const refreshedUser = await prisma.user.findUnique({
    where: { email: existingUserEmail },
  });

  const isOriginalPassValid = await verifyPassword(refreshedUser!.passwordHash, originalPassword);
  const isNewOverwritingPassValid = await verifyPassword(refreshedUser!.passwordHash, 'BrandNewOverwritingPassword999!');

  console.log('Verification:');
  console.log('  Original password still valid?', isOriginalPassValid);
  console.log('  Overwriting password valid?', isNewOverwritingPassValid);

  if (!isOriginalPassValid) {
    throw new Error('CRITICAL VULNERABILITY FAILED: The original user password was destroyed/overwritten upon accepting an invite!');
  }

  if (isNewOverwritingPassValid) {
    throw new Error('CRITICAL VULNERABILITY FAILED: An unverified new password successfully overwrote the account password!');
  }

  console.log('✅ PASS: Existing user credentials preserved safely. No Account Takeover possible!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ TEST FAILED:', err.message);
  process.exit(1);
});
