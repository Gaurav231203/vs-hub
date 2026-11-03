import { prisma } from '../../lib/prisma.js';
import { UserContext, Role } from '@postdesk/shared';
import { AppError } from '../../middleware/error.js';
import crypto from 'crypto';

export class TeamService {
  /**
   * Team summary statistics: seats used vs limit, 2FA coverage
   */
  static async getStats(ctx: UserContext) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: ctx.workspaceId },
      select: { seatLimit: true },
    });

    const [activeCount, invitedCount, mfaUsersCount] = await Promise.all([
      prisma.membership.count({
        where: { workspaceId: ctx.workspaceId, status: 'ACTIVE' },
      }),
      prisma.invite.count({
        where: { workspaceId: ctx.workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } },
      }),
      prisma.membership.count({
        where: {
          workspaceId: ctx.workspaceId,
          status: 'ACTIVE',
          user: { totpEnabled: true },
        },
      }),
    ]);

    const seatsUsed = activeCount + invitedCount;
    const seatLimit = workspace?.seatLimit || 15;
    const mfaCoverage = activeCount > 0 ? Math.round((mfaUsersCount / activeCount) * 100) : 0;

    return {
      seatsUsed,
      seatLimit,
      activeMembers: activeCount,
      pendingInvites: invitedCount,
      mfaCoveragePct: mfaCoverage,
    };
  }

  /**
   * List all workspace members
   */
  static async listMembers(ctx: UserContext, search?: string, roleFilter?: string) {
    const where: any = {
      workspaceId: ctx.workspaceId,
    };

    if (roleFilter && roleFilter !== 'ALL') {
      where.role = roleFilter as Role;
    }

    if (search && search.trim()) {
      where.user = {
        OR: [
          { name: { contains: search.trim() } },
          { email: { contains: search.trim() } },
        ],
      };
    }

    const members = await prisma.membership.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            title: true,
            totpEnabled: true,
            createdAt: true,
          },
        },
        brands: {
          include: {
            brand: { select: { id: true, name: true, color: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      title: m.user.title,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      status: m.status,
      allBrands: m.allBrands,
      brands: m.allBrands ? 'All Brands' : m.brands.map((b) => b.brand),
      totpEnabled: m.user.totpEnabled,
      joinedAt: m.createdAt,
    }));
  }

  /**
   * List pending invites
   */
  static async listInvites(ctx: UserContext) {
    return prisma.invite.findMany({
      where: {
        workspaceId: ctx.workspaceId,
        acceptedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create invite
   */
  static async createInvite(
    ctx: UserContext,
    data: { email: string; role: Role; brandIds: string[] }
  ) {
    // Check seat limits
    const stats = await this.getStats(ctx);
    if (stats.seatsUsed >= stats.seatLimit) {
      throw new AppError('SEATS_FULL', 'Workspace seat limit reached. Upgrade plan for more seats.', 402);
    }

    // Role check: Only OWNER and ADMIN can invite
    if (!['OWNER', 'ADMIN'].includes(ctx.role)) {
      throw new AppError('FORBIDDEN', 'Only Owners and Admins can invite team members', 403);
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000); // 7 days

    const invite = await prisma.invite.create({
      data: {
        workspaceId: ctx.workspaceId,
        email: data.email.toLowerCase().trim(),
        role: data.role,
        brandIds: data.brandIds,
        tokenHash,
        invitedById: ctx.userId,
        expiresAt,
      },
    });

    return {
      invite,
      inviteUrl: `http://localhost:5173/accept-invite/${rawToken}`,
    };
  }

  /**
   * Resend / rotate invite
   */
  static async resendInvite(ctx: UserContext, id: string) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000);

    const invite = await prisma.invite.update({
      where: { id },
      data: { tokenHash, expiresAt },
    });

    return {
      invite,
      inviteUrl: `http://localhost:5173/accept-invite/${rawToken}`,
    };
  }

  /**
   * Cancel invite
   */
  static async cancelInvite(ctx: UserContext, id: string) {
    return prisma.invite.delete({ where: { id } });
  }

  /**
   * Update membership (role, status)
   */
  static async updateMember(
    ctx: UserContext,
    id: string,
    data: { role?: Role; status?: 'ACTIVE' | 'SUSPENDED'; brandIds?: string[] }
  ) {
    const membership = await prisma.membership.findFirst({
      where: { id, workspaceId: ctx.workspaceId },
    });
    if (!membership) throw new AppError('MEMBER_NOT_FOUND', 'Membership not found', 404);

    // Cannot demote or suspend workspace owner
    if (membership.role === 'OWNER' && data.role && data.role !== 'OWNER') {
      throw new AppError('FORBIDDEN', 'Cannot change the role of workspace owner', 403);
    }

    if (data.brandIds && !membership.allBrands) {
      await prisma.membershipBrand.deleteMany({ where: { membershipId: id } });
      for (const bId of data.brandIds) {
        await prisma.membershipBrand.create({
          data: { membershipId: id, brandId: bId },
        });
      }
    }

    return prisma.membership.update({
      where: { id },
      data: {
        ...(data.role ? { role: data.role } : {}),
        ...(data.status ? { status: data.status } : {}),
      },
    });
  }

  /**
   * Audit logs
   */
  static async getAuditLogs(
    ctx: UserContext,
    query: { actorId?: string; action?: string; limit?: number; page?: number }
  ) {
    const { actorId, action, limit = 50, page = 1 } = query;

    const where: any = {
      workspaceId: ctx.workspaceId,
      ...(actorId ? { actorId } : {}),
      ...(action ? { action } : {}),
    };

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
