import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { env } from '../../config/env.js';
import { loginSchema, verify2faSchema, acceptInviteSchema, forgotPasswordSchema } from '@postdesk/shared';

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'strict',
    domain: env.COOKIE_DOMAIN === 'localhost' ? undefined : env.COOKIE_DOMAIN,
    path: '/api/v1/auth',
  });
}

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.login(email, password, ip, userAgent);

      if ('needs2fa' in result) {
        return res.status(200).json(result);
      }

      setRefreshCookie(res, result.refreshToken);

      return res.status(200).json({
        accessToken: result.accessToken,
        user: result.user,
        workspaceId: result.workspaceId,
      });
    } catch (err) {
      next(err);
    }
  }

  static async verify2fa(req: Request, res: Response, next: NextFunction) {
    try {
      const { challengeId, code } = verify2faSchema.parse(req.body);
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.verify2fa(challengeId, code, ip, userAgent);

      setRefreshCookie(res, result.refreshToken);

      return res.status(200).json({
        accessToken: result.accessToken,
        user: result.user,
        workspaceId: result.workspaceId,
      });
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies.refreshToken;
      if (!token) {
        return res.status(401).json({
          error: { code: 'UNAUTHENTICATED', message: 'No refresh token provided' },
        });
      }

      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.refresh(token, ip, userAgent);
      setRefreshCookie(res, result.refreshToken);

      return res.status(200).json({
        accessToken: result.accessToken,
      });
    } catch (err) {
      clearRefreshCookie(res);
      next(err);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const token = req.cookies.refreshToken;
      await AuthService.logout(token);
      clearRefreshCookie(res);
      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async getMe(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const workspaceId = req.workspaceId!;
      const data = await AuthService.getMe(userId, workspaceId);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getInvitePreview(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const preview = await AuthService.getInvitePreview(token);
      return res.status(200).json(preview);
    } catch (err) {
      next(err);
    }
  }

  static async acceptInvite(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const { name, password } = acceptInviteSchema.parse(req.body);
      const ip = req.ip || req.socket.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await AuthService.acceptInvite(token, name, password, ip, userAgent);
      setRefreshCookie(res, result.refreshToken);

      return res.status(200).json({
        accessToken: result.accessToken,
        user: result.user,
        workspaceId: result.workspaceId,
      });
    } catch (err) {
      next(err);
    }
  }

  static async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      const result = await AuthService.forgotPassword(email);
      return res.status(202).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async setup2fa(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const result = await AuthService.setup2fa(userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async confirm2fa(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { code } = req.body;
      const result = await AuthService.confirm2fa(userId, code);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async disable2fa(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const result = await AuthService.disable2fa(userId);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
