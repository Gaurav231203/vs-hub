import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';

export const authRouter = Router();

// Public auth routes
authRouter.post('/auth/login', AuthController.login);
authRouter.post('/auth/2fa/verify', AuthController.verify2fa);
authRouter.post('/auth/refresh', AuthController.refresh);
authRouter.post('/auth/logout', AuthController.logout);
authRouter.get('/auth/invite/:token', AuthController.getInvitePreview);
authRouter.post('/auth/invite/:token/accept', AuthController.acceptInvite);
authRouter.post('/auth/forgot-password', AuthController.forgotPassword);

// Authenticated current-user routes
authRouter.get('/me', authenticate, tenantMiddleware, AuthController.getMe);
authRouter.post('/me/2fa/setup', authenticate, AuthController.setup2fa);
authRouter.post('/me/2fa/confirm', authenticate, AuthController.confirm2fa);
authRouter.delete('/me/2fa', authenticate, AuthController.disable2fa);
