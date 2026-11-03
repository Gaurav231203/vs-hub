import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string; // userId
  wid: string; // workspaceId
  jti: string; // uuid
}

export interface RefreshTokenPayload {
  sub: string;
  familyId: string;
  jti: string;
}

export function signAccessToken(payload: { userId: string; workspaceId: string }): string {
  const jti = crypto.randomUUID();
  return jwt.sign(
    {
      sub: payload.userId,
      wid: payload.workspaceId,
      jti,
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
    }
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function generateRefreshTokenString(): string {
  return crypto.randomBytes(40).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
