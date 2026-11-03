import { Router } from 'express';
import { ApprovalsController } from './approvals.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';

export const approvalsRouter = Router();

// Approvals queue & metrics
approvalsRouter.get('/approvals', authenticate, tenantMiddleware, ApprovalsController.getQueue);
approvalsRouter.get('/approvals/summary', authenticate, tenantMiddleware, ApprovalsController.getSummary);

// Actions requiring post.approve permission
approvalsRouter.post(
  '/approvals/:postId/approve',
  authenticate,
  tenantMiddleware,
  requirePerm('post.approve'),
  ApprovalsController.approve
);

approvalsRouter.post(
  '/approvals/:postId/request-changes',
  authenticate,
  tenantMiddleware,
  requirePerm('post.approve'),
  ApprovalsController.requestChanges
);

approvalsRouter.post(
  '/approvals/bulk-approve',
  authenticate,
  tenantMiddleware,
  requirePerm('post.approve'),
  ApprovalsController.bulkApprove
);

// 8-second Undo transition
approvalsRouter.post('/posts/:id/undo', authenticate, tenantMiddleware, ApprovalsController.undo);
