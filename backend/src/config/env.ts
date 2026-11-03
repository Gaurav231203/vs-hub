import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from root .env and local backend/.env
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../../.env'), override: true });
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_URL: z.string().default('http://localhost:4000'),
  WEB_URL: z.string().default('http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  ENCRYPTION_KEY: z.string().min(32),

  COOKIE_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECURE: z.coerce.boolean().default(false),

  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default('VS Adda <noreply@vsadda.local>'),
  BREVO_API_KEY: z.string().default(''),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_IMAGE_MB: z.coerce.number().default(25),
  MAX_VIDEO_MB: z.coerce.number().default(200),

  LOG_LEVEL: z.string().default('info'),
  SEED_OWNER_EMAIL: z.string().email().default('owner@example.com'),
  NETWORK_MODE: z.enum(['mock', 'live']).default('mock'),
  LATE_PUBLISH_GRACE_MIN: z.coerce.number().default(30),
  SHORT_LINK_BASE_URL: z.string().default('http://localhost:4000/s'),

  META_APP_ID: z.string().default(''),
  META_APP_SECRET: z.string().default(''),
  META_REDIRECT_URI: z.string().default('http://localhost:4000/api/v1/oauth/meta/callback'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
