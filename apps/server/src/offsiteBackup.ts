import { basename, join } from 'node:path';
import type { ServerResponse } from 'node:http';
import OSS from 'ali-oss';
import { listBackups } from './backup.js';
import {
  BACKUP_DIR, OFFSITE_BACKUP_ENABLED, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET,
  OSS_BUCKET, OSS_ENDPOINT, OSS_PREFIX, OSS_REGION, OSS_SECURE,
} from './config.js';
import { logger } from './logger.js';

// Off-site backups are a secondary copy of verified local backups. Uploads only
// ever originate from a local verified backup, which guarantees the "remote is
// a subset of local" invariant the feature is built around.
const BACKUP_NAME = /^minicity-(\d{8}T\d{6}\.\d{3}Z)-([a-f0-9]{8})\.sqlite$/;
const SHA256 = /^[a-f0-9]{64}$/i;
const KEY_PREFIX = OSS_PREFIX.endsWith('/') ? OSS_PREFIX : `${OSS_PREFIX}/`;
const keyFor = (name: string) => `${KEY_PREFIX}${name}`;
const sidecarKeyFor = (name: string) => `${KEY_PREFIX}${name}.manifest.json`;
const validName = (name: string) => BACKUP_NAME.test(basename(name)) && basename(name) === name;

export type OffsiteBackupInfo = {
  name: string;
  bytes: number;
  uploadedAt?: string;
  sha256?: string;
  local: boolean;
  inSync: boolean;
  orphan: boolean;
};

let client: OSS | null = null;

export function offsiteBackupEnabled(): boolean {
  return OFFSITE_BACKUP_ENABLED;
}

const oss = (): OSS => {
  if (!OFFSITE_BACKUP_ENABLED) throw new Error('Off-site OSS backups are not configured');
  if (client) return client;
  client = new OSS({
    region: OSS_REGION || undefined,
    endpoint: OSS_ENDPOINT || undefined,
    bucket: OSS_BUCKET,
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
    secure: OSS_SECURE,
    timeout: 300_000,
  });
  return client;
};

const checksumFromMeta = async (store: OSS, key: string): Promise<string | undefined> => {
  try {
    const head = await store.head(key);
    const candidate = head.meta?.sha256;
    return typeof candidate === 'string' && SHA256.test(candidate) ? candidate.toLowerCase() : undefined;
  } catch { return undefined; }
};

const checksumFromSidecar = async (store: OSS, key: string): Promise<string | undefined> => {
  try {
    const result = await store.get(key);
    const parsed = JSON.parse(result.content.toString('utf8')) as { sha256?: unknown };
    return typeof parsed.sha256 === 'string' && SHA256.test(parsed.sha256) ? parsed.sha256.toLowerCase() : undefined;
  } catch { return undefined; }
};

// List the remote backups, enriched with their local counterpart status. A
// remote backup is "orphaned" when the local backup no longer exists (e.g.
// after retention pruning); the admin console surfaces it so it can be deleted
// to restore the "remote is a subset of local" invariant.
export async function listOffsiteBackups(): Promise<OffsiteBackupInfo[]> {
  const store = oss();
  const local = new Map(listBackups().map((backup) => [backup.name, backup]));
  const found: Array<{ name: string; key: string; size: number; uploadedAt?: string }> = [];
  let marker: string | undefined;
  do {
    const page = await store.list({ prefix: KEY_PREFIX, marker, 'max-keys': 1_000 });
    for (const object of page.objects ?? []) {
      const name = object.name.startsWith(KEY_PREFIX) ? object.name.slice(KEY_PREFIX.length) : object.name;
      if (!validName(name)) continue;
      found.push({ name, key: object.name, size: Number(object.size) || 0, uploadedAt: object.lastModified ? new Date(object.lastModified).toISOString() : undefined });
    }
    marker = page.isTruncated ? page.nextMarker : undefined;
    if ((page.objects ?? []).length === 0) break;
  } while (marker);

  const items = await Promise.all(found.map(async ({ name, key, size, uploadedAt }) => {
    const sha256 = (await checksumFromMeta(store, key)) ?? (await checksumFromSidecar(store, sidecarKeyFor(name)));
    const localBackup = local.get(name);
    const isLocal = Boolean(localBackup);
    return { name, bytes: size, uploadedAt, sha256, local: isLocal, inSync: isLocal && localBackup!.sha256 === sha256, orphan: !isLocal };
  }));
  items.sort((a, b) => b.name.localeCompare(a.name));
  return items;
}

// Upload a local verified backup to OSS together with its immutable sidecar.
// Uploading from the local list is what keeps every remote backup present
// locally.
export async function uploadOffsiteBackup(name: string): Promise<OffsiteBackupInfo> {
  if (!validName(name)) throw new Error('Backup was not found');
  const localBackup = listBackups().find((backup) => backup.name === name);
  if (!localBackup) throw new Error('Backup was not found locally');
  if (!localBackup.sha256) throw new Error('Backup is not verified; re-verify it before uploading');
  const store = oss();
  const key = keyFor(name);
  const headers = await store.put(key, join(BACKUP_DIR, name), { meta: { sha256: localBackup.sha256 } });
  try {
    await store.put(sidecarKeyFor(name), join(BACKUP_DIR, `${name}.manifest.json`));
  } catch (error) {
    // The backup object itself is authoritative; a missing sidecar only means
    // the remote checksum has to come from x-oss-meta-sha256 metadata.
    logger.warn('Off-site backup sidecar upload failed', { name, error: String(error) });
  }
  logger.info('Database backup uploaded off-site', { name, bytes: localBackup.bytes, sha256: localBackup.sha256, statusCode: headers.res?.statusCode ?? 0 });
  return { name, bytes: localBackup.bytes, uploadedAt: new Date().toISOString(), sha256: localBackup.sha256, local: true, inSync: true, orphan: false };
}

// Proxy a remote backup straight from OSS to the caller without staging it on
// disk, so a remote download never introduces a backup that is not local.
export async function streamOffsiteBackup(name: string, response: ServerResponse): Promise<boolean> {
  if (!validName(name)) return false;
  const store = oss();
  const key = keyFor(name);
  try { await store.head(key); } catch { return false; }
  const result = await store.getStream(key);
  const bytes = Number(result.res?.headers?.['content-length'] ?? 0);
  response.writeHead(200, {
    'content-type': 'application/vnd.sqlite3', 'content-length': bytes,
    'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  result.stream.pipe(response);
  result.stream.once('error', () => { response.destroy(); });
  response.once('close', () => { if (!response.writableFinished) result.stream.destroy(); });
  return true;
}

export async function deleteOffsiteBackup(name: string): Promise<void> {
  if (!validName(name)) throw new Error('Backup was not found');
  const store = oss();
  await store.delete(keyFor(name));
  try { await store.delete(sidecarKeyFor(name)); } catch (error) {
    logger.warn('Off-site backup sidecar delete failed', { name, error: String(error) });
  }
  logger.info('Database backup deleted off-site', { name });
}
