import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import {
  adminLoginAllowed, authenticateAdmin, authorizeAdminMutation,
  createAdminSession, destroyAdminSession,
} from './adminAuth.js';
import { createBackup, listBackups, streamBackup, verifyStoredBackup } from './backup.js';
import { verifyBackup } from './backupVerification.js';
import { ADMIN_ENABLED, AUTO_BACKUP_ENABLED, BACKUP_DIR, BACKUP_INTERVAL_MINUTES, BACKUP_RETENTION_DAYS, DATABASE_PATH, IS_PRODUCTION } from './config.js';
import * as db from './db.js';
import { HttpBodyError, readJson } from './httpBody.js';
import { logger } from './logger.js';
import { clientIp, jsonSecurityHeaders, pathOf, requestOriginAllowed } from './requestSecurity.js';
import { STORY_CATALOG, getStorySummary } from './storyCatalog.js';
import { handleTelemetryAdmin } from './telemetry.js';

type Context = { online: () => number; disconnectUser: (userId: string) => void; disconnectAll: () => void; startedAt: number };
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
  const userEdit = path.match(/^\/admin\/api\/users\/([0-9a-f-]{36})$/i);
  if (request.method === 'PATCH' && userEdit) {
    const body = await readJson(request, 4_096);
    const userId = userEdit[1]!;
    if (typeof body.nickname === 'string') {
      const trimmed = body.nickname.trim();
      if (trimmed.length < 2 || trimmed.length > 40 || !/^[\p{L}\p{N}]+$/u.test(trimmed)) { error(response, 400, 'INVALID_NICKNAME', '昵称仅允许 2-40 位字母或数字'); return true; }
      const result = db.updateAdminUserNickname(userId, trimmed);
      if (!result.ok) { error(response, 400, 'NICKNAME_TAKEN', result.reason ?? '昵称更新失败'); return true; }
      db.recordAdminAudit(principal.actor, 'user.rename', userId, { nickname: trimmed });
    }
    if (body.houseId !== undefined) {
      const target = body.houseId === null ? null : typeof body.houseId === 'string' ? body.houseId : '';
      if (target === '') { error(response, 400, 'INVALID_HOUSE', '住房 ID 无效'); return true; }
      const result = db.moveUserToHouse(userId, target);
      if (!result.ok) { error(response, 400, 'HOUSE_MOVE_FAILED', result.reason ?? '住房分配失败'); return true; }
      db.recordAdminAudit(principal.actor, 'user.house.assign', userId, { houseId: target });
    }
    context.disconnectUser(userId);
    respond(response, 200, { ok: true }); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/houses') { respond(response, 200, { items: db.listAdminHouses() }); return true; }
  const houseEdit = path.match(/^\/admin\/api\/houses\/(.+)$/);
  if (request.method === 'PATCH' && houseEdit) {
    const body = await readJson(request, 4_096);
    const buildingId = decodeURIComponent(houseEdit[1]!);
    if (typeof body.name === 'string') { const trimmed = body.name.trim().slice(0, 80); if (!trimmed) { error(response, 400, 'INVALID_BODY', '住房名称不能为空'); return true; } db.renameHouse(buildingId, trimmed); }
    if (Array.isArray(body.memberIds)) {
      if (!body.memberIds.every((id: unknown) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) { error(response, 400, 'INVALID_BODY', '成员列表无效'); return true; }
      const result = db.setHouseRoster(buildingId, body.memberIds as string[]);
      if (!result.ok) { error(response, 400, 'INVALID_ROSTER', result.reason ?? '成员更新失败'); return true; }
    }
    db.recordAdminAudit(principal.actor, 'house.update', buildingId, { name: body.name, memberCount: Array.isArray(body.memberIds) ? body.memberIds.length : undefined });
    respond(response, 200, { ok: true }); return true;
  }
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

  // Chat moderation: list recent messages, group by author, hide/flag.
  if (request.method === 'GET' && path === '/admin/api/chat') {
    const url = new URL(request.url ?? path, 'http://localhost');
    const limit = integer(url.searchParams.get('limit'), 50, 1, 200);
    const offset = integer(url.searchParams.get('offset'), 0, 0, 1_000_000);
    const query = (url.searchParams.get('q') ?? '').slice(0, 100);
    const includeHidden = url.searchParams.get('hidden') === '1';
    const onlyHidden = url.searchParams.get('hidden') === 'only';
    const onlyFlagged = url.searchParams.get('flagged') === '1';
    const userId = (url.searchParams.get('userId') ?? '').slice(0, 64) || undefined;
    respond(response, 200, db.listChatMessages({ query, includeHidden, onlyHidden, onlyFlagged, userId, limit, offset }));
    return true;
  }
  if (request.method === 'GET' && path === '/admin/api/chat/authors') {
    const url = new URL(request.url ?? path, 'http://localhost');
    respond(response, 200, { items: db.listChatAuthors(integer(url.searchParams.get('limit'), 100, 1, 500)) }); return true;
  }
  const chatHide = path.match(/^\/admin\/api\/chat\/([0-9]+)\/(hide|show)$/);
  if (request.method === 'POST' && chatHide) {
    const id = Number(chatHide[1]);
    if (!Number.isInteger(id) || id <= 0) { error(response, 400, 'INVALID_BODY', '消息 ID 无效'); return true; }
    const hidden = chatHide[2] === 'hide';
    if (!db.setChatMessageHidden(id, hidden, principal.actor)) { error(response, 404, 'CHAT_NOT_FOUND', '消息不存在或状态未变'); return true; }
    db.recordAdminAudit(principal.actor, hidden ? 'chat.hide' : 'chat.show', String(id));
    respond(response, 200, { ok: true }); return true;
  }
  const chatFlag = path.match(/^\/admin\/api\/chat\/([0-9]+)\/flag$/);
  if (request.method === 'POST' && chatFlag) {
    const id = Number(chatFlag[1]);
    if (!Number.isInteger(id) || id <= 0) { error(response, 400, 'INVALID_BODY', '消息 ID 无效'); return true; }
    if (!db.flagChatMessage(id)) { error(response, 404, 'CHAT_NOT_FOUND', '消息不存在或已标记'); return true; }
    db.recordAdminAudit(principal.actor, 'chat.flag', String(id));
    respond(response, 200, { ok: true }); return true;
  }

  // Story catalog + per-resident story progress.
  if (request.method === 'GET' && path === '/admin/api/stories') {
    respond(response, 200, { items: STORY_CATALOG }); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/story-progress') {
    const url = new URL(request.url ?? path, 'http://localhost');
    const limit = integer(url.searchParams.get('limit'), 50, 1, 200);
    const offset = integer(url.searchParams.get('offset'), 0, 0, 1_000_000);
    const query = (url.searchParams.get('q') ?? '').slice(0, 100);
    const storyId = (url.searchParams.get('storyId') ?? '').slice(0, 64) || undefined;
    const { items, total } = db.listStoryProgress({ query, storyId, limit, offset });
    respond(response, 200, { total, items: items.map((row) => { const story = getStorySummary(row.storyId); return { ...row, story, nodeTitle: story.nodes.find((node) => node.id === row.nodeId)?.title ?? row.nodeId }; }) });
    return true;
  }

  // Restore a verified backup from the admin console. Destructive: it replaces
  // every live table and revokes all resident sessions.
  const restore = path.match(/^\/admin\/api\/backups\/(minicity-[A-Za-z0-9.-]+\.sqlite)\/restore$/);
  if (request.method === 'POST' && restore) {
    const name = restore[1]!;
    const body = await readJson(request, 1_024).catch(() => ({} as Record<string, unknown>));
    if (body.confirm !== true) { error(response, 400, 'CONFIRM_REQUIRED', '恢复备份需要二次确认'); return true; }
    const candidatePath = join(BACKUP_DIR, name);
    let verification;
    try { verification = await verifyBackup(candidatePath); }
    catch { error(response, 404, 'BACKUP_NOT_FOUND', '备份不存在或无法校验'); return true; }
    if (verification.integrity !== 'ok' || verification.foreignKeyErrors) { error(response, 422, 'BACKUP_UNVERIFIED', '备份完整性校验未通过'); return true; }
    context.disconnectAll();
    try {
      const result = db.restoreFromBackupFile(candidatePath);
      db.recordAdminAudit(principal.actor, 'database.backup.restore', name, { rowsCopied: result.rowsCopied });
      logger.info('Database restored from backup', { name, actor: principal.actor, rowsCopied: result.rowsCopied });
      respond(response, 200, { ok: true, integrity: db.verifyDatabase(), rowsCopied: result.rowsCopied });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      logger.error('Database restore failed', { name, error: message });
      error(response, 500, 'RESTORE_FAILED', message);
    }
    return true;
  }

  // Telemetry: user events, client error reports, server metrics and logs.
  if (await handleTelemetryAdmin(request, response, context, principal.actor)) return true;

  error(response, 404, 'NOT_FOUND', 'Admin endpoint was not found');
  return true;
}

export function handleAdminError(response: ServerResponse, caught: unknown): void {
  if (response.headersSent) { response.end(); return; }
  if (caught instanceof HttpBodyError) { error(response, caught.statusCode, 'INVALID_REQUEST', caught.message); return; }
  logger.error('Admin request failed', { error: caught instanceof Error ? caught.message : String(caught) });
  error(response, 500, 'INTERNAL_ERROR', 'The administration request failed');
}
