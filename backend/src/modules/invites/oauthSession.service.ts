import { prisma } from '../../lib/prisma.js';
import { encrypt, decrypt } from '../../lib/crypto.js';
import { AppError } from '../../middleware/error.js';
import { MetaPageCandidate } from '../channels/meta.service.js';
import crypto from 'crypto';

export interface SaveOAuthSessionParams {
  inviteToken: string;
  workspaceId: string;
  brandId: string;
  candidates: MetaPageCandidate[];
  ttlMs?: number;
}

export class OAuthSessionService {
  /**
   * Persists multi-page OAuth selection session in database encrypted with AES-256-GCM.
   * Eliminates in-memory process RAM bloat and enables multi-node / multi-container cluster support.
   */
  static async saveSession(params: SaveOAuthSessionParams): Promise<string> {
    const { inviteToken, workspaceId, brandId, candidates, ttlMs = 15 * 60 * 1000 } = params;
    const sessionId = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + ttlMs);

    // Encrypt sensitive page access tokens at rest
    const candidatesEnc = encrypt(JSON.stringify(candidates));

    await prisma.oAuthSession.create({
      data: {
        id: sessionId,
        inviteToken,
        workspaceId,
        brandId,
        candidatesEnc,
        expiresAt,
      },
    });

    return sessionId;
  }

  /**
   * Retrieves sanitized candidate pages for client UI.
   * Strips all internal page tokens so sensitive credentials never leak to client browser.
   */
  static async getCandidatesForClient(sessionId: string): Promise<
    Array<{
      pageId: string;
      pageName: string;
      instagram?: { id: string; username: string };
    }>
  > {
    const session = await prisma.oAuthSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || new Date() > session.expiresAt) {
      if (session) {
        await prisma.oAuthSession.delete({ where: { id: sessionId } }).catch(() => {});
      }
      throw new AppError('SESSION_EXPIRED', 'Selection session expired. Please connect again.', 410);
    }

    const decryptedJson = decrypt(session.candidatesEnc);
    const candidates: MetaPageCandidate[] = JSON.parse(decryptedJson);

    return candidates.map((c) => ({
      pageId: c.pageId,
      pageName: c.pageName,
      instagram: c.instagram,
    }));
  }

  /**
   * Consumes session atomically upon user page selection.
   * Returns selected page with decrypted credentials and workspace context, then deletes session record.
   */
  static async consumeSessionAndGetPage(
    sessionId: string,
    rawInviteToken: string,
    selectedPageId: string
  ): Promise<{
    selectedPage: MetaPageCandidate;
    workspaceId: string;
    brandId: string;
  }> {
    const session = await prisma.oAuthSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.inviteToken !== rawInviteToken || new Date() > session.expiresAt) {
      if (session && new Date() > session.expiresAt) {
        await prisma.oAuthSession.delete({ where: { id: sessionId } }).catch(() => {});
      }
      throw new AppError('SESSION_INVALID', 'Invalid or expired selection session', 400);
    }

    const decryptedJson = decrypt(session.candidatesEnc);
    const candidates: MetaPageCandidate[] = JSON.parse(decryptedJson);

    const selectedPage = candidates.find((c) => c.pageId === selectedPageId);
    if (!selectedPage) {
      throw new AppError('PAGE_NOT_FOUND', 'Selected page was not found in available accounts', 404);
    }

    // Purge single-use session
    await prisma.oAuthSession.delete({ where: { id: sessionId } }).catch(() => {});

    return {
      selectedPage,
      workspaceId: session.workspaceId,
      brandId: session.brandId,
    };
  }

  /**
   * Sweeper maintenance: delete expired sessions
   */
  static async cleanExpired(): Promise<number> {
    const res = await prisma.oAuthSession.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return res.count;
  }
}
