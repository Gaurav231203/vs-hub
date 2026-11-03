import express, { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { LibraryService } from './library.service.js';
import { AppError } from '../../middleware/error.js';

import crypto from 'crypto';

export const libraryRouter = Router();

// Direct PUT local upload endpoint (verifies HMAC presigned signature or session auth)
libraryRouter.put(
  '/library/upload-local',
  express.raw({ type: '*/*', limit: '100mb' }),
  async (req, res, next) => {
    try {
      const key = req.query.key as string;
      const expires = req.query.expires as string;
      const sig = req.query.sig as string;

      if (!key) throw new AppError('VALIDATION_ERROR', 'Storage key required', 400);

      const signingKey = process.env.COOKIE_SECRET || process.env.JWT_ACCESS_SECRET || 'local-storage-secret';

      // Verify presigned HMAC signature if provided
      if (sig && expires) {
        if (Date.now() > Number(expires)) {
          throw new AppError('FORBIDDEN', 'Upload URL has expired', 403);
        }
        const expectedSig = crypto.createHmac('sha256', signingKey).update(`${key}:${expires}`).digest('hex');
        if (sig !== expectedSig) {
          throw new AppError('FORBIDDEN', 'Invalid upload signature', 403);
        }
      }

      const safeKey = key.replace(/\.\./g, '').replace(/^[/\\]+/, '');
      const targetPath = path.resolve('uploads', safeKey);

      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

      if (Buffer.isBuffer(req.body) && req.body.length > 0) {
        await fs.promises.writeFile(targetPath, req.body);
      } else {
        const writeStream = fs.createWriteStream(targetPath);
        await new Promise((resolve, reject) => {
          req.pipe(writeStream);
          writeStream.on('finish', () => resolve(undefined));
          writeStream.on('error', (err) => reject(err));
        });
      }

      res.status(200).json({ success: true, key: safeKey });
    } catch (err) {
      next(err);
    }
  }
);

// Apply auth & tenant context to library routes except presigned upload-local
libraryRouter.use('/library', (req, res, next) => {
  if (req.path === '/upload-local' || req.url.startsWith('/upload-local')) {
    return next();
  }
  return authenticate(req, res, (err) => {
    if (err) return next(err);
    return tenantMiddleware(req, res, next);
  });
});

// --- 1. MEDIA ASSETS ---
libraryRouter.get('/library/assets', async (req, res, next) => {
  try {
    const brandId = req.query.brandId as string;
    const starred = req.query.starred === 'true' ? true : req.query.starred === 'false' ? false : undefined;
    const kind = req.query.kind as string;
    const search = req.query.search as string;
    const sort = req.query.sort as any;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 40;

    const result = await LibraryService.listAssets(req.ctx!, {
      brandId,
      starred,
      kind,
      search,
      sort,
      page,
      limit,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

libraryRouter.post(
  '/library/upload-url',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { brandId, filename, contentType, byteSize } = req.body;
      if (!brandId || !filename || !contentType || !byteSize) {
        throw new AppError('VALIDATION_ERROR', 'brandId, filename, contentType, and byteSize are required', 400);
      }

      const result = await LibraryService.generateUploadUrl(req.ctx!, {
        brandId,
        filename,
        contentType,
        byteSize: Number(byteSize),
      });

      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.post(
  '/library/confirm-upload',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { brandId, title, kind, publicUrl, key, byteSize, contentType, width, height, thumbUrl, tags } = req.body;
      if (!brandId || !publicUrl || !key) {
        throw new AppError('VALIDATION_ERROR', 'brandId, publicUrl, and key are required', 400);
      }

      const asset = await LibraryService.confirmUpload(req.ctx!, {
        brandId,
        title: title || 'Uploaded Media',
        kind: kind || 'IMAGE',
        publicUrl,
        key,
        byteSize: Number(byteSize || 1024),
        contentType: contentType || 'image/png',
        width,
        height,
        thumbUrl,
        tags,
      });

      res.status(201).json(asset);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.post(
  '/library/assets',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { brandId, title, kind, url, thumbUrl, tags, width, height, bytes } = req.body;
      if (!brandId || !title || !url) {
        throw new AppError('VALIDATION_ERROR', 'brandId, title, and url are required', 400);
      }

      const asset = await LibraryService.createAsset(req.ctx!, {
        brandId,
        title,
        kind: kind || 'IMAGE',
        url,
        thumbUrl,
        tags,
        width,
        height,
        bytes: bytes || 1024,
      });
      res.status(201).json(asset);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.patch(
  '/library/assets/:id',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { title, starred, tags } = req.body;
      const updated = await LibraryService.updateAsset(req.ctx!, req.params.id, {
        title,
        starred,
        tags,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.delete(
  '/library/assets/:id',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      await LibraryService.deleteAsset(req.ctx!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// --- 2. TEMPLATES ---
libraryRouter.get('/library/templates', async (req, res, next) => {
  try {
    const brandId = req.query.brandId as string;
    const templates = await LibraryService.listTemplates(req.ctx!, brandId);
    res.json({ templates });
  } catch (err) {
    next(err);
  }
});

libraryRouter.post(
  '/library/templates',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { title, body, brandId } = req.body;
      if (!title || !body) {
        throw new AppError('VALIDATION_ERROR', 'title and body are required', 400);
      }

      const template = await LibraryService.createTemplate(req.ctx!, {
        title,
        body,
        brandId,
      });
      res.status(201).json(template);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.patch(
  '/library/templates/:id',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { title, body } = req.body;
      const updated = await LibraryService.updateTemplate(req.ctx!, req.params.id, {
        title,
        body,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.delete(
  '/library/templates/:id',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      await LibraryService.deleteTemplate(req.ctx!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// --- 3. HASHTAG SETS ---
libraryRouter.get('/library/hashtags', async (req, res, next) => {
  try {
    const brandId = req.query.brandId as string;
    const sets = await LibraryService.listHashtagSets(req.ctx!, brandId);
    res.json({ sets });
  } catch (err) {
    next(err);
  }
});

libraryRouter.post(
  '/library/hashtags',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { brandId, name, tags } = req.body;
      if (!brandId || !name || !tags) {
        throw new AppError('VALIDATION_ERROR', 'brandId, name, and tags are required', 400);
      }

      const set = await LibraryService.createHashtagSet(req.ctx!, {
        brandId,
        name,
        tags,
      });
      res.status(201).json(set);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.patch(
  '/library/hashtags/:id',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { name, tags } = req.body;
      const updated = await LibraryService.updateHashtagSet(req.ctx!, req.params.id, {
        name,
        tags,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.delete(
  '/library/hashtags/:id',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      await LibraryService.deleteHashtagSet(req.ctx!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);

// --- 4. SAVED REPLIES ---
libraryRouter.get('/library/replies', async (req, res, next) => {
  try {
    const replies = await LibraryService.listSavedReplies(req.ctx!);
    res.json({ replies });
  } catch (err) {
    next(err);
  }
});

libraryRouter.post(
  '/library/replies',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { title, body } = req.body;
      if (!title || !body) {
        throw new AppError('VALIDATION_ERROR', 'title and body are required', 400);
      }

      const reply = await LibraryService.createSavedReply(req.ctx!, { title, body });
      res.status(201).json(reply);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.patch(
  '/library/replies/:id',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      const { title, body } = req.body;
      const updated = await LibraryService.updateSavedReply(req.ctx!, req.params.id, {
        title,
        body,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

libraryRouter.delete(
  '/library/replies/:id',
  requirePerm('library.manage'),
  async (req, res, next) => {
    try {
      await LibraryService.deleteSavedReply(req.ctx!, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
);
