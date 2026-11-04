import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/error.js';
import { generateSecureToken } from '../../lib/crypto.js';
import { env } from '../../config/env.js';
import { EmailService } from '../../lib/email.js';
import { getWebUrl } from '../../lib/urls.js';
import { BrandStatus, ConnectInviteStatus } from '@prisma/client';

export interface CreateBrandInput {
  name: string;
  clientContactName: string;
  clientContactEmail: string;
  timezone: string;
  logoUrl?: string;
  color?: string;
  phone?: string;
  description?: string;
}

export class BrandsService {
  /**
   * 1. Admin "New Brand" creation:
   * Required: name, client contact name, client contact email, timezone.
   * Optional: logo, color, phone.
   * Lifecycle: CREATED -> auto-generates first invite -> INVITED.
   */
  static async createBrand(workspaceId: string, userId: string, input: CreateBrandInput, baseUrl?: string) {
    const {
      name,
      clientContactName,
      clientContactEmail,
      timezone,
      logoUrl,
      color = '#4F46E5',
      phone,
      description,
    } = input;

    if (!name?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Brand name is required', 400);
    }
    if (!clientContactName?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Client contact name is required', 400);
    }
    if (!clientContactEmail?.trim() || !clientContactEmail.includes('@')) {
      throw new AppError('VALIDATION_ERROR', 'Valid client contact email is required', 400);
    }
    if (!timezone?.trim()) {
      throw new AppError('VALIDATION_ERROR', 'Timezone is required', 400);
    }

    // Fetch workspace for email branding
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true },
    });
    if (!workspace) {
      throw new AppError('WORKSPACE_NOT_FOUND', 'Workspace not found', 404);
    }

    // 1. Create brand with CREATED status
    const brand = await prisma.brand.create({
      data: {
        workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
        color,
        logoUrl: logoUrl?.trim() || null,
        timezone: timezone.trim(),
        phone: phone?.trim() || null,
        status: BrandStatus.CREATED,
      },
    });

    // 2. Create primary brand contact
    const contact = await prisma.brandContact.create({
      data: {
        brandId: brand.id,
        name: clientContactName.trim(),
        email: clientContactEmail.trim().toLowerCase(),
        phone: phone?.trim() || null,
        isPrimary: true,
      },
    });

    // 3. Generate initial secure invite token
    const { raw, hash } = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invite = await prisma.connectInvite.create({
      data: {
        workspaceId,
        brandId: brand.id,
        tokenHash: hash,
        expiresAt,
        status: ConnectInviteStatus.ACTIVE,
        createdBy: userId,
      },
    });

    // 4. Update brand status to INVITED
    const updatedBrand = await prisma.brand.update({
      where: { id: brand.id },
      data: { status: BrandStatus.INVITED },
      include: { contacts: true },
    });

    const webBase = baseUrl || getWebUrl();
    const inviteUrl = `${webBase}/connect/${raw}`;

    // 5. Send onboarding invite email via Resend
    await EmailService.sendConnectInvite({
      toEmail: contact.email,
      clientName: contact.name,
      brandName: brand.name,
      agencyName: workspace.name,
      inviteUrl,
      expiresInDays: 7,
    });

    return {
      brand: updatedBrand,
      contact,
      invite: {
        id: invite.id,
        inviteUrl,
        rawToken: raw,
        expiresAt: invite.expiresAt,
      },
    };
  }

  /**
   * List all brands in workspace with contacts, channel count, and pending invite status
   */
  static async listBrands(workspaceId: string, allowedBrandIds?: string[], allBrands = true) {
    const whereClause: any = { workspaceId };
    if (!allBrands && allowedBrandIds && allowedBrandIds.length > 0) {
      whereClause.id = { in: allowedBrandIds };
    }

    const brands = await prisma.brand.findMany({
      where: whereClause,
      include: {
        contacts: {
          where: { isPrimary: true },
          take: 1,
        },
        channels: {
          select: {
            id: true,
            network: true,
            handle: true,
            status: true,
          },
        },
        connectInvites: {
          where: { status: ConnectInviteStatus.ACTIVE },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return brands.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      color: b.color,
      logoUrl: b.logoUrl,
      timezone: b.timezone,
      phone: b.phone,
      status: b.status,
      createdAt: b.createdAt,
      primaryContact: b.contacts[0] || null,
      channels: b.channels,
      activeInvite: b.connectInvites[0] || null,
    }));
  }

  /**
   * Get single brand details with strict workspace verification (prevents IDOR)
   */
  static async getBrand(workspaceId: string, brandId: string) {
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspaceId },
      include: {
        contacts: true,
        channels: true,
        connectInvites: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!brand) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    return brand;
  }

  /**
   * Generate fresh invite for brand.
   * Requirement 3: Automatically revokes older active invites.
   */
  static async generateInvite(workspaceId: string, brandId: string, userId: string, expiresInDays = 7, baseUrl?: string) {
    // 1. Strict workspace scoping to prevent IDOR
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspaceId },
      include: {
        workspace: { select: { id: true, name: true } },
        contacts: { where: { isPrimary: true }, take: 1 },
      },
    });

    if (!brand) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    // 2. Revoke any existing active invites for this brand
    await prisma.connectInvite.updateMany({
      where: { brandId, status: ConnectInviteStatus.ACTIVE },
      data: {
        status: ConnectInviteStatus.REVOKED,
        revokedAt: new Date(),
      },
    });

    // 3. Generate crypto random token & hash
    const { raw, hash } = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const invite = await prisma.connectInvite.create({
      data: {
        workspaceId,
        brandId,
        tokenHash: hash,
        expiresAt,
        status: ConnectInviteStatus.ACTIVE,
        createdBy: userId,
      },
    });

    // 4. Update brand status to INVITED if it was CREATED
    if (brand.status === BrandStatus.CREATED) {
      await prisma.brand.update({
        where: { id: brandId },
        data: { status: BrandStatus.INVITED },
      });
    }

    const webBase = baseUrl || getWebUrl();
    const inviteUrl = `${webBase}/connect/${raw}`;

    // 5. Send email if primary contact exists
    const contact = brand.contacts[0];
    if (contact?.email) {
      await EmailService.sendConnectInvite({
        toEmail: contact.email,
        clientName: contact.name,
        brandName: brand.name,
        agencyName: brand.workspace.name,
        inviteUrl,
        expiresInDays,
      });
    }

    return {
      inviteId: invite.id,
      brandId: brand.id,
      brandName: brand.name,
      inviteUrl,
      rawToken: raw,
      expiresAt: invite.expiresAt,
      contactEmail: contact?.email || null,
    };
  }

  /**
   * Delete a brand and its associated resources with strict workspace check
   */
  static async deleteBrand(workspaceId: string, brandId: string) {
    const brand = await prisma.brand.findFirst({
      where: { id: brandId, workspaceId },
      select: { id: true, name: true },
    });

    if (!brand) {
      throw new AppError('BRAND_NOT_FOUND', 'Brand not found or access denied', 404);
    }

    try {
      await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0;`);
      await prisma.$executeRawUnsafe(`DELETE FROM PostTarget WHERE channelId IN (SELECT id FROM Channel WHERE brandId = '${brandId}') OR postId IN (SELECT id FROM Post WHERE brandId = '${brandId}');`);
      await prisma.$executeRawUnsafe(`DELETE FROM PublishJob WHERE postId IN (SELECT id FROM Post WHERE brandId = '${brandId}');`);
      await prisma.$executeRawUnsafe(`DELETE FROM PostMedia WHERE postId IN (SELECT id FROM Post WHERE brandId = '${brandId}');`);
      await prisma.$executeRawUnsafe(`DELETE FROM Review WHERE postId IN (SELECT id FROM Post WHERE brandId = '${brandId}');`);
      await prisma.$executeRawUnsafe(`DELETE FROM ApprovalToken WHERE postId IN (SELECT id FROM Post WHERE brandId = '${brandId}');`);
      await prisma.$executeRawUnsafe(`DELETE FROM Post WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM MetricDaily WHERE channelId IN (SELECT id FROM Channel WHERE brandId = '${brandId}');`);
      await prisma.$executeRawUnsafe(`DELETE FROM Message WHERE conversationId IN (SELECT id FROM Conversation WHERE channelId IN (SELECT id FROM Channel WHERE brandId = '${brandId}'));`);
      await prisma.$executeRawUnsafe(`DELETE FROM Conversation WHERE channelId IN (SELECT id FROM Channel WHERE brandId = '${brandId}');`);
      await prisma.$executeRawUnsafe(`DELETE FROM Channel WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM MediaAsset WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM Campaign WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM Mention WHERE keywordId IN (SELECT id FROM Keyword WHERE brandId = '${brandId}');`);
      await prisma.$executeRawUnsafe(`DELETE FROM Keyword WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM HashtagSet WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM ConnectInvite WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM BrandContact WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM MembershipBrand WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM OAuthSession WHERE brandId = '${brandId}';`);
      await prisma.$executeRawUnsafe(`DELETE FROM Brand WHERE id = '${brandId}';`);
    } catch (e: any) {
      // Fallback for non-MySQL environments
      await prisma.$transaction(async (tx) => {
        await tx.connectInvite.deleteMany({ where: { brandId } }).catch(() => {});
        await tx.brandContact.deleteMany({ where: { brandId } }).catch(() => {});
        await tx.membershipBrand.deleteMany({ where: { brandId } }).catch(() => {});
        await tx.brand.delete({ where: { id: brandId } });
      });
    } finally {
      await prisma.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1;`).catch(() => {});
    }

    return {
      success: true,
      deletedBrandId: brandId,
      name: brand.name,
    };
  }
}

