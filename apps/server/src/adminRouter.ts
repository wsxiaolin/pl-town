import { readFileSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  adminLoginAllowed, authenticateAdmin, authorizeAdminMutation,
  createAdminSession, destroyAdminSession,
} from './adminAuth.js';
import { createBackup, listBackups, streamBackup, verifyStoredBackup } from './backup.js';
import { ADMIN_ENABLED, AUTO_BACKUP_ENABLED, BACKUP_INTERVAL_MINUTES, BACKUP_RETENTION_DAYS, DATABASE_PATH, IS_PRODUCTION } from './config.js';
import * as db from './db.js';
import { HttpBodyError, readJson } from './httpBody.js';
import { logger } from './logger.js';
import { clientIp, jsonSecurityHeaders, pathOf, requestOriginAllowed } from './requestSecurity.js';

type Context = { online: () => number; disconnectUser: (userId: string) => void; startedAt: number };
const assets = new Map([
  ['/admin/', { type: 'text/html; charset=utf-8', body: readFileSync(fileURLToPath(new URL('../admin/index.html', import.meta.url))) }],
  ['/admin/app.js', { type: 'text/javascript; charset=utf-8', body: readFileSync(fileURLToPath(new URL('../admin/app.js', import.meta.url))) }],
  ['/admin/styles.css', { type: 'text/css; charset=utf-8', body: readFileSync(fileURLToPath(new URL('../admin/styles.css', import.meta.url))) }],
]);
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const respond = (response: ServerResponse, status: number, payload: unknown, extra: Record<string, string> = {}) => {
  response.writeHead(status, { ...jsonSecurityHeaders, ...extra });
  response.end(JSON.stringify(payload));
};
const error = (response: ServerResponse, status: number, code: string, message: string) => respond(response, status, { error: { code, message } });
const integer = (value: string | null, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
};

async function login(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!ADMIN_ENABLED) return error(response, 503, 'ADMIN_DISABLED', 'Administration is not configured');
  if (!requestOriginAllowed(request, process.env.NODE_ENV !== 'production')) return error(response, 403, 'ORIGIN_REJECTED', 'Request origin is not allowed');
  if (!adminLoginAllowed(request)) return error(response, 429, 'RATE_LIMITED', 'Too many sign-in attempts');
  const body = await readJson(request, 4_096);
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (username.length > 128 || password.length > 256) return error(response, 400, 'INVALID_CREDENTIALS', 'Credentials are invalid');
  const session = createAdminSession(request, response, username, password);
  if (!session) {
    logger.warn('Admin sign-in failed', { ip: clientIp(request) });
    return error(response, 401, 'INVALID_CREDENTIALS', 'Username or password is incorrect');
  }
  db.recordAdminAudit(session.actor, 'admin.login', undefined, { ip: clientIp(request) });
  logger.info('Admin signed in', { actor: session.actor, ip: clientIp(request) });
  respond(response, 200, { authenticated: true, actor: session.actor, csrf: session.csrf });
}

