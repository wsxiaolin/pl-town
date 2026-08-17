import { createHash } from 'node:crypto';
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
import { deleteOffsiteBackup, listOffsiteBackups, offsiteBackupEnabled, streamOffsiteBackup, uploadOffsiteBackup } from './offsiteBackup.js';
import { ADMIN_ENABLED, AUTO_BACKUP_ENABLED, BACKUP_DIR, BACKUP_INTERVAL_MINUTES, BACKUP_RETENTION_DAYS, DATABASE_PATH, IS_PRODUCTION } from './config.js';
import * as db from './db.js';
import { HttpBodyError, readJson } from './httpBody.js';
import { logger } from './logger.js';
import { clientIp, jsonSecurityHeaders, pathOf, requestOriginAllowed } from './requestSecurity.js';
import { STORY_CATALOG, getStorySummary, getStoryTopology } from './storyCatalog.js';
import { NPC_CATALOG } from './npcCatalog.js';
import { handleTelemetryAdmin } from './telemetry.js';

type Context = {
  online: () => number;
  disconnectUser: (userId: string) => void;
  disconnectAll: () => void;
  broadcastHousing: () => void;
  startedAt: number;
};

type AdminAsset = { type: string; body: Buffer };

// Admin assets are hand-rolled (not processed by Vite), so they have no
// automatic content hash in their filename. We fingerprint them here by
// hashing each static asset at startup and rewriting the HTML references to
// `?v=<hash>`. The HTML shell is served with `no-store`, so a new deploy is
// picked up immediately; the versioned assets can then be cached immutably
// for a long time without serving stale JS/CSS after an update.
const fingerprint = (body: Buffer): string => createHash('sha256').update(body).digest('hex').slice(0, 16);
const readAsset = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)));
const staticAssets: ReadonlyArray<[string, AdminAsset]> = [
  ['/admin/styles.css', { type: 'text/css; charset=utf-8', body: readAsset('../admin/styles.css') }],
  ['/admin/app.js', { type: 'text/javascript; charset=utf-8', body: readAsset('../admin/app.js') }],
  ['/admin/story-topology.js', { type: 'text/javascript; charset=utf-8', body: readAsset('../admin/story-topology.js') }],
  ['/admin/story-topology.css', { type: 'text/css; charset=utf-8', body: readAsset('../admin/story-topology.css') }],
  ['/npc-edit-request.js', { type: 'text/javascript; charset=utf-8', body: readAsset('../admin/npc-edit-request.js') }],
];
const assetVersions = new Map(staticAssets.map(([path, asset]) => [path, fingerprint(asset.body)]));
const assets = new Map<string, AdminAsset>(staticAssets);
const adminHtml = readAsset('../admin/index.html')
  .toString('utf8')
  .replace('/admin/styles.css', `/admin/styles.css?v=${assetVersions.get('/admin/styles.css')}`)
  .replace('/admin/app.js', `/admin/app.js?v=${assetVersions.get('/admin/app.js')}`);
assets.set('/admin/', { type: 'text/html; charset=utf-8', body: Buffer.from(adminHtml, 'utf8') });
const topologyHtml = readAsset('../admin/story-topology.html')
  .toString('utf8')
  .replace('/admin/story-topology.css', `/admin/story-topology.css?v=${assetVersions.get('/admin/story-topology.css')}`)
  .replace('/admin/story-topology.js', `/admin/story-topology.js?v=${assetVersions.get('/admin/story-topology.js')}`);
assets.set('/admin/story-topology', { type: 'text/html; charset=utf-8', body: Buffer.from(topologyHtml, 'utf8') });
const npcEditRequestHtml = readAsset('../admin/npc-edit-request.html')
  .toString('utf8')
  .replace('/admin/styles.css', `/admin/styles.css?v=${assetVersions.get('/admin/styles.css')}`)
  .replace('/npc-edit-request.js', `/npc-edit-request.js?v=${assetVersions.get('/npc-edit-request.js')}`);
