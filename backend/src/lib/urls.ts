import { Request } from 'express';
import { env } from '../config/env.js';

/**
 * Checks whether a hostname belongs to our own web application (preventing external OAuth
 * Referer headers such as https://www.facebook.com/ from hijacking post-OAuth redirects).
 */
export function isTrustedWebHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  if (!host) return false;

  if (host === 'localhost' || host === '127.0.0.1') return true;
  if (host.includes('onrender.com')) return false;

  if (env.WEB_URL) {
    try {
      const configuredHost = new URL(env.WEB_URL).hostname.toLowerCase();
      if (host === configuredHost) return true;
    } catch {}
  }

  if (host === 'vs-hub-ruddy.vercel.app' || (host.startsWith('vs-hub') && host.endsWith('.vercel.app'))) {
    return true;
  }

  if (host === 'vsadda.com' || host.endsWith('.vsadda.com')) {
    return true;
  }

  return false;
}

/**
 * Returns the canonical frontend web application base URL.
 * Only accepts Origin/Referer/X-Forwarded-Host when it matches a trusted frontend host,
 * otherwise falls back to configured WEB_URL or the production Vercel domain.
 */
export function getWebUrl(req?: Request): string {
  if (req) {
    const origin = (req.headers['origin'] || req.headers['referer']) as string | undefined;
    if (origin) {
      try {
        const parsed = new URL(origin);
        if (isTrustedWebHost(parsed.hostname)) {
          return `${parsed.protocol}//${parsed.host}`;
        }
      } catch {}
    }

    const forwardedHost = req.headers['x-forwarded-host'] as string | undefined;
    if (forwardedHost) {
      const rawHost = forwardedHost.split(',')[0].trim();
      const hostnameOnly = rawHost.split(':')[0];
      if (isTrustedWebHost(hostnameOnly)) {
        const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
        return `${proto}://${rawHost}`;
      }
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
