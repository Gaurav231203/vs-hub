import { Request, Response, NextFunction } from 'express';
import { CalendarService } from './calendar.service.js';

export class CalendarController {
  static async getCalendar(req: Request, res: Response, next: NextFunction) {
    try {
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const brandId = (req.query.brandId as string) || null;

      const data = await CalendarService.getCalendar(req.ctx!, from, to, brandId);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  static async getBestTimes(req: Request, res: Response, next: NextFunction) {
    try {
      const brandId = (req.query.brandId as string) || null;
      const network = (req.query.network as string) || null;

      const data = await CalendarService.getBestTimes(req.ctx!, brandId, network);
      return res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}