assets.set('/npc-edit-request.html', { type: 'text/html; charset=utf-8', body: Buffer.from(npcEditRequestHtml, 'utf8') });
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
  if (path !== '/admin' && !path.startsWith('/admin/') && path !== '/npc-edit-request.html' && path !== '/npc-edit-request.js') return false;

  const assetPath = path === '/admin' ? '/admin/' : path;
  const asset = assets.get(assetPath);
  if (request.method === 'GET' && asset) {
    response.writeHead(200, {
      'content-type': asset.type,
      // The HTML shells are never cached, so they always reference the latest
      // fingerprinted asset URLs. Versioned assets are immutable for a year:
      // their content changes only when the fingerprint (and thus the URL)
      // changes, so long-lived caching is safe and never serves stale code.
      'cache-control': asset.type.startsWith('text/html') ? 'no-store' : 'public, max-age=31536000, immutable',
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
      offsite: { enabled: offsiteBackupEnabled() },
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
      context.broadcastHousing();
    }
    context.disconnectUser(userId);
    respond(response, 200, { ok: true }); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/houses') { respond(response, 200, { items: db.listAdminHouses() }); return true; }
  const houseRoute = path.match(/^\/admin\/api\/houses\/(.+)$/);
  if (request.method === 'PATCH' && houseRoute) {
    const body = await readJson(request, 4_096);
    const buildingId = decodeURIComponent(houseRoute[1]!);
    if (typeof body.name === 'string') { const trimmed = body.name.trim().slice(0, 80); if (!trimmed) { error(response, 400, 'INVALID_BODY', '住房名称不能为空'); return true; } db.renameHouse(buildingId, trimmed); }
    if (Array.isArray(body.memberIds)) {
      if (!body.memberIds.every((id: unknown) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))) { error(response, 400, 'INVALID_BODY', '成员列表无效'); return true; }
      const result = db.setHouseRoster(buildingId, body.memberIds as string[]);
      if (!result.ok) { error(response, 400, 'INVALID_ROSTER', result.reason ?? '成员更新失败'); return true; }
    }
    db.recordAdminAudit(principal.actor, 'house.update', buildingId, { name: body.name, memberCount: Array.isArray(body.memberIds) ? body.memberIds.length : undefined });
    context.broadcastHousing();
    respond(response, 200, { ok: true }); return true;
  }
  if (request.method === 'DELETE' && houseRoute) {
    const buildingId = decodeURIComponent(houseRoute[1]!);
    if (!db.deleteHouse(buildingId)) { error(response, 404, 'HOUSE_NOT_FOUND', '住房不存在'); return true; }
    db.recordAdminAudit(principal.actor, 'house.delete', buildingId);
    context.broadcastHousing();
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

  // Off-site (Alibaba Cloud OSS) backups: manual upload/download/delete from the
  // admin console. Uploads only accept local verified backups, keeping the
  // "every remote backup has a local original" invariant.
  if (request.method === 'GET' && path === '/admin/api/offsite/backups') {
    if (!offsiteBackupEnabled()) { error(response, 503, 'OFFSITE_DISABLED', 'Off-site OSS backups are not configured'); return true; }
    const items = await listOffsiteBackups();
    respond(response, 200, { items, local: listBackups().map((backup) => ({ name: backup.name, sha256: backup.sha256 })) }); return true;
  }
  const offsiteUpload = path.match(/^\/admin\/api\/offsite\/backups\/(minicity-[A-Za-z0-9.-]+\.sqlite)\/upload$/);
  if (request.method === 'POST' && offsiteUpload) {
    if (!offsiteBackupEnabled()) { error(response, 503, 'OFFSITE_DISABLED', 'Off-site OSS backups are not configured'); return true; }
    try {
      const backup = await uploadOffsiteBackup(offsiteUpload[1]!);
      db.recordAdminAudit(principal.actor, 'database.backup.offsite.upload', offsiteUpload[1], { bytes: backup.bytes });
      respond(response, 201, { backup }); return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      if (message === 'Backup was not found' || message === 'Backup was not found locally') { error(response, 404, 'BACKUP_NOT_FOUND', message); return true; }
      if (message === 'Backup is not verified; re-verify it before uploading') { error(response, 422, 'BACKUP_UNVERIFIED', message); return true; }
      logger.error('Off-site backup upload failed', { name: offsiteUpload[1], error: message });
      error(response, 502, 'OFFSITE_UPLOAD_FAILED', 'Uploading the backup to the object store failed'); return true;
    }
  }
  const offsiteDownload = path.match(/^\/admin\/api\/offsite\/backups\/(minicity-[A-Za-z0-9.-]+\.sqlite)$/);
  if (request.method === 'GET' && offsiteDownload) {
    if (!offsiteBackupEnabled()) { error(response, 503, 'OFFSITE_DISABLED', 'Off-site OSS backups are not configured'); return true; }
    if (!await streamOffsiteBackup(offsiteDownload[1]!, response)) { error(response, 404, 'OFFSITE_BACKUP_NOT_FOUND', 'Off-site backup was not found'); return true; }
    db.recordAdminAudit(principal.actor, 'database.backup.offsite.download', offsiteDownload[1]);
    return true;
  }
  if (request.method === 'DELETE' && offsiteDownload) {
    if (!offsiteBackupEnabled()) { error(response, 503, 'OFFSITE_DISABLED', 'Off-site OSS backups are not configured'); return true; }
    try {
      await deleteOffsiteBackup(offsiteDownload[1]!);
      db.recordAdminAudit(principal.actor, 'database.backup.offsite.delete', offsiteDownload[1]);
      respond(response, 200, { ok: true }); return true;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      if (message === 'Backup was not found') { error(response, 404, 'OFFSITE_BACKUP_NOT_FOUND', message); return true; }
      logger.error('Off-site backup delete failed', { name: offsiteDownload[1], error: message });
      error(response, 502, 'OFFSITE_DELETE_FAILED', 'Deleting the backup from the object store failed'); return true;
    }
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

  // Story topology: read-only graph data for the standalone topology page.
  if (request.method === 'GET' && path === '/admin/api/story-topology') {
    const url = new URL(request.url ?? path, 'http://localhost');
    const storyId = (url.searchParams.get('storyId') ?? '').slice(0, 64) || (STORY_CATALOG[0]?.id ?? '');
    respond(response, 200, getStoryTopology(storyId));
    return true;
  }

  // NPC catalog + change-request workflow (player proposals + admin review).
  if (request.method === 'GET' && path === '/admin/api/npcs') {
    respond(response, 200, { items: NPC_CATALOG });
    return true;
  }
  if (request.method === 'GET' && path === '/admin/api/npc-change-requests') {
    const url = new URL(request.url ?? path, 'http://localhost');
    const limit = integer(url.searchParams.get('limit'), 50, 1, 200);
    const offset = integer(url.searchParams.get('offset'), 0, 0, 1_000_000);
    const status = (url.searchParams.get('status') ?? '').slice(0, 16) || undefined;
    const npcId = (url.searchParams.get('npcId') ?? '').slice(0, 100) || undefined;
    respond(response, 200, db.listNpcChangeRequests({ status: status as db.NpcChangeStatus | undefined, npcId, limit, offset }));
    return true;
  }
  const npcReview = path.match(/^\/admin\/api\/npc-change-requests\/([0-9]+)\/(approve|reject)$/);
  if (request.method === 'POST' && npcReview) {
    const id = Number(npcReview[1]);
    if (!Number.isInteger(id) || id <= 0) { error(response, 400, 'INVALID_BODY', '申请 ID 无效'); return true; }
    const body = await readJson(request, 1_024).catch(() => ({} as Record<string, unknown>));
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : undefined;
    const status = npcReview[2] === 'approve' ? 'approved' : 'rejected';
    const reviewed = db.reviewNpcChangeRequest(id, status, principal.actor, note);
    if (!reviewed) { error(response, 404, 'REQUEST_NOT_FOUND', '申请不存在或已处理'); return true; }
    db.recordAdminAudit(principal.actor, status === 'approved' ? 'npc.change.approve' : 'npc.change.reject', String(id), { npcId: reviewed.npcId, note });
    respond(response, 200, { ok: true, request: reviewed });
    return true;
  }
  if (request.method === 'POST' && path === '/admin/api/npc-change-requests') {
    const body = await readJson(request, 16_000);
    const npcId = typeof body.npcId === 'string' ? body.npcId.trim() : '';
    const kind = typeof body.kind === 'string' ? body.kind : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
    if (!npcId || npcId.length > 100) { error(response, 400, 'INVALID_BODY', 'NPC ID 无效'); return true; }
    if (kind !== 'add' && kind !== 'edit' && kind !== 'dialog') { error(response, 400, 'INVALID_BODY', '变更类型无效'); return true; }
    if (!title || title.length > 120) { error(response, 400, 'INVALID_BODY', '标题无效'); return true; }
    if (!summary || summary.length > 2_000) { error(response, 400, 'INVALID_BODY', '摘要无效'); return true; }
    const change = body.change && typeof body.change === 'object' && !Array.isArray(body.change) ? body.change as Record<string, unknown> : {};
    const created = db.createAdminNpcChangeRequest({ reviewer: principal.actor, npcId, kind, title, summary, change });
    db.recordAdminAudit(principal.actor, 'npc.change.direct', String(created.id), { npcId, kind, title });
    respond(response, 201, { ok: true, request: created });
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
