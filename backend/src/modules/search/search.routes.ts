import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { SearchService } from './search.service.js';

export const searchRouter = Router();

searchRouter.use('/search', authenticate, tenantMiddleware);

/**
 * GET /api/v1/search?q=
 */
searchRouter.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q as string;
    const results = await SearchService.search(req.ctx!, q);
    res.json(results);
  } catch (err) {
    next(err);
  }
});
