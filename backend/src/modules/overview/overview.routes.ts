import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { OverviewService } from './overview.service.js';

export const overviewRouter = Router();

overviewRouter.use('/overview', authenticate, tenantMiddleware);

overviewRouter.get('/overview/widgets', async (req, res, next) => {
  try {
    const brandId = req.query.brandId as string;
    const data = await OverviewService.getWidgets(req.ctx!, brandId);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
