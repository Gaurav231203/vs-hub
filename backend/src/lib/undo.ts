import crypto from 'crypto';

export interface UndoTokenPayload {
  postId: string;
  actorId: string;
  transition: 'approve' | 'request_changes' | 'reschedule';
  previousStatus: string;
  newStatus: string;
  reviewId?: string;
  previousScheduledAt?: Date | null;
  expiresAt: number;
}

// In-memory undo tokens with 8-second TTL (plus 2s clock skew grace = 10s)
const undoStore = new Map<string, UndoTokenPayload>();

export function createUndoToken(payload: Omit<UndoTokenPayload, 'expiresAt'>): string {
  const token = crypto.randomUUID();
  undoStore.set(token, {
    ...payload,
    expiresAt: Date.now() + 8500, // 8.5 seconds
  });
  return token;
}

export function consumeUndoToken(token: string, actorId: string, postId: string): UndoTokenPayload | null {
  const data = undoStore.get(token);
  if (!data) return null;

  if (data.postId !== postId || data.actorId !== actorId) {
    return null;
  }

  if (Date.now() > data.expiresAt) {
    undoStore.delete(token);
    return null;
  }

  undoStore.delete(token);
  return data;
}

// Periodic cleanup of expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of undoStore.entries()) {
    if (now > data.expiresAt) {
      undoStore.delete(token);
    }
  }
}, 30000);
