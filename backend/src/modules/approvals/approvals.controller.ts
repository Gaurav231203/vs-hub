import { Request, Response, NextFunction } from 'express';
import { ApprovalsService } from './approvals.service.js';
import { approvePostSchema, requestChangesSchema, bulkApproveSchema, undoActionSchema } from '@postdesk/shared';

export class ApprovalsController {
  static async getQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const tab = (req.query.tab as string) || 'mine';
      const brandId = (req.query.brandId as string) || null;
      const posts = await ApprovalsService.getQueue(req.ctx!, tab, brandId);
      return res.status(200).json({ posts });
    } catch (err) {
      next(err);
    }
  }

  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await ApprovalsService.getSummary(req.ctx!);
      return res.status(200).json(summary);
    } catch (err) {
      next(err);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const { postId } = req.params;
      const { version } = approvePostSchema.parse(req.body);
      const note = req.body.note as string | undefined;

      const result = await ApprovalsService.approve(req.ctx!, postId, version, note);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async requestChanges(req: Request, res: Response, next: NextFunction) {
    try {
      const { postId } = req.params;
      const { note, version } = requestChangesSchema.parse(req.body);

      const result = await ApprovalsService.requestChanges(req.ctx!, postId, note, version);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async bulkApprove(req: Request, res: Response, next: NextFunction) {
    try {
      const { postIds } = bulkApproveSchema.parse(req.body);
      const result = await ApprovalsService.bulkApprove(req.ctx!, postIds);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async undo(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { undoToken } = undoActionSchema.parse(req.body);

      const result = await ApprovalsService.undo(req.ctx!, id, undoToken);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
