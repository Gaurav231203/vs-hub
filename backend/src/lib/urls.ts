import { Request } from 'express';
import { env } from '../config/env.js';

/**
 * Returns the canonical frontend web application base URL.
 * Automatically inspects the incoming Request (Origin, Referer, Host headers),
 * falls back to configured WEB_URL, or defaults to the production Vercel domain.
 */
export function getWebUrl(req?: Request): string {
  if (req) {
    const origin = (req.headers['origin'] || req.headers['referer']) as string | undefined;
    if (origin) {
      try {
        const parsed = new URL(origin);
        return `${parsed.protocol}//${parsed.host}`;
      } catch {}
    }

    const forwardedHost = req.headers['x-forwarded-host'] as string | undefined;
    if (forwardedHost && !forwardedHost.includes('onrender.com') && !forwardedHost.includes('localhost')) {
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      return `${proto}://${forwardedHost.split(',')[0].trim()}`;
    }
  }

  // If env.WEB_URL is configured and is NOT localhost
  if (env.WEB_URL && !env.WEB_URL.includes('localhost') && !env.WEB_URL.includes('127.0.0.1')) {
    return env.WEB_URL.replace(/\/+$/, '');
  }

  // In production mode, default to the deployed Vercel domain
  if (env.NODE_ENV === 'production') {
    return 'https://vs-hub-ruddy.vercel.app';
  }

  return (env.WEB_URL || 'http://localhost:5173').replace(/\/+$/, '');
}

/**
 * Returns the canonical backend API base URL.
 */
export function getApiUrl(req?: Request): string {
  if (req) {
    const host = (req.headers['x-forwarded-host'] || req.headers['host']) as string | undefined;
    if (host) {
      const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
      return `${proto}://${host.split(',')[0].trim()}`;
    }
  }

  if (env.API_URL && !env.API_URL.includes('localhost') && !env.API_URL.includes('127.0.0.1')) {
    return env.API_URL.replace(/\/+$/, '');
  }

  if (env.NODE_ENV === 'production') {
    return 'https://vs-hub-1.onrender.com';
  }

  return (env.API_URL || 'http://localhost:4000').replace(/\/+$/, '');
}
