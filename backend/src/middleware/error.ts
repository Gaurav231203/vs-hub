import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const reqId = req.headers['x-request-id'] || 'unknown';

  if (err instanceof AppError) {
    logger.warn({ reqId, code: err.code, msg: err.message, status: err.status }, 'AppError');
    return res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details || {},
      },
    });
  }

  if (err instanceof ZodError) {
    logger.warn({ reqId, issues: err.issues }, 'Zod validation error');
    return res.status(422).json({
      error: {
        code: 'VALIDATION',
        message: 'Validation failed',
        details: err.flatten().fieldErrors,
      },
    });
  }

  logger.error({ reqId, err }, 'Unhandled exception');

  return res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      details: {},
    },
  });
}
