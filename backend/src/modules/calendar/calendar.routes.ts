import { Router } from 'express';
import { CalendarController } from './calendar.controller.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantMiddleware } from '../../middleware/tenant.js';

export const calendarRouter = Router();

calendarRouter.get('/calendar', authenticate, tenantMiddleware, CalendarController.getCalendar);
calendarRouter.get('/best-times', authenticate, tenantMiddleware, CalendarController.getBestTimes);
