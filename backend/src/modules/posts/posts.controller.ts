import { Request, Response, NextFunction } from 'express';
import { PostsService } from './posts.service.js';
import {
  createPostSchema,
  updatePostSchema,
  reschedulePostSchema,
  validatePostSchema,
} from '@postdesk/shared';

export class PostsController {
  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const input = createPostSchema.parse(req.body);
      const post = await PostsService.create(req.ctx!, input);
      return res.status(201).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { brandId, status, limit } = req.query;
      const posts = await PostsService.list(req.ctx!, {
        brandId: brandId as string,
        status: status as any,
        limit: limit ? Number(limit) : undefined,
      });
      return res.status(200).json({ posts });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await PostsService.getById(req.ctx!, id);
      return res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const input = updatePostSchema.parse(req.body);
      const post = await PostsService.update(req.ctx!, id, input);
      return res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await PostsService.delete(req.ctx!, id);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async submit(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await PostsService.submit(req.ctx!, id);
      return res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async withdraw(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await PostsService.withdraw(req.ctx!, id);
      return res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async schedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await PostsService.schedule(req.ctx!, id);
      return res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async publishNow(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await PostsService.publishNow(req.ctx!, id);
      return res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async publishManually(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await PostsService.publishManually(req.ctx!, id);
      return res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async reschedule(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { scheduledAt } = reschedulePostSchema.parse(req.body);
      const post = await PostsService.reschedule(req.ctx!, id, scheduledAt);
      return res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async retry(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const post = await PostsService.retry(req.ctx!, id);
      return res.status(200).json({ post });
    } catch (err) {
      next(err);
    }
  }

  static async validate(req: Request, res: Response, next: NextFunction) {
    try {
      const input = validatePostSchema.parse(req.body);
      const result = await PostsService.validate(req.ctx!, input);
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
