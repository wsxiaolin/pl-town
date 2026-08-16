import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  ADMIN_ACCOUNTS, ADMIN_ENABLED, ADMIN_SESSION_TTL_MINUTES, IS_PRODUCTION,
} from './config.js';
import { FixedWindowRateLimiter } from './rateLimit.js';
import { clientIp, requestOriginAllowed } from './requestSecurity.js';

type Session = { actor: string; csrf: string; expiresAt: number; ip: string };
type Attempt = { count: number; startedAt: number };
export type AdminPrincipal = { actor: string; csrfRequired: boolean; csrf?: string };

const sessions = new Map<string, Session>();
const attempts = new Map<string, Attempt>();
const globalAttempts = new FixedWindowRateLimiter(100, 15 * 60_000, 1);
const SESSION_COOKIE = 'minicity_admin';
const SESSION_TTL_MS = ADMIN_SESSION_TTL_MINUTES * 60_000;
const digest = (value: string) => createHash('sha256').update(value).digest();
const equal = (left: string, right: string) => {
  const a = digest(left); const b = digest(right);
  return timingSafeEqual(a, b);
};

const cookies = (request: IncomingMessage): Record<string, string> => Object.fromEntries(
  String(request.headers.cookie ?? '').split(';').map((item) => item.trim()).filter(Boolean).map((item) => {
    const index = item.indexOf('=');
    return index > 0 ? [item.slice(0, index), decodeURIComponent(item.slice(index + 1))] : [item, ''];
  }),
);

const cookie = (token: string, maximumAgeSeconds: number) => [
  `${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'Path=/admin', 'HttpOnly', 'SameSite=Strict',
  IS_PRODUCTION ? 'Secure' : '', `Max-Age=${maximumAgeSeconds}`,
].filter(Boolean).join('; ');

export function adminLoginAllowed(request: IncomingMessage): boolean {
  const ip = clientIp(request);
  const now = Date.now();
  const attempt = attempts.get(ip) ?? { count: 0, startedAt: now };
  if (now - attempt.startedAt >= 15 * 60_000) { attempt.startedAt = now; attempt.count = 0; }
  if (++attempt.count > 8 || !globalAttempts.consume('global').allowed) { attempts.set(ip, attempt); return false; }
  attempts.set(ip, attempt);
  return true;
}

export function createAdminSession(request: IncomingMessage, response: ServerResponse, username: string, password: string): { actor: string; csrf: string } | null {
  const account = ADMIN_ACCOUNTS.find((candidate) => equal(username, candidate.username));
  const passwordMatches = equal(password, account?.password ?? 'invalid-administrator-password');
  if (!ADMIN_ENABLED || !account || !passwordMatches) return null;
  const token = randomBytes(32).toString('base64url');
  const session = { actor: account.username, csrf: randomBytes(24).toString('base64url'), expiresAt: Date.now() + SESSION_TTL_MS, ip: clientIp(request) };
  sessions.set(token, session);
  while (sessions.size > 100) sessions.delete(sessions.keys().next().value as string);
  response.setHeader('set-cookie', cookie(token, Math.floor(SESSION_TTL_MS / 1_000)));
  return { actor: session.actor, csrf: session.csrf };
}

export function authenticateAdmin(request: IncomingMessage): AdminPrincipal | null {
  const token = cookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now() || session.ip !== clientIp(request)) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { actor: session.actor, csrf: session.csrf, csrfRequired: true };
}

export function authorizeAdminMutation(request: IncomingMessage, principal: AdminPrincipal): boolean {
  if (!requestOriginAllowed(request, !IS_PRODUCTION)) return false;
  if (!principal.csrfRequired) return true;
  const token = request.headers['x-csrf-token'];
  return typeof token === 'string' && Boolean(principal.csrf) && equal(token, principal.csrf!);
}

export function destroyAdminSession(request: IncomingMessage, response: ServerResponse): void {
  const token = cookies(request)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  response.setHeader('set-cookie', cookie('', 0));
}

export function pruneAdminSessions(): void {
  const now = Date.now();
  for (const [token, session] of sessions) if (session.expiresAt <= now) sessions.delete(token);
  for (const [ip, attempt] of attempts) if (now - attempt.startedAt >= 15 * 60_000) attempts.delete(ip);
}
