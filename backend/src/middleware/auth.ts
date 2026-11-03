import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../lib/jwt.js';
import { AppError } from './error.js';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('UNAUTHENTICATED', 'Missing or invalid authorization header', 401));
  }

  const token = authHeader.slice(7).trim();
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.workspaceId = payload.wid;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError('UNAUTHENTICATED', 'Access token has expired', 401));
    }
    return next(new AppError('UNAUTHENTICATED', 'Invalid access token', 401));
  }
}