export async function handleAdminRequest(request: IncomingMessage, response: ServerResponse, context: Context): Promise<boolean> {
  const path = pathOf(request);
  if (path !== '/admin' && !path.startsWith('/admin/')) return false;

  const assetPath = path === '/admin' ? '/admin/' : path;
  const asset = assets.get(assetPath);
  if (request.method === 'GET' && asset) {
    response.writeHead(200, {
      'content-type': asset.type, 'cache-control': assetPath === '/admin/' ? 'no-store' : 'public, max-age=3600',
      'content-security-policy': csp, 'cross-origin-opener-policy': 'same-origin', 'cross-origin-resource-policy': 'same-origin',
      'permissions-policy': 'camera=(), microphone=(), geolocation=()', 'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'x-robots-tag': 'noindex, nofollow',
      ...(IS_PRODUCTION ? { 'strict-transport-security': 'max-age=31536000; includeSubDomains' } : {}),
    });
    response.end(asset.body);
    return true;
  }

  if (request.method === 'POST' && path === '/admin/api/login') { await login(request, response); return true; }
  if (request.method === 'GET' && path === '/admin/api/session') {
    const principal = authenticateAdmin(request);
    respond(response, 200, principal ? { authenticated: true, actor: principal.actor, csrf: principal.csrf ?? null } : { authenticated: false, enabled: ADMIN_ENABLED });
    return true;
  }

  const principal = authenticateAdmin(request);
  if (!principal) { error(response, 401, 'UNAUTHORIZED', 'Administrator authentication is required'); return true; }
  if (!['GET', 'HEAD'].includes(request.method ?? '') && !authorizeAdminMutation(request, principal)) {
    error(response, 403, 'CSRF_REJECTED', 'Request verification failed'); return true;
  }

  if (request.method === 'POST' && path === '/admin/api/logout') {
    db.recordAdminAudit(principal.actor, 'admin.logout');
    destroyAdminSession(request, response);
    respond(response, 200, { ok: true }); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/overview') {
    const databaseBytes = (() => { try { return statSync(DATABASE_PATH).size; } catch { return 0; } })();
    respond(response, 200, {
      summary: db.getAdminSummary(databaseBytes), online: context.online(), uptimeSeconds: Math.floor((Date.now() - context.startedAt) / 1_000),
      integrity: db.verifyDatabase(), backups: listBackups().slice(0, 5),
      backupPolicy: { enabled: AUTO_BACKUP_ENABLED, intervalMinutes: BACKUP_INTERVAL_MINUTES, retentionDays: BACKUP_RETENTION_DAYS },
    }); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/users') {
    const url = new URL(request.url ?? path, 'http://localhost');
    const limit = integer(url.searchParams.get('limit'), 25, 1, 100);
    const offset = integer(url.searchParams.get('offset'), 0, 0, 1_000_000);
    const query = (url.searchParams.get('q') ?? '').slice(0, 100);
    respond(response, 200, db.listAdminUsers({ query, limit, offset })); return true;
  }
  const userStatus = path.match(/^\/admin\/api\/users\/([0-9a-f-]{36})\/status$/i);
  if (request.method === 'PATCH' && userStatus) {
    const body = await readJson(request, 1_024);
    if (typeof body.disabled !== 'boolean') { error(response, 400, 'INVALID_BODY', 'disabled must be a boolean'); return true; }
    if (!db.setUserDisabled(userStatus[1]!, body.disabled)) { error(response, 404, 'USER_NOT_FOUND', 'User was not found'); return true; }
    if (body.disabled) context.disconnectUser(userStatus[1]!);
    db.recordAdminAudit(principal.actor, body.disabled ? 'user.disable' : 'user.enable', userStatus[1]);
    respond(response, 200, { ok: true }); return true;
  }
  const userSession = path.match(/^\/admin\/api\/users\/([0-9a-f-]{36})\/revoke-session$/i);
  if (request.method === 'POST' && userSession) {
    if (!db.revokeUserSession(userSession[1]!)) { error(response, 404, 'USER_NOT_FOUND', 'User was not found'); return true; }
    context.disconnectUser(userSession[1]!);
    db.recordAdminAudit(principal.actor, 'user.session.revoke', userSession[1]);
    respond(response, 200, { ok: true }); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/houses') { respond(response, 200, { items: db.listHouses() }); return true; }
  if (request.method === 'GET' && path === '/admin/api/audit') {
    const url = new URL(request.url ?? path, 'http://localhost');
    respond(response, 200, { items: db.listAdminAudit(integer(url.searchParams.get('limit'), 100, 1, 250)) }); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/backups') { respond(response, 200, { items: listBackups() }); return true; }
  if (request.method === 'POST' && path === '/admin/api/backups') {
    const backup = await createBackup('manual');
    db.recordAdminAudit(principal.actor, 'database.backup.create', backup.name, { bytes: backup.bytes });
    respond(response, 201, { backup }); return true;
  }
  const download = path.match(/^\/admin\/api\/backups\/(minicity-[A-Za-z0-9.-]+\.sqlite)$/);
  if (request.method === 'GET' && download) {
    if (!streamBackup(download[1]!, response)) error(response, 404, 'BACKUP_NOT_FOUND', 'Backup was not found');
    else db.recordAdminAudit(principal.actor, 'database.backup.download', download[1]);
    return true;
  }
  const verify = path.match(/^\/admin\/api\/backups\/(minicity-[A-Za-z0-9.-]+\.sqlite)\/verify$/);
  if (request.method === 'POST' && verify) {
    const backup = await verifyStoredBackup(verify[1]!);
    db.recordAdminAudit(principal.actor, 'database.backup.verify', verify[1], { bytes: backup.bytes });
    respond(response, 200, { backup }); return true;
  }
  if (request.method === 'POST' && path === '/admin/api/database/checkpoint') {
    db.checkpointDatabase();
    db.recordAdminAudit(principal.actor, 'database.checkpoint');
    respond(response, 200, { ok: true, integrity: db.verifyDatabase() }); return true;
  }

  error(response, 404, 'NOT_FOUND', 'Admin endpoint was not found');
  return true;
}

export function handleAdminError(response: ServerResponse, caught: unknown): void {
  if (response.headersSent) { response.end(); return; }
  if (caught instanceof HttpBodyError) { error(response, caught.statusCode, 'INVALID_REQUEST', caught.message); return; }
  logger.error('Admin request failed', { error: caught instanceof Error ? caught.message : String(caught) });
  error(response, 500, 'INTERNAL_ERROR', 'The administration request failed');
}
