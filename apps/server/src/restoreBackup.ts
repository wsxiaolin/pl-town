import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { MINICITY_APPLICATION_ID, MINICITY_SCHEMA_VERSION } from './databaseMetadata.js';
import { acquireRuntimeLock, releaseRuntimeLock } from './runtimeLock.js';

type Verification = { sha256: string; bytes: number; userVersion: number; applicationId: number };
type Manifest = { version: 1; backups: Record<string, { bytes: number; createdAt: string; sha256: string; userVersion: number; applicationId: number; verifiedAt: string }> };
const BACKUP_NAME = /^minicity-(\d{8}T\d{6}\.\d{3}Z)-([a-f0-9]{8})\.sqlite$/;
const SHA256 = /^[a-f0-9]{64}$/i;

const hashFile = (path: string): Promise<string> => new Promise((resolveHash, reject) => {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.once('error', reject);
  stream.once('end', () => resolveHash(hash.digest('hex')));
});

async function verify(path: string): Promise<Verification> {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error('Backup must be a regular file');
  const database = new Database(path, { readonly: true, fileMustExist: true });
  let integrity: string;
  let foreignKeyErrors: number;
  let userVersion: number;
  let applicationId: number;
  try {
    integrity = String(database.pragma('integrity_check', { simple: true }));
    foreignKeyErrors = (database.pragma('foreign_key_check') as unknown[]).length;
    userVersion = Number(database.pragma('user_version', { simple: true })) || 0;
    applicationId = Number(database.pragma('application_id', { simple: true })) || 0;
  } finally { database.close(); }
  if (integrity !== 'ok' || foreignKeyErrors) throw new Error(`Database verification failed (${integrity}, ${foreignKeyErrors} foreign key errors)`);
  if (applicationId !== MINICITY_APPLICATION_ID) throw new Error('Backup is not a MiniCity database');
  if (userVersion > MINICITY_SCHEMA_VERSION) throw new Error(`Backup schema ${userVersion} is newer than this server supports`);
  return { sha256: await hashFile(path), bytes: stats.size, userVersion, applicationId };
}

const readManifest = (backupDirectory: string): Manifest => {
  try {
    const value = JSON.parse(readFileSync(join(backupDirectory, 'manifest.json'), 'utf8')) as Manifest;
    if (value.version === 1 && value.backups && typeof value.backups === 'object') return value;
  } catch { /* start a new manifest */ }
  return { version: 1, backups: {} };
};

const readSidecar = (backupDirectory: string, name: string): (Verification & { name: string }) | null => {
  const path = join(backupDirectory, `${name}.manifest.json`);
  if (!existsSync(path)) return null;
  const value = JSON.parse(readFileSync(path, 'utf8')) as Verification & { version: number; name: string };
  if (value.version !== 1 || value.name !== name || !SHA256.test(value.sha256)) throw new Error('Backup sidecar is invalid');
  return value;
};

const writeManifest = (backupDirectory: string, manifest: Manifest): void => {
  const temporary = join(backupDirectory, 'manifest.json.restore-partial');
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, join(backupDirectory, 'manifest.json'));
};

