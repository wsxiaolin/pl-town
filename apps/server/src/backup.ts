import { randomUUID } from 'node:crypto';
import { chmodSync, createReadStream, lstatSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ServerResponse } from 'node:http';
import {
  AUTO_BACKUP_ENABLED, BACKUP_DIR, BACKUP_INTERVAL_MINUTES, BACKUP_MAX_FILES,
  BACKUP_ON_START, BACKUP_RETENTION_DAYS,
} from './config.js';
import { backupDatabase } from './db.js';
import { logger } from './logger.js';
import { verifyBackup } from './backupVerification.js';

export type BackupInfo = { name: string; bytes: number; createdAt: string; sha256?: string; verifiedAt?: string; verified: boolean };
const BACKUP_NAME = /^minicity-(\d{8}T\d{6}\.\d{3}Z)-([a-f0-9]{8})\.sqlite$/;
const MANIFEST_NAME = 'manifest.json';
type ManifestRecord = { bytes: number; createdAt: string; sha256: string; userVersion: number; applicationId: number; verifiedAt: string };
type Manifest = { version: 1; backups: Record<string, ManifestRecord> };
let timer: NodeJS.Timeout | undefined;
let running: Promise<BackupInfo> | null = null;

const readManifest = (): Manifest => {
  try {
    const value = JSON.parse(readFileSync(join(BACKUP_DIR, MANIFEST_NAME), 'utf8')) as Manifest;
    return value.version === 1 && value.backups && typeof value.backups === 'object' ? value : { version: 1, backups: {} };
  } catch { return { version: 1, backups: {} }; }
};
const writeManifest = (manifest: Manifest) => {
  const temporary = join(BACKUP_DIR, `${MANIFEST_NAME}.partial`);
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, join(BACKUP_DIR, MANIFEST_NAME));
};
const sidecarPath = (name: string) => join(BACKUP_DIR, `${name}.manifest.json`);
const writeSidecar = (name: string, record: ManifestRecord) => {
  const path = sidecarPath(name);
  const temporary = `${path}.partial`;
  writeFileSync(temporary, `${JSON.stringify({ version: 1, name, ...record }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
  renameSync(temporary, path);
};
const readSidecar = (name: string): ManifestRecord | null => {
  try {
    const value = JSON.parse(readFileSync(sidecarPath(name), 'utf8')) as ManifestRecord & { version: number; name: string };
    return value.version === 1 && value.name === name && typeof value.sha256 === 'string' ? value : null;
  } catch { return null; }
};

const list = (): BackupInfo[] => {
  const manifest = readManifest();
  return readdirSync(BACKUP_DIR)
  .filter((name) => BACKUP_NAME.test(name))
  .flatMap((name): BackupInfo[] => {
    const path = join(BACKUP_DIR, name);
    const stats = lstatSync(path);
    if (!stats.isFile() || stats.isSymbolicLink()) return [];
    const record = manifest.backups[name];
    return [{
      name,
      bytes: stats.size,
      createdAt: record?.createdAt ?? stats.mtime.toISOString(),
      sha256: record?.sha256,
      verifiedAt: record?.verifiedAt,
      verified: Boolean(record && record.bytes === stats.size),
    }];
  })
  .sort((a, b) => b.name.localeCompare(a.name));
};

export function listBackups(): BackupInfo[] {
  try { return list(); } catch { return []; }
}

function pruneBackups(): void {
  const manifest = readManifest();
  let changed = false;
  const cutoff = Date.now() - BACKUP_RETENTION_DAYS * 86_400_000;
  for (const [index, backup] of listBackups().entries()) {
    if (index < BACKUP_MAX_FILES && Date.parse(backup.createdAt) >= cutoff) continue;
    try {
      rmSync(join(BACKUP_DIR, backup.name), { force: true });
      rmSync(sidecarPath(backup.name), { force: true });
      delete manifest.backups[backup.name]; changed = true;
    }
    catch (error) { logger.warn('Could not prune database backup', { name: backup.name, error: String(error) }); }
  }
  if (changed) writeManifest(manifest);
}

export async function createBackup(reason: 'automatic' | 'startup' | 'manual'): Promise<BackupInfo> {
  if (running) return running;
  running = (async () => {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '');
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8);
    const name = `minicity-${timestamp}-${suffix}.sqlite`;
    const destination = join(BACKUP_DIR, name);
    const temporary = `${destination}.partial`;
    try {
      await backupDatabase(temporary);
      const verification = await verifyBackup(temporary);
      if (verification.integrity !== 'ok' || verification.foreignKeyErrors) throw new Error(`Backup verification failed (${verification.integrity}, ${verification.foreignKeyErrors} foreign key errors)`);
      chmodSync(temporary, 0o600);
      renameSync(temporary, destination);
      const stats = statSync(destination);
      const backup: BackupInfo = { name, bytes: stats.size, createdAt: new Date().toISOString(), sha256: verification.sha256, verifiedAt: new Date().toISOString(), verified: true };
      const manifest = readManifest();
      const record: ManifestRecord = {
        bytes: backup.bytes, createdAt: backup.createdAt, sha256: verification.sha256,
        userVersion: verification.userVersion, applicationId: verification.applicationId,
        verifiedAt: backup.verifiedAt!,
      };
      writeSidecar(name, record);
      manifest.backups[name] = record;
      writeManifest(manifest);
      logger.info('Database backup created', { reason, name, bytes: backup.bytes, sha256: backup.sha256 });
      pruneBackups();
      return backup;
    } catch (error) {
      try { rmSync(temporary, { force: true }); } catch { /* ignore an incomplete backup */ }
      try { rmSync(destination, { force: true }); } catch { /* ignore an unverified backup */ }
      try { rmSync(sidecarPath(name), { force: true }); } catch { /* ignore incomplete metadata */ }
      try { rmSync(`${sidecarPath(name)}.partial`, { force: true }); } catch { /* ignore incomplete metadata */ }
      throw error;
    }
  })().finally(() => { running = null; });
  return running;
}

export async function verifyStoredBackup(name: string): Promise<BackupInfo> {
  if (!BACKUP_NAME.test(basename(name)) || basename(name) !== name) throw new Error('Backup was not found');
  const path = join(BACKUP_DIR, name);
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('Backup was not found');
  const verification = await verifyBackup(path);
  if (verification.integrity !== 'ok' || verification.foreignKeyErrors) {
    throw new Error(`Backup verification failed (${verification.integrity}, ${verification.foreignKeyErrors} foreign key errors)`);
  }
  const manifest = readManifest();
  const existing = manifest.backups[name];
  if (existing?.sha256 && existing.sha256 !== verification.sha256) throw new Error('Backup checksum does not match its manifest');
  const sidecar = readSidecar(name);
  if (sidecar?.sha256 && sidecar.sha256 !== verification.sha256) throw new Error('Backup checksum does not match its immutable sidecar');
  const verifiedAt = new Date().toISOString();
  const createdAt = existing?.createdAt ?? sidecar?.createdAt ?? stats.mtime.toISOString();
  const record: ManifestRecord = {
    bytes: stats.size, createdAt, sha256: verification.sha256,
    userVersion: verification.userVersion, applicationId: verification.applicationId, verifiedAt,
  };
  if (!sidecar) writeSidecar(name, record);
  manifest.backups[name] = record;
  writeManifest(manifest);
  return { name, bytes: stats.size, createdAt, sha256: verification.sha256, verifiedAt, verified: true };
}

export function startAutomaticBackups(): void {
  if (!AUTO_BACKUP_ENABLED || timer) return;
  const run = (reason: 'automatic' | 'startup') => void createBackup(reason).catch((error) => logger.error('Database backup failed', { reason, error: String(error) }));
  if (BACKUP_ON_START) run('startup');
  timer = setInterval(() => run('automatic'), BACKUP_INTERVAL_MINUTES * 60_000);
  timer.unref();
  logger.info('Automatic database backups enabled', { intervalMinutes: BACKUP_INTERVAL_MINUTES, retentionDays: BACKUP_RETENTION_DAYS, maximumFiles: BACKUP_MAX_FILES });
}

export function stopAutomaticBackups(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}

export async function waitForBackup(): Promise<void> {
  if (running) await running;
}

export function streamBackup(name: string, response: ServerResponse): boolean {
  if (!BACKUP_NAME.test(basename(name)) || basename(name) !== name) return false;
  const path = join(BACKUP_DIR, name);
  let stats;
  try { stats = lstatSync(path); if (!stats.isFile() || stats.isSymbolicLink()) return false; } catch { return false; }
  response.writeHead(200, {
    'content-type': 'application/vnd.sqlite3', 'content-length': stats.size,
    'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(path).pipe(response);
  return true;
}
