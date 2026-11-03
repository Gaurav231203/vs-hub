import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';
import { requirePerm } from '../../middleware/rbac.js';
import { AnalyticsService } from './analytics.service.js';

export const analyticsRouter = Router();

// Apply auth & tenant context to all analytics routes
analyticsRouter.use('/analytics', authenticate, tenantMiddleware, requirePerm('analytics.view'));

/**
 * GET /api/v1/analytics/summary
 */
analyticsRouter.get('/analytics/summary', async (req, res, next) => {
  try {
    const range = req.query.range as any;
    const brandId = req.query.brandId as string;
    const network = req.query.network as any;

    const summary = await AnalyticsService.getSummary(req.ctx!, { range, brandId, network });
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/growth
 */
analyticsRouter.get('/analytics/growth', async (req, res, next) => {
  try {
    const range = req.query.range as any;
    const brandId = req.query.brandId as string;
    const network = req.query.network as any;

    const growth = await AnalyticsService.getGrowthTimeline(req.ctx!, { range, brandId, network });
    res.json(growth);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/by-network
 */
analyticsRouter.get('/analytics/by-network', async (req, res, next) => {
  try {
    const range = req.query.range as any;
    const brandId = req.query.brandId as string;

    const breakdown = await AnalyticsService.getByNetwork(req.ctx!, { range, brandId });
    res.json({ networks: breakdown });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/content-mix
 */
analyticsRouter.get('/analytics/content-mix', async (req, res, next) => {
  try {
    const range = req.query.range as any;
    const brandId = req.query.brandId as string;
    const network = req.query.network as any;

    const mix = await AnalyticsService.getContentMix(req.ctx!, { range, brandId, network });
    res.json(mix);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/heatmap
 */
analyticsRouter.get('/analytics/heatmap', async (req, res, next) => {
  try {
    const range = req.query.range as any;
    const brandId = req.query.brandId as string;
    const network = req.query.network as any;

    const heatmap = await AnalyticsService.getHeatmap(req.ctx!, { range, brandId, network });
    res.json(heatmap);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/top-posts
 */
analyticsRouter.get('/analytics/top-posts', async (req, res, next) => {
  try {
    const range = req.query.range as any;
    const brandId = req.query.brandId as string;
    const network = req.query.network as any;
    const sort = req.query.sort as any;
    const limit = parseInt(req.query.limit as string, 10) || 10;

    const topPosts = await AnalyticsService.getTopPosts(req.ctx!, {
      range,
      brandId,
      network,
      sort,
      limit,
    });
    res.json({ posts: topPosts });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/export.csv
 */
analyticsRouter.get('/analytics/export.csv', async (req, res, next) => {
  try {
    const range = req.query.range as any;
    const brandId = req.query.brandId as string;
    const network = req.query.network as any;

    const csvData = await AnalyticsService.exportCsv(req.ctx!, { range, brandId, network });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="vsadda-analytics-${Date.now()}.csv"`);
    res.send(Buffer.from(csvData, 'utf-8'));
  } catch (err) {
    next(err);
  }
});