async function main(): Promise<void> {
  const [name, expectedSha256, confirmation] = process.argv.slice(2);
  if (!name || basename(name) !== name || !BACKUP_NAME.test(name) || !expectedSha256 || !SHA256.test(expectedSha256) || confirmation !== '--confirm') {
    throw new Error('Usage: npm run db:restore -- <backup-file> <expected-sha256> --confirm');
  }
  const dataDirectory = resolve(process.env.DATA_DIR ?? 'data');
  const backupDirectory = resolve(process.env.BACKUP_DIR ?? join(dataDirectory, 'backups'));
  const databasePath = join(dataDirectory, 'minicity.sqlite');
  const candidatePath = join(backupDirectory, name);
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  acquireRuntimeLock(dataDirectory, 'restore');
  try {
    if (!existsSync(databasePath)) throw new Error('Current MiniCity database was not found');
    for (const suffix of ['-wal', '-shm']) {
      if (existsSync(`${databasePath}${suffix}`)) throw new Error(`Refusing restore while ${basename(databasePath)}${suffix} exists; stop the server cleanly first`);
    }
    const candidate = await verify(candidatePath);
    if (candidate.sha256.toLowerCase() !== expectedSha256.toLowerCase()) throw new Error('Expected SHA-256 does not match the selected backup');
    const manifest = readManifest(backupDirectory);
    if (manifest.backups[name]?.sha256 && manifest.backups[name]!.sha256 !== candidate.sha256) throw new Error('Backup checksum does not match its manifest');
    const sidecar = readSidecar(backupDirectory, name);
    if (sidecar && (sidecar.sha256 !== candidate.sha256 || sidecar.bytes !== candidate.bytes
      || sidecar.userVersion !== candidate.userVersion || sidecar.applicationId !== candidate.applicationId)) {
      throw new Error('Backup does not match its immutable sidecar');
    }

    const timestamp = new Date().toISOString().replace(/[-:]/g, '');
    const preRestoreName = `minicity-${timestamp}-${randomUUID().replaceAll('-', '').slice(0, 8)}.sqlite`;
    const preRestorePartial = join(backupDirectory, `${preRestoreName}.partial`);
    const preRestorePath = join(backupDirectory, preRestoreName);
    const sidecarPath = join(backupDirectory, `${preRestoreName}.manifest.json`);
    const sidecarPartial = `${sidecarPath}.partial`;
    try {
      const current = new Database(databasePath, { fileMustExist: true });
      try { await current.backup(preRestorePartial); }
      finally { current.close(); }
      const preRestore = await verify(preRestorePartial);
      renameSync(preRestorePartial, preRestorePath);
      const verifiedAt = new Date().toISOString();
      const preRestoreRecord = { ...preRestore, createdAt: verifiedAt, verifiedAt };
      writeFileSync(sidecarPartial, `${JSON.stringify({ version: 1, name: preRestoreName, ...preRestoreRecord }, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      renameSync(sidecarPartial, sidecarPath);
      manifest.backups[preRestoreName] = preRestoreRecord;
      writeManifest(backupDirectory, manifest);
    } catch (error) {
      rmSync(preRestorePartial, { force: true });
      rmSync(preRestorePath, { force: true });
      rmSync(sidecarPartial, { force: true });
      rmSync(sidecarPath, { force: true });
      throw error;
    }

    const stagedPath = join(dataDirectory, `.minicity-restore-${randomUUID()}.sqlite`);
    const rollbackPath = join(dataDirectory, `.minicity-rollback-${randomUUID()}.sqlite`);
    await copyFile(candidatePath, stagedPath);
    const staged = new Database(stagedPath, { fileMustExist: true });
    try {
      const timestamp = new Date().toISOString();
      staged.prepare("UPDATE users SET token_hash = lower(hex(randomblob(32))), session_expires_at = NULL, updated_at = ?").run(timestamp);
      staged.pragma('wal_checkpoint(TRUNCATE)');
      staged.pragma('journal_mode = DELETE');
    } finally { staged.close(); }
    await verify(stagedPath);

    renameSync(databasePath, rollbackPath);
    try {
      renameSync(stagedPath, databasePath);
      await verify(databasePath);
      rmSync(rollbackPath, { force: true });
    } catch (error) {
      if (existsSync(databasePath)) rmSync(databasePath, { force: true });
      renameSync(rollbackPath, databasePath);
      throw error;
    } finally { rmSync(stagedPath, { force: true }); }
    process.stdout.write(`Restore complete. All resident sessions were revoked. Pre-restore backup: ${preRestoreName}\n`);
  } finally { releaseRuntimeLock(); }
}

main().catch((error) => {
  process.stderr.write(`Restore failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
