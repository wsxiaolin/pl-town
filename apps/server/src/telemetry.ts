import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { DATABASE_PATH, LOG_DIR } from './config.js';
import { MINICITY_SCHEMA_VERSION } from './databaseMetadata.js';
import { HttpBodyError, readJson } from './httpBody.js';
import { logger } from './logger.js';
import { clientIp, jsonSecurityHeaders } from './requestSecurity.js';

// A second WAL connection to the same database file. The primary connection in
// db.ts owns the runtime lock; this read/write connection only touches telemetry
// tables that are created idempotently here, so it is safe to open in parallel.
const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
db.exec(`
  CREATE TABLE IF NOT EXISTS user_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT NOT NULL,
    properties_json TEXT NOT NULL DEFAULT '{}',
    ip TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS user_events_created_idx ON user_events(created_at DESC);
  CREATE INDEX IF NOT EXISTS user_events_event_idx ON user_events(event, created_at DESC);
  CREATE TABLE IF NOT EXISTS error_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    stack TEXT,
    url TEXT,
    user_agent TEXT,
    user_id TEXT,
    session_id TEXT NOT NULL,
    ip TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS error_reports_created_idx ON error_reports(created_at DESC);
  CREATE INDEX IF NOT EXISTS error_reports_kind_idx ON error_reports(kind, created_at DESC);
`);
// Ensure the schema version marker reflects telemetry support on fresh databases.
if (Number(db.pragma('user_version', { simple: true })) < MINICITY_SCHEMA_VERSION) {
  db.pragma(`user_version = ${MINICITY_SCHEMA_VERSION}`);
}

const now = () => new Date().toISOString();
const EVENT_NAME = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/;
const ERROR_KIND = /^(runtime|unhandled|resource|websocket|custom)$/i;
const clamp = (value: string, limit: number) => value.slice(0, limit);
const safeString = (value: unknown, limit: number): string => typeof value === 'string' ? clamp(value, limit) : '';

