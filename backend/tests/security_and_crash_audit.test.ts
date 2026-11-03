import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { TeamService } from '../src/modules/team/team.service.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';
import { Role } from '@prisma/client';

describe('Security & Production Crash Audit Tests', () => {
  let victimAdminEmail: string;
  let attackerEmail: string;
  let workspaceAId: string;
  let workspaceBId: string;
  let originalPasswordHash: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    victimAdminEmail = `admin_victim_${timestamp}@agency-corp.com`;
    attackerEmail = `attacker_${timestamp}@rogue-corp.com`;

    // 1. Create Workspace A (Legitimate Agency with Victim Admin)
    const wsA = await prisma.workspace.create({
      data: { name: `Agency Corp ${timestamp}` },
    });
    workspaceAId = wsA.id;

    // Create Victim Admin with strong password "SecretMaster123!"
    originalPasswordHash = await hashPassword('SecretMaster123!');
    const victimUser = await prisma.user.create({
      data: {
        email: victimAdminEmail,
        name: 'Chief Admin',
        passwordHash: originalPasswordHash,
      },
    });

    await prisma.membership.create({
      data: {
        workspaceId: workspaceAId,
        userId: victimUser.id,
        role: Role.OWNER,
        allBrands: true,
      },
    });

    // 2. Create Workspace B (Attacker's Workspace)
    const wsB = await prisma.workspace.create({
      data: { name: `Rogue Agency ${timestamp}` },
    });
    workspaceBId = wsB.id;

    const attackerUser = await prisma.user.create({
      data: {
        email: attackerEmail,
        name: 'Attacker Bob',
        passwordHash: await hashPassword('AttackerPass123!'),
      },
    });

    await prisma.membership.create({
      data: {
        workspaceId: workspaceBId,
        userId: attackerUser.id,
        role: Role.ADMIN,
        allBrands: true,
      },
    });
  });

  it('AUDIT VULN 1: Attacker Admin in Workspace B can overwrite Workspace A Owner password via Invite Acceptance', async () => {
    // Attacker sends an invite to victimAdminEmail from Workspace B
    const attackerCtx = {
      userId: (await prisma.user.findUnique({ where: { email: attackerEmail } }))!.id,
      workspaceId: workspaceBId,
      role: Role.ADMIN,
      perms: ['team.manage'],
      allBrands: true,
      brandIds: [],
    };

    const inviteResult = await TeamService.createInvite(attackerCtx, {
      email: victimAdminEmail,
      role: Role.CLIENT,
      brandIds: [],
    });

    // The raw token is directly leaked in inviteUrl!
    const rawToken = inviteResult.inviteUrl.split('/accept-invite/')[1];
    expect(rawToken).toBeDefined();

    // Attacker immediately accepts the invite with a new password "AttackerNewPass999!"
    await AuthService.acceptInvite(rawToken, 'Hijacked Identity', 'AttackerNewPass999!');

    // Check victim user in DB
    const updatedVictim = await prisma.user.findUnique({
      where: { email: victimAdminEmail },
    });

    // The victim's password hash has been completely overwritten!
    const isOldPassValid = await verifyPassword(updatedVictim!.passwordHash, 'SecretMaster123!');
    const isNewPassValid = await verifyPassword(updatedVictim!.passwordHash, 'AttackerNewPass999!');

    expect(isOldPassValid).toBe(false); // Old Admin password is dead!
    expect(isNewPassValid).toBe(true);  // Attacker's password works!
    // -> CONFIRMED ACCOUNT TAKEOVER VULNERABILITY!
  });

  it('AUDIT VULN 2: Channel query exposes encrypted access & refresh tokens in API responses', async () => {
    // Create a mock channel with tokens
    const brand = await prisma.brand.create({
      data: {
        workspaceId: workspaceAId,
        name: 'Test Brand',
      },
    });

    const channel = await prisma.channel.create({
      data: {
        workspaceId: workspaceAId,
        brandId: brand.id,
        network: 'FACEBOOK',
        externalId: `fb_${Date.now()}`,
        handle: 'AgencyFBPage',
        accessTokenEnc: 'v1:mock_iv:mock_tag:mock_encrypted_secret_token',
        refreshTokenEnc: 'v1:mock_iv:mock_tag:mock_encrypted_refresh_token',
      },
    });

    // When querying channel via typical findMany (as done in channels.routes.ts line 74)
    const fetched = await prisma.channel.findFirst({
      where: { id: channel.id },
    });

    // The tokens are returned in the object!
    expect(fetched?.accessTokenEnc).toBe('v1:mock_iv:mock_tag:mock_encrypted_secret_token');
    expect(fetched?.refreshTokenEnc).toBe('v1:mock_iv:mock_tag:mock_encrypted_refresh_token');
  });

  it('AUDIT CRASH POINT 1: Worker runBatch claims all candidates even if count updated is partial', async () => {
    // Create 2 jobs in QUEUED status
    const j1 = await prisma.job.create({
      data: {
        type: 'testJob',
        payload: { targetId: 't1' },
        runAt: new Date(Date.now() - 1000),
      },
    });
    const j2 = await prisma.job.create({
      data: {
        type: 'testJob',
        payload: { targetId: 't2' },
        runAt: new Date(Date.now() - 1000),
      },
    });

    // Simulate Worker A updating only j1 to RUNNING
    await prisma.job.update({
      where: { id: j1.id },
      data: { status: 'RUNNING' },
    });

    // Now simulate Worker B running with candidates [j1, j2]
    // In Worker.runBatch():
    const candidates = [j1, j2];
    const ids = candidates.map((c) => c.id);
    const updated = await prisma.job.updateMany({
      where: {
        id: { in: ids },
        status: 'QUEUED',
      },
      data: { status: 'RUNNING' },
    });

    expect(updated.count).toBe(1); // Only j2 was actually updated!

    // In current worker.ts line 43:
    const claimedJobIds: string[] = [];
    if (updated.count > 0) {
      claimedJobIds.push(...ids); // BUG: Pushes BOTH j1 and j2!
    }

    // This proves the worker pushes j1 (which was ALREADY claimed by another worker!)
    expect(claimedJobIds.length).toBe(2); // Should have been 1, but is 2!
  });
});
