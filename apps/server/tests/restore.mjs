import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import WebSocket from 'ws';

const port = 8792;
const dataDir = mkdtempSync(join(tmpdir(), 'minicity-restore-'));
const serverDir = new URL('..', import.meta.url);
const origin = `http://127.0.0.1:${port}`;
const environment = {
  ...process.env, PORT: String(port), DATA_DIR: dataDir,
  ADMIN_USERNAME: 'operator', ADMIN_PASSWORD: 'restore-admin-password',
  AUTO_BACKUP_ENABLED: 'false', ALLOWED_ORIGINS: origin,
};

const startServer = () => {
  const processHandle = spawn(process.execPath, ['dist/index.js'], {
    cwd: serverDir, env: environment, stdio: ['ignore', 'pipe', 'inherit'],
  });
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Restore test server did not start')), 5_000);
    processHandle.stdout.on('data', (chunk) => {
      if (!chunk.toString().includes('listening')) return;
      clearTimeout(timeout); resolve();
    });
    processHandle.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Restore test server exited early (${code})`)); });
  });
  return { processHandle, ready };
};

const stopServer = async (processHandle) => {
  if (processHandle.exitCode !== null) return;
  const exited = new Promise((resolve) => processHandle.once('exit', resolve));
  processHandle.kill('SIGTERM');
  await exited;
};

const connect = () => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.once('error', reject);
  socket.once('open', () => socket.send(JSON.stringify({ type: 'hello', nickname: 'RestoreAlice', password: 'resident-secret' })));
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    if (message.type === 'hello') resolve({ socket, hello: message });
  });
});

const adminSession = async () => {
  const response = await fetch(`${origin}/admin/api/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ username: 'operator', password: 'restore-admin-password' }),
  });
  const payload = await response.json();
  const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
  if (!response.ok || !cookie || !payload.csrf) throw new Error('Restore test admin sign-in failed');
  return { cookie, csrf: payload.csrf };
};

let running;
let resident;
try {
  running = startServer();
  await running.ready;
  resident = await connect();
  const admin = await adminSession();
  const backupResponse = await fetch(`${origin}/admin/api/backups`, {
    method: 'POST', headers: { cookie: admin.cookie, origin, 'x-csrf-token': admin.csrf },
  });
  const backup = (await backupResponse.json()).backup;
  if (!backupResponse.ok || !backup?.name || !backup?.sha256) throw new Error('Restore test could not create a backup');

  const lockedRestore = spawnSync(process.execPath, ['dist/restoreBackup.js', backup.name, backup.sha256, '--confirm'], {
    cwd: serverDir, env: environment, encoding: 'utf8', timeout: 10_000,
  });
  if (lockedRestore.status === 0 || !`${lockedRestore.stdout}${lockedRestore.stderr}`.includes('is using this data directory')) {
    throw new Error('Restore must refuse to run while the server owns the data directory');
  }

  resident.socket.close();
  await stopServer(running.processHandle);
  running = undefined;

  const databasePath = join(dataDir, 'minicity.sqlite');
  const before = new Database(databasePath);
  const original = before.prepare('SELECT token_hash FROM users WHERE nickname = ?').get('RestoreAlice');
  before.prepare('UPDATE users SET nickname = ? WHERE nickname = ?').run('ChangedAfterBackup', 'RestoreAlice');
  before.close();

  const restored = spawnSync(process.execPath, ['dist/restoreBackup.js', backup.name, backup.sha256, '--confirm'], {
    cwd: serverDir, env: environment, encoding: 'utf8', timeout: 30_000,
  });
  if (restored.status !== 0) throw new Error(`Offline restore failed: ${restored.stderr || restored.stdout}`);

  const after = new Database(databasePath, { readonly: true });
  const row = after.prepare('SELECT nickname, token_hash, session_expires_at FROM users').get();
  after.close();
  if (row.nickname !== 'RestoreAlice') throw new Error('Restore did not replace post-backup database changes');
  if (row.session_expires_at !== null || row.token_hash === original.token_hash) throw new Error('Restore must revoke every resident session');
  const backupDirectory = join(dataDir, 'backups');
  const backupFiles = readdirSync(backupDirectory).filter((name) => name.endsWith('.sqlite'));
  if (backupFiles.length < 2 || backupFiles.some((name) => !existsSync(join(backupDirectory, `${name}.manifest.json`)))) {
    throw new Error('Original and pre-restore backups must both include immutable checksum sidecars');
  }

  console.log('Restore passed: live lock refusal, verified offline replacement, rollback snapshot, and session revocation');
} finally {
  resident?.socket.close();
  if (running) await stopServer(running.processHandle);
  rmSync(dataDir, { recursive: true, force: true });
}
