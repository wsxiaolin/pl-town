import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createBackup } from './backup.js';
import { DEPLOY_SNAPSHOT_TOKEN } from './config.js';
import * as db from './db.js';
import { logger } from './logger.js';
import { uploadOffsiteBackup } from './offsiteBackup.js';
import { FixedWindowRateLimiter } from './rateLimit.js';
import { clientIp, jsonSecurityHeaders, pathOf } from './requestSecurity.js';

const digest = (value: string) => createHash('sha256').update(value).digest();
const tokenMatches = (candidate: string): boolean => {
  if (!DEPLOY_SNAPSHOT_TOKEN) return false;
  return timingSafeEqual(digest(candidate), digest(DEPLOY_SNAPSHOT_TOKEN));
};

// A valid hit does a full backup + OSS upload, so cap it even though the token
// is the primary gate (the static CI token is long-lived).
const snapshotRate = new FixedWindowRateLimiter(6, 60_000);

export async function handleDeploySnapshot(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
  if (pathOf(request) !== '/internal/deploy/snapshot') return false;
  if (!DEPLOY_SNAPSHOT_TOKEN) {
    response.writeHead(404, jsonSecurityHeaders);
    response.end(JSON.stringify({ error: 'Not found' }));
    return true;
  }
  if (request.method !== 'POST') {
    response.writeHead(405, jsonSecurityHeaders);
    response.end(JSON.stringify({ error: 'Method not allowed' }));
    return true;
  }
  const header = request.headers.authorization;
  const token = typeof header === 'string' && header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!tokenMatches(token)) {
    logger.warn('Deploy snapshot rejected', { ip: clientIp(request) });
    response.writeHead(401, jsonSecurityHeaders);
    response.end(JSON.stringify({ error: 'Unauthorized' }));
    return true;
  }
  const rate = snapshotRate.consume(clientIp(request));
  if (!rate.allowed) {
    response.writeHead(429, { ...jsonSecurityHeaders, 'retry-after': String(rate.retryAfterSeconds) });
    response.end(JSON.stringify({ error: 'Too many snapshot requests' }));
    return true;
  }
  if (db.residentCount() === 0) {
    response.writeHead(409, jsonSecurityHeaders);
    response.end(JSON.stringify({ error: 'SNAPSHOT_EMPTY', message: 'Refusing to snapshot an empty database' }));
    return true;
  }
  try {
    const backup = await createBackup('deploy');
    const uploaded = await uploadOffsiteBackup(backup.name);
    logger.info('Deploy snapshot uploaded off-site', { name: backup.name, bytes: backup.bytes, sha256: backup.sha256 });
    response.writeHead(201, jsonSecurityHeaders);
    response.end(JSON.stringify({ ok: true, backup: uploaded }));
  } catch (error) {
    logger.error('Deploy snapshot failed', { error: String(error) });
    response.writeHead(502, jsonSecurityHeaders);
    response.end(JSON.stringify({ error: 'SNAPSHOT_FAILED' }));
  }
  return true;
}
