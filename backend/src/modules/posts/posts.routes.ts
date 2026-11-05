import { Router } from 'express';
import { PostsController } from './posts.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';

export const postsRouter = Router();

// Validate post dry-run
postsRouter.post('/validate-post', authenticate, tenantMiddleware, PostsController.validate);

// CRUD
postsRouter.post('/posts', authenticate, tenantMiddleware, requirePerm('post.create'), PostsController.create);
postsRouter.get('/posts', authenticate, tenantMiddleware, PostsController.list);
postsRouter.get('/posts/:id', authenticate, tenantMiddleware, PostsController.getById);
postsRouter.put('/posts/:id', authenticate, tenantMiddleware, PostsController.update);
postsRouter.delete('/posts/:id', authenticate, tenantMiddleware, PostsController.delete);

// State transitions
postsRouter.post('/posts/:id/submit', authenticate, tenantMiddleware, PostsController.submit);
postsRouter.post('/posts/:id/withdraw', authenticate, tenantMiddleware, PostsController.withdraw);
postsRouter.post('/posts/:id/schedule', authenticate, tenantMiddleware, PostsController.schedule);
postsRouter.post('/posts/:id/publish-now', authenticate, tenantMiddleware, PostsController.publishNow);
postsRouter.post('/posts/:id/publish-manually', authenticate, tenantMiddleware, PostsController.publishManually);
postsRouter.post('/posts/:id/reschedule', authenticate, tenantMiddleware, requirePerm('post.reschedule'), PostsController.reschedule);
postsRouter.post('/posts/:id/retry', authenticate, tenantMiddleware, requirePerm('post.publish'), PostsController.retry);
