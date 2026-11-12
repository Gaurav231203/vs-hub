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

/**
 * Strips accidental surrounding quotes and whitespace from dashboard-configured env vars (e.g. Render/Vercel).
 */
export function cleanEnvString(val: unknown): string | undefined {
  if (typeof val !== 'string') return undefined;
  let cleaned = val.trim();
  while (
    cleaned.length >= 2 &&
    ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'")))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned === '' ? undefined : cleaned;
}

const cleanStr = (defaultVal: string) => z.preprocess(cleanEnvString, z.string().default(defaultVal));

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_URL: cleanStr(process.env.NODE_ENV === 'production' ? 'https://vs-hub-1.onrender.com' : 'http://localhost:4000'),
  WEB_URL: cleanStr(process.env.NODE_ENV === 'production' ? 'https://vs-hub-ruddy.vercel.app' : 'http://localhost:5173'),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),

  ENCRYPTION_KEY: z.string().min(32),

  COOKIE_SECRET: z.string().min(32),
  COOKIE_DOMAIN: cleanStr('localhost'),
  COOKIE_SECURE: z.coerce.boolean().default(false),

  SMTP_HOST: cleanStr('smtp-relay.brevo.com'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: cleanStr(''),
  SMTP_PASS: cleanStr(''),
  EMAIL_FROM: cleanStr('VS Adda <washingtonjosh770@gmail.com>'),
  BREVO_API_KEY: cleanStr(''),
  RESEND_API_KEY: cleanStr(''),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_IMAGE_MB: z.coerce.number().default(25),
  MAX_VIDEO_MB: z.coerce.number().default(200),

  LOG_LEVEL: z.string().default('info'),
  SEED_OWNER_EMAIL: z.string().email().default('owner@example.com'),
  NETWORK_MODE: z.enum(['mock', 'live']).default('mock'),
  LATE_PUBLISH_GRACE_MIN: z.coerce.number().default(30),
  SHORT_LINK_BASE_URL: cleanStr('http://localhost:4000/s'),

  META_APP_ID: cleanStr('1700460381501081'),
  META_APP_SECRET: cleanStr(''),
  META_REDIRECT_URI: cleanStr('https://vs-hub-1.onrender.com/api/v1/oauth/meta/callback'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
