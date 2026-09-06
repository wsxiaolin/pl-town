import type { IncomingMessage } from 'node:http';
import { BlockList, isIP } from 'node:net';
import { ALLOWED_ORIGIN_WILDCARDS, ALLOWED_ORIGINS, IS_PRODUCTION, TRUST_PROXY_HOPS, TRUSTED_PROXIES } from './config.js';

const normalizeIp = (value: string): string => value.startsWith('::ffff:') ? value.slice(7) : value;

// X-Forwarded-For is only honoured when the TCP peer itself matches a
// configured trusted proxy (TRUSTED_PROXIES, loopback by default). Reading the
// header on arbitrary connections would let any client that reaches the port
// directly spoof its IP and defeat every per-IP rate limit, WebSocket cap and
// registration quota (CWE-290), so untrusted peers fail closed to the socket
// address.
const trustedProxyRanges = new BlockList();
for (const entry of TRUSTED_PROXIES) {
  const separator = entry.lastIndexOf('/');
  const address = separator === -1 ? entry : entry.slice(0, separator);
  const family = isIP(address) === 6 ? ('ipv6' as const) : ('ipv4' as const);
  if (separator === -1) trustedProxyRanges.addAddress(address, family);
  else trustedProxyRanges.addSubnet(address, Number(entry.slice(separator + 1)), family);
}
const isFromTrustedProxy = (request: IncomingMessage): boolean => {
  const peer = request.socket.remoteAddress;
  if (peer === undefined) return false;
  const normalized = normalizeIp(peer);
  return trustedProxyRanges.check(normalized, isIP(normalized) === 6 ? 'ipv6' : 'ipv4');
};

export function clientIp(request: IncomingMessage): string {
  if (TRUST_PROXY_HOPS > 0 && isFromTrustedProxy(request)) {
    const forwarded = request.headers['x-forwarded-for'];
    const addresses = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded)?.split(',').map((value) => value.trim()).filter(Boolean) ?? [];
    const index = addresses.length - TRUST_PROXY_HOPS;
    if (index >= 0 && addresses[index]) return normalizeIp(addresses[index]!);
  }
  return normalizeIp(request.socket.remoteAddress ?? 'unknown');
}

// Requests whose Origin matches the server's own host are same-origin by
// definition: the admin panel is served from the backend domain itself, so
// its fetches and WebSocket connections must be accepted even when that
// domain is absent from ALLOWED_ORIGINS. Browsers always derive the Host
// header from the URL they are talking to, so a cross-site page cannot make
// a victim's browser send a matching pair; the header pair can only be
// forged by a direct client that gains nothing extra because session auth,
// CSRF tokens and rate limits still apply. Behind a TLS-terminating proxy
// the original host is read from X-Forwarded-Host, honoured only from
// trusted proxy peers (same rules as clientIp).
const sameOriginWithHost = (request: IncomingMessage, origin: URL): boolean => {
  const candidates = new Set<string>();
  const collect = (value: string | string[] | undefined) => {
    const hosts = (Array.isArray(value) ? value.join(',') : value)?.split(',').map((entry) => entry.trim().toLowerCase()).filter(Boolean) ?? [];
    for (const host of hosts) {
      candidates.add(host);
      try { candidates.add(new URL(`http://${host}`).host); } catch { /* ignore malformed header values */ }
    }
  };
  collect(request.headers.host);
  if (TRUST_PROXY_HOPS > 0 && isFromTrustedProxy(request)) collect(request.headers['x-forwarded-host']);
  return candidates.has(origin.host.toLowerCase()) || candidates.has(origin.hostname.toLowerCase());
};

export function originAllowed(origin: string | undefined, allowMissing = false): boolean {
  if (!origin) return allowMissing;
  try {
    const url = new URL(origin);
    if (ALLOWED_ORIGINS.has(url.origin)) return true;
    for (const allowed of ALLOWED_ORIGIN_WILDCARDS) {
      const allowedUrl = new URL(allowed);
      const hostname = url.hostname.toLowerCase();
      const allowedHostname = allowedUrl.hostname.toLowerCase();
      const prefix = hostname.endsWith(`.${allowedHostname}`) ? hostname.slice(0, -(allowedHostname.length + 1)) : '';
      if (url.protocol === allowedUrl.protocol && url.port === allowedUrl.port && prefix && !prefix.includes('.')) return true;
    }
    return !IS_PRODUCTION && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  } catch { return false; }
}

export function requestOriginAllowed(request: IncomingMessage, allowMissing = false): boolean {
  const origin = typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
  if (!origin) return allowMissing;
  try {
    if (sameOriginWithHost(request, new URL(origin))) return true;
  } catch { return false; }
  return originAllowed(origin, allowMissing);
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
