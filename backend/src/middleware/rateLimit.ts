import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for public client connect invite view
 * 30 requests per 15 minutes per IP
 */
export const connectRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests to this connect link. Please try again later.',
    },
  },
});

/**
 * Rate limiter for OAuth authorize and callback endpoints
 * 10 requests per 5 minutes per IP
 */
export const oauthRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many OAuth attempts. Please try again after a few minutes.',
    },
  },
});

/**
 * Rate limiter for client post reviews (approvals & changes requested)
 * 40 requests per 15 minutes per IP
 */
export const reviewRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many review actions. Please wait before taking another action.',
    },
  },
});
