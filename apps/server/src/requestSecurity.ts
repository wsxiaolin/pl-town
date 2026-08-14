import type { IncomingMessage } from 'node:http';
import { ALLOWED_ORIGINS, IS_PRODUCTION, TRUST_PROXY_HOPS } from './config.js';

const normalizeIp = (value: string): string => value.startsWith('::ffff:') ? value.slice(7) : value;

export function clientIp(request: IncomingMessage): string {
  if (TRUST_PROXY_HOPS > 0) {
    const forwarded = request.headers['x-forwarded-for'];
    const addresses = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded)?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const index = addresses.length - TRUST_PROXY_HOPS;
    if (index >= 0 && addresses[index]) return normalizeIp(addresses[index]!);
  }
  return normalizeIp(request.socket.remoteAddress ?? 'unknown');
}

export function originAllowed(origin: string | undefined, allowMissing = false): boolean {
  if (!origin) return allowMissing;
  try {
    const url = new URL(origin);
    if (ALLOWED_ORIGINS.has(url.origin)) return true;
    return !IS_PRODUCTION && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export function requestOriginAllowed(request: IncomingMessage, allowMissing = false): boolean {
  return originAllowed(typeof request.headers.origin === 'string' ? request.headers.origin : undefined, allowMissing);
}

export const jsonSecurityHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  ...(IS_PRODUCTION ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
} as const;

export function pathOf(request: IncomingMessage): string {
  try { return new URL(request.url ?? '/', 'http://localhost').pathname; } catch { return '/'; }
}
