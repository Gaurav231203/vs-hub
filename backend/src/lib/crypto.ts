import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../config/env.js';

const VERSION = 'v1';
const ALG = 'aes-256-gcm';

function getKey(): Buffer {
  const key = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)');
  }
  return key;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const key = getKey();
  const cip = createCipheriv(ALG, key, iv);
  const ct = Buffer.concat([cip.update(plain, 'utf8'), cip.final()]);
  const tag = cip.getAuthTag();
  // Format: "v1:<iv_hex>:<tag_hex>:<ct_hex>"
  return `${VERSION}:${iv.toString('hex')}:${tag.toString('hex')}:${ct.toString('hex')}`;
}

export function decrypt(stored: string): string {
  const [version, ivHex, tagHex, ctHex] = stored.split(':');
  if (version !== VERSION) throw new Error(`Unknown encryption version: ${version}`);
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const ct = Buffer.from(ctHex, 'hex');
  const key = getKey();
  const dec = createDecipheriv(ALG, key, iv);
  dec.setAuthTag(tag);
  return dec.update(ct).toString('utf8') + dec.final('utf8');
}

/**
 * Hash raw token using SHA-256 for secure storage in DB
 */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate a cryptographically secure random token and its SHA-256 hash
 */
export function generateSecureToken(byteLength = 32): { raw: string; hash: string } {
  const raw = randomBytes(byteLength).toString('hex');
  const hash = hashToken(raw);
  return { raw, hash };
}

/**
 * Timing-safe token comparison against stored SHA-256 hash
 */
export function compareSecureToken(rawToken: string, storedHash: string): boolean {
  if (!rawToken || !storedHash) return false;
  const candidateHash = hashToken(rawToken);
  const bufA = Buffer.from(candidateHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

