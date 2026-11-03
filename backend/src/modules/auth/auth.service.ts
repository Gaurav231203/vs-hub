import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signAccessToken, generateRefreshTokenString, hashRefreshToken } from '../../lib/jwt.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { generateTotpSecret, generateQrUri, verifyTotpToken } from '../../lib/totp.js';
import { AppError } from '../../middleware/error.js';
import { ROLE_PERMISSIONS, Role } from '@postdesk/shared';

// In-memory 2FA challenges map (5-minute TTL)
interface ChallengeData {
  userId: string;
  expiresAt: number;
}
const challenges = new Map<string, ChallengeData>();

export class AuthService {
  static async login(email: string, pass: string, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: {
            workspace: true,
            brands: true,
          },
        },
      },
    });

    const now = new Date();

    if (user?.lockedUntil && user.lockedUntil > now) {
      const waitSeconds = Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000);
      throw new AppError(
        'RATE_LIMITED',
        `Account is temporarily locked due to multiple failed login attempts. Please try again in ${Math.ceil(waitSeconds / 60)} minutes.`,
        429,
        { retryAfter: waitSeconds }
      );
    }

    if (!user) {
      throw new AppError('UNAUTHENTICATED', 'Email or password is incorrect', 401);
    }

    const isValid = await verifyPassword(user.passwordHash, pass);
    if (!isValid) {
      const failed = user.failedLogins + 1;
      let lockedUntil: Date | null = null;
      if (failed >= 5) {
        lockedUntil = new Date(now.getTime() + 15 * 60 * 1000); // 15 min lockout
      }
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: failed, lockedUntil },
      });

      if (failed >= 5) {
        throw new AppError(
          'RATE_LIMITED',
          'Account has been temporarily locked for 15 minutes due to 5 consecutive failed login attempts.',
          429,
          { retryAfter: 900 }
        );
      }
      throw new AppError('UNAUTHENTICATED', 'Email or password is incorrect', 401);
    }

    // Reset failed logins
    if (user.failedLogins > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: 0, lockedUntil: null, lastActiveAt: now },
      });
    }

    if (user.totpEnabled) {
      const challengeId = crypto.randomUUID();
      challenges.set(challengeId, {
        userId: user.id,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return {
        needs2fa: true,
        challengeId,
      };
    }

    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      throw new AppError('FORBIDDEN', 'User is not assigned to any active workspace', 403);
    }

    return await this.issueSession(user, primaryMembership.workspaceId, ip, userAgent);
  }

  static async verify2fa(challengeId: string, code: string, ip?: string, userAgent?: string) {
    const challenge = challenges.get(challengeId);
    if (!challenge || challenge.expiresAt < Date.now()) {
      challenges.delete(challengeId);
      throw new AppError('UNAUTHENTICATED', '2FA challenge has expired or is invalid. Please log in again.', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.userId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { workspace: true },
        },
      },
    });

    if (!user || !user.totpSecretEnc) {
      challenges.delete(challengeId);
      throw new AppError('UNAUTHENTICATED', '2FA configuration not found', 401);
    }

    const secret = decrypt(user.totpSecretEnc);
    let verified = verifyTotpToken(code, secret);

    // If TOTP code fails, check recovery codes
    if (!verified && Array.isArray(user.recoveryCodes)) {
      const storedHashes = user.recoveryCodes as string[];
      let matchedIndex = -1;
      for (let i = 0; i < storedHashes.length; i++) {
        if (await verifyPassword(storedHashes[i], code)) {
          matchedIndex = i;
          break;
        }
      }

      if (matchedIndex !== -1) {
        verified = true;
        // Remove used recovery code
        storedHashes.splice(matchedIndex, 1);
        await prisma.user.update({
          where: { id: user.id },
          data: { recoveryCodes: storedHashes },
        });
      }
    }

    if (!verified) {
      throw new AppError('UNAUTHENTICATED', 'Invalid verification code or recovery code', 401);
    }

    challenges.delete(challengeId);

    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      throw new AppError('FORBIDDEN', 'User is not assigned to any active workspace', 403);
    }

    return await this.issueSession(user, primaryMembership.workspaceId, ip, userAgent);
  }

  static async refresh(rawToken: string, ip?: string, userAgent?: string) {
    const tokenHash = hashRefreshToken(rawToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: 'ACTIVE' },
            },
          },
        },
      },
    });

    if (!stored) {
      throw new AppError('UNAUTHENTICATED', 'Invalid refresh token', 401);
    }

    // Reuse detection: If a revoked token is presented, revoke the ENTIRE family!
    if (stored.revokedAt) {
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId },
        data: { revokedAt: new Date() },
      });
      throw new AppError(
        'UNAUTHENTICATED',
        'Session security violation: reuse of revoked token detected. All sessions revoked.',
        401
      );
    }

    if (stored.expiresAt < new Date()) {
      throw new AppError('UNAUTHENTICATED', 'Refresh token has expired', 401);
    }

    const user = stored.user;
    const primaryMembership = user.memberships[0];
    if (!primaryMembership) {
      throw new AppError('FORBIDDEN', 'User has no active workspace membership', 403);
    }

    // Mark current token as revoked
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    // Issue new token in same family
    const newRawRefreshToken = generateRefreshTokenString();
    const newHash = hashRefreshToken(newRawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: newHash,
        familyId: stored.familyId,
        userAgent: userAgent || null,
        ip: ip || null,
        expiresAt,
      },
    });

    const accessToken = signAccessToken({
      userId: user.id,
      workspaceId: primaryMembership.workspaceId,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresAt,
    };
  }

  static async logout(rawToken?: string) {
    if (!rawToken) return;
    const tokenHash = hashRefreshToken(rawToken);
    await prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  static async getMe(userId: string, workspaceId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        title: true,
        avatarUrl: true,
        totpEnabled: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    const membership = await prisma.membership.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      include: {
        workspace: true,
        brands: {
          include: {
            brand: true,
          },
        },
      },
    });

    if (!membership) {
      throw new AppError('FORBIDDEN', 'User is not a member of this workspace', 403);
    }

    let brands = [];
    if (membership.allBrands) {
      brands = await prisma.brand.findMany({
        where: { workspaceId },
      });
    } else {
      brands = membership.brands.map((b) => b.brand);
    }

    const perms = ROLE_PERMISSIONS[membership.role as Role] || [];

    return {
      user,
      workspace: membership.workspace,
      role: membership.role,
      permissions: perms,
      allBrands: membership.allBrands,
      brands,
      brandIds: brands.map((b) => b.id),
    };
  }

  static async getInvitePreview(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = await prisma.invite.findUnique({
      where: { tokenHash },
      include: {
        workspace: true,
      },
    });

    if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
      throw new AppError('NOT_FOUND', 'This invite link is invalid, expired, or has already been used.', 404);
    }

    return {
      email: invite.email,
      role: invite.role,
      workspaceName: invite.workspace.name,
      expiresAt: invite.expiresAt,
    };
  }

  static async acceptInvite(token: string, name: string, pass: string, ip?: string, userAgent?: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = await prisma.invite.findUnique({
      where: { tokenHash },
    });

    if (!invite || invite.expiresAt < new Date() || invite.acceptedAt) {
      throw new AppError('NOT_FOUND', 'This invite is invalid, expired, or has already been accepted', 404);
    }

    let user = await prisma.user.findUnique({
      where: { email: invite.email.toLowerCase() },
    });

    if (!user) {
      const passHash = await hashPassword(pass);
      user = await prisma.user.create({
        data: {
          email: invite.email.toLowerCase(),
          name,
          passwordHash: passHash,
        },
      });
    } else {
      // Existing user: Do NOT destroy their existing password!
      // Only set name if not already set
      if (!user.name && name) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { name },
        });
      }
    }

    // Activate or create membership
    const membership = await prisma.membership.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: user.id,
        },
      },
      update: {
        role: invite.role,
        status: 'ACTIVE',
        allBrands: invite.role === 'OWNER' || invite.role === 'ADMIN',
      },
      create: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.role,
        status: 'ACTIVE',
        allBrands: invite.role === 'OWNER' || invite.role === 'ADMIN',
      },
    });

    // Assign brands if specified
    const brandIds = Array.isArray(invite.brandIds) ? (invite.brandIds as string[]) : [];
    for (const bId of brandIds) {
      await prisma.membershipBrand.upsert({
        where: {
          membershipId_brandId: {
            membershipId: membership.id,
            brandId: bId,
          },
        },
        update: {},
        create: {
          membershipId: membership.id,
          brandId: bId,
        },
      });
    }

    // Mark invite accepted
    await prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        workspaceId: invite.workspaceId,
        actorId: user.id,
        action: 'invite.accepted',
        entity: 'Membership',
        entityId: membership.id,
        ip: ip || null,
      },
    });

    return await this.issueSession(user, invite.workspaceId, ip, userAgent);
  }

  static async forgotPassword(email: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (user) {
      // In production: generate random reset token, store hash, and send email via nodemailer
      // For development, we create an audit log and always respond with 202
      const resetToken = crypto.randomBytes(32).toString('hex');
      console.log(`[DEV] Password reset requested for ${user.email}. Reset token: ${resetToken}`);
    }

    // Always 202 Accepted (prevents email enumeration)
    return { status: 'accepted', message: 'If an account exists with that email, a password reset link has been sent.' };
  }

  static async setup2fa(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new AppError('NOT_FOUND', 'User not found', 404);

    const secret = generateTotpSecret();
    const qrUri = generateQrUri(user.email, secret);

    // Generate 8 alphanumeric recovery codes
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 char hex
      plainCodes.push(code);
      hashedCodes.push(await hashPassword(code));
    }

    const secretEnc = encrypt(secret);

    await prisma.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: secretEnc,
        recoveryCodes: hashedCodes,
      },
    });

    return {
      qrUri,
      secret, // Manual entry key
      recoveryCodes: plainCodes, // Shown ONCE to the user
    };
  }

  static async confirm2fa(userId: string, code: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user || !user.totpSecretEnc) {
      throw new AppError('BAD_REQUEST', '2FA has not been initiated for this account', 400);
    }

    const secret = decrypt(user.totpSecretEnc);
    const valid = verifyTotpToken(code, secret);
    if (!valid) {
      throw new AppError('VALIDATION', 'Invalid verification code. Please check your authenticator app.', 422);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });

    return { success: true };
  }

  static async disable2fa(userId: string) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        totpEnabled: false,
        totpSecretEnc: null,
        recoveryCodes: Prisma.DbNull,
      },
    });
    return { success: true };
  }

  private static async issueSession(user: any, workspaceId: string, ip?: string, userAgent?: string) {
    const accessToken = signAccessToken({
      userId: user.id,
      workspaceId,
    });

    const rawRefreshToken = generateRefreshTokenString();
    const tokenHash = hashRefreshToken(rawRefreshToken);
    const familyId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId,
        userAgent: userAgent || null,
        ip: ip || null,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresAt,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        title: user.title,
        avatarUrl: user.avatarUrl,
        totpEnabled: user.totpEnabled,
      },
      workspaceId,
    };
  }
}