export function recordUserEvent(event: string, input: { sessionId: string; userId?: string | null; properties?: Record<string, unknown>; ip?: string }): boolean {
  if (!EVENT_NAME.test(event)) return false;
  const sessionId = safeString(input.sessionId, 64);
  if (!sessionId) return false;
  const properties = input.properties && typeof input.properties === 'object' ? input.properties : {};
  let propertiesJson: string;
  try { propertiesJson = clamp(JSON.stringify(properties), 4_000); } catch { propertiesJson = '{}'; }
  db.prepare('INSERT INTO user_events (event, user_id, session_id, properties_json, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(event, input.userId ?? null, sessionId, propertiesJson, safeString(input.ip ?? '', 64), now());
  return true;
}

export function recordClientError(input: { kind: string; message: string; stack?: string; url?: string; userAgent?: string; sessionId: string; userId?: string | null; ip?: string }): boolean {
  const kind = safeString(input.kind, 24).toLowerCase();
  if (!ERROR_KIND.test(kind)) return false;
  const message = safeString(input.message, 1_000);
  const sessionId = safeString(input.sessionId, 64);
  if (!message || !sessionId) return false;
  db.prepare('INSERT INTO error_reports (kind, message, stack, url, user_agent, user_id, session_id, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(kind, message, safeString(input.stack ?? '', 4_000), safeString(input.url ?? '', 500), safeString(input.userAgent ?? '', 300), input.userId ?? null, sessionId, safeString(input.ip ?? '', 64), now());
  return true;
}

// ── In-process server metrics ──────────────────────────────────────
type MetricKey = 'wsConnects' | 'wsMessages' | 'chatMessages' | 'httpRequests' | 'httpErrors' | 'clientErrors';
const counters: Record<MetricKey, number> = { wsConnects: 0, wsMessages: 0, chatMessages: 0, httpRequests: 0, httpErrors: 0, clientErrors: 0 };
const recentErrors: Array<{ message: string; at: string; context?: string }> = [];
const MAX_RECENT_ERRORS = 50;

export function bumpMetric(key: MetricKey): void { counters[key] += 1; }
export function recordServerError(message: string, context?: string): void {
  counters.httpErrors += 1;
  recentErrors.unshift({ message, at: now(), context });
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.pop();
}

export function serverMetrics(online: number, uptimeSeconds: number, startedAt: number): Record<string, unknown> {
  const memory = process.memoryUsage();
  return {
    online,
    uptimeSeconds,
    startedAt: new Date(startedAt).toISOString(),
    counters: { ...counters },
    memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal, external: memory.external },
    recentErrors: recentErrors.slice(0, 20),
  };
}

// ── Aggregation queries ─────────────────────────────────────────────
export type TelemetryOverview = {
  events: { total: number; last24h: number; top: Array<{ event: string; count: number }> };
  errors: { total: number; last24h: number; byKind: Array<{ kind: string; count: number }>; top: Array<{ kind: string; message: string; count: number }> };
  timeline: Array<{ bucket: string; events: number; errors: number }>;
};

export function getTelemetryOverview(): TelemetryOverview {
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const total = (db.prepare('SELECT COUNT(*) AS count FROM user_events').get() as { count: number }).count;
  const last24h = (db.prepare('SELECT COUNT(*) AS count FROM user_events WHERE created_at >= ?').get(dayAgo) as { count: number }).count;
  const top = (db.prepare('SELECT event, COUNT(*) AS count FROM user_events GROUP BY event ORDER BY count DESC, event LIMIT 12').all() as Array<{ event: string; count: number }>);
  const errorTotal = (db.prepare('SELECT COUNT(*) AS count FROM error_reports').get() as { count: number }).count;
  const errorLast24h = (db.prepare('SELECT COUNT(*) AS count FROM error_reports WHERE created_at >= ?').get(dayAgo) as { count: number }).count;
  const byKind = (db.prepare('SELECT kind, COUNT(*) AS count FROM error_reports GROUP BY kind ORDER BY count DESC').all() as Array<{ kind: string; count: number }>);
  const topErrors = (db.prepare('SELECT kind, message, COUNT(*) AS count FROM error_reports GROUP BY kind, message ORDER BY count DESC, message LIMIT 12').all() as Array<{ kind: string; message: string; count: number }>);
  // Hourly buckets for the last 24 hours.
  const rows = db.prepare(`
    WITH buckets AS (
      SELECT (strftime('%s', created_at) / 3600) * 3600 AS ts, 'event' AS src FROM user_events WHERE created_at >= ?
      UNION ALL
      SELECT (strftime('%s', created_at) / 3600) * 3600 AS ts, 'error' AS src FROM error_reports WHERE created_at >= ?
    )
    SELECT ts, src, COUNT(*) AS count FROM buckets GROUP BY ts, src ORDER BY ts
  `).all(dayAgo, dayAgo) as Array<{ ts: number; src: string; count: number }>;
  const byTs = new Map<number, { events: number; errors: number }>();
  for (const row of rows) {
    const bucket = byTs.get(row.ts) ?? { events: 0, errors: 0 };
    if (row.src === 'event') bucket.events += row.count; else bucket.errors += row.count;
    byTs.set(row.ts, bucket);
  }
  const timeline = [...byTs.entries()].map(([ts, values]) => ({ bucket: new Date(ts * 1000).toISOString().slice(0, 16), ...values }));
  return { events: { total, last24h, top }, errors: { total, last24h: errorLast24h, byKind, top: topErrors }, timeline };
}

export type UserEventRow = { id: number; event: string; userId: string | null; sessionId: string; properties: Record<string, unknown>; ip: string; createdAt: string };

export function listUserEvents(input: { event?: string; limit: number; offset: number }): { items: UserEventRow[]; total: number } {
  const conditions: string[] = [];
  const params: any[] = [];
  if (input.event) { conditions.push('event = ?'); params.push(input.event); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM user_events ${where}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`SELECT id, event, user_id, session_id, properties_json, ip, created_at FROM user_events ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, input.limit, input.offset) as any[];
  return { total, items: rows.map((row) => {
    let properties: Record<string, unknown> = {};
    try { properties = JSON.parse(row.properties_json) as Record<string, unknown>; } catch { /* keep empty */ }
    return { id: row.id, event: row.event, userId: row.user_id ?? null, sessionId: row.session_id, properties, ip: row.ip, createdAt: row.created_at };
  }) };
}

export type ErrorReportRow = { id: number; kind: string; message: string; stack: string | null; url: string | null; userAgent: string | null; userId: string | null; sessionId: string; ip: string; createdAt: string };

export function listErrorReports(input: { kind?: string; limit: number; offset: number }): { items: ErrorReportRow[]; total: number } {
  const conditions: string[] = [];
  const params: any[] = [];
  if (input.kind) { conditions.push('kind = ?'); params.push(input.kind); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS count FROM error_reports ${where}`).get(...params) as { count: number }).count;
  const rows = db.prepare(`SELECT id, kind, message, stack, url, user_agent, session_id, user_id, ip, created_at FROM error_reports ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...params, input.limit, input.offset) as any[];
  return { total, items: rows.map((row) => ({
    id: row.id, kind: row.kind, message: row.message, stack: row.stack ?? null, url: row.url ?? null,
    userAgent: row.user_agent ?? null, userId: row.user_id ?? null, sessionId: row.session_id, ip: row.ip, createdAt: row.created_at,
  })) };
}

// ── Server log tail (today's rotated file) ──────────────────────────
export function readRecentLog(lines = 200): { file: string; lines: string[] } {
  const day = new Date().toISOString().slice(0, 10);
  const file = `server-${day}.log`;
  try {
    const content = readFileSync(join(LOG_DIR, file), 'utf8');
    const all = content.split('\n').filter(Boolean);
    return { file, lines: all.slice(-Math.max(1, lines)) };
  } catch {
    return { file, lines: [] };
  }
}

// ── Public HTTP collection (mounted under /town-api/telemetry) ──────
export async function handleTelemetryCollection(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  const url = request.url ?? '';
  if (!url.startsWith('/town-api/telemetry/')) return false;
  if (request.method !== 'POST') { response.writeHead(405, jsonSecurityHeaders); response.end(JSON.stringify({ error: 'Method not allowed' })); return true; }
  try {
    const body = await readJson(request, 16_000);
    const ip = clientIp(request);
    const sessionId = safeString(body.sessionId, 64);
    if (url === '/town-api/telemetry/event') {
      const event = safeString(body.event, 80);
      const ok = recordUserEvent(event, { sessionId, userId: typeof body.userId === 'string' ? body.userId : null, properties: body.properties as Record<string, unknown> | undefined, ip });
      if (!ok) { response.writeHead(400, jsonSecurityHeaders); response.end(JSON.stringify({ error: 'Invalid event payload' })); return true; }
      response.writeHead(202, jsonSecurityHeaders); response.end(JSON.stringify({ ok: true })); return true;
    }
    if (url === '/town-api/telemetry/error') {
      const ok = recordClientError({
        kind: safeString(body.kind, 24), message: safeString(body.message, 1_000), stack: body.stack as string | undefined,
        url: body.url as string | undefined, userAgent: typeof body.userAgent === 'string' ? body.userAgent : '',
        sessionId, userId: typeof body.userId === 'string' ? body.userId : null, ip,
      });
      if (!ok) { response.writeHead(400, jsonSecurityHeaders); response.end(JSON.stringify({ error: 'Invalid error payload' })); return true; }
      bumpMetric('clientErrors');
      response.writeHead(202, jsonSecurityHeaders); response.end(JSON.stringify({ ok: true })); return true;
    }
    response.writeHead(404, jsonSecurityHeaders); response.end(JSON.stringify({ error: 'Not found' })); return true;
  } catch (error) {
    if (error instanceof HttpBodyError) { response.writeHead(error.statusCode, jsonSecurityHeaders); response.end(JSON.stringify({ error: error.message })); return true; }
    logger.warn('Telemetry collection failed', { error: error instanceof Error ? error.message : String(error) });
    response.writeHead(500, jsonSecurityHeaders); response.end(JSON.stringify({ error: 'Collection failed' })); return true;
  }
}

// ── Admin handlers (called from adminRouter) ───────────────────────
const integer = (value: string | null, fallback: number, minimum: number, maximum: number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
};

export async function handleTelemetryAdmin(request: IncomingMessage, response: ServerResponse, context: { online: () => number; startedAt: number }, actor: string): Promise<boolean> {
  const path = (request.url ?? '').split('?')[0] ?? '';
  const respond = (status: number, payload: unknown) => { response.writeHead(status, jsonSecurityHeaders); response.end(JSON.stringify(payload)); };

  if (request.method === 'GET' && path === '/admin/api/telemetry/overview') { respond(200, getTelemetryOverview()); return true; }
  if (request.method === 'GET' && path === '/admin/api/telemetry/health') {
    respond(200, serverMetrics(context.online(), Math.floor((Date.now() - context.startedAt) / 1_000), context.startedAt)); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/telemetry/events') {
    const url = new URL(request.url ?? path, 'http://localhost');
    const event = (url.searchParams.get('event') ?? '').slice(0, 80) || undefined;
    respond(200, listUserEvents({ event, limit: integer(url.searchParams.get('limit'), 100, 1, 500), offset: integer(url.searchParams.get('offset'), 0, 0, 1_000_000) })); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/telemetry/errors') {
    const url = new URL(request.url ?? path, 'http://localhost');
    const kind = (url.searchParams.get('kind') ?? '').slice(0, 24) || undefined;
    respond(200, listErrorReports({ kind, limit: integer(url.searchParams.get('limit'), 100, 1, 500), offset: integer(url.searchParams.get('offset'), 0, 0, 1_000_000) })); return true;
  }
  if (request.method === 'GET' && path === '/admin/api/telemetry/logs') {
    const url = new URL(request.url ?? path, 'http://localhost');
    respond(200, readRecentLog(integer(url.searchParams.get('lines'), 200, 1, 1_000))); return true;
  }
  if (request.method === 'POST' && path === '/admin/api/telemetry/clear') {
    db.transaction(() => { db.exec('DELETE FROM user_events'); db.exec('DELETE FROM error_reports'); })();
    logger.info('Telemetry data cleared', { actor });
    respond(200, { ok: true }); return true;
  }
  return false;
}
