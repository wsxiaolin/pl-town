import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import WebSocket from 'ws';

const port = 8792;
const physicsLabPort = 8794;
const dataDir = mkdtempSync(join(tmpdir(), 'minicity-restore-'));
const serverDir = new URL('..', import.meta.url);
const origin = `http://127.0.0.1:${port}`;
const environment = {
  ...process.env, PORT: String(port), DATA_DIR: dataDir,
  ADMIN_USERNAME: 'operator', ADMIN_PASSWORD: 'restore-admin-password',
  AUTO_BACKUP_ENABLED: 'false', ALLOWED_ORIGINS: origin,
  PHYSICS_LAB_API_BASE: `http://127.0.0.1:${physicsLabPort}`,
};

const physicsLabServer = createServer(async (request, response) => {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw || '{}');
  response.writeHead(200, { 'content-type': 'application/json' });
  if (request.url === '/Users/Authenticate') {
    response.end(JSON.stringify({ Status: 200, AuthCode: 'restore-auth-code', Token: 'restore-token' }));
    return;
  }
  if (request.url === '/Users/GetUser') {
    // Deliberately reports every nickname as unknown: the restore flow
    // authenticates with a stored token, which skips Physics Lab ownership
    // verification entirely. The existing-user path is covered in
    // integration.mjs, which stubs both known and unknown names.
    response.end(JSON.stringify({ Status: 404, Message: 'Standard.404', Data: null }));
    return;
  }
  response.end(JSON.stringify({ Status: 404, Message: `Unexpected request: ${body}` }));
});

const startPhysicsLabStub = () => new Promise((resolve, reject) => {
  physicsLabServer.once('error', reject);
  physicsLabServer.listen(physicsLabPort, '127.0.0.1', resolve);
});

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
  const timeout = setTimeout(() => {
    socket.terminate();
    reject(new Error('Restore test WebSocket connection timed out'));
  }, 5_000);
  socket.once('error', (error) => {
    clearTimeout(timeout);
    reject(error);
  });
  socket.once('open', () => socket.send(JSON.stringify({ type: 'hello', nickname: 'RestoreAlice', password: 'resident-secret' })));
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    if (message.type === 'hello') {
      clearTimeout(timeout);
      resolve({ socket, hello: message });
    }
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
  await startPhysicsLabStub();
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

  // Schema 5 also predates world_config. Exercise the real offline CLI against
  // that backup shape: importing db.ts first would create the missing table and
  // hide migration failures before any replacement has taken place.
  const legacyName = 'minicity-20260101T000000.000Z-1234abcd.sqlite';
  const legacyPath = join(backupDirectory, legacyName);
  copyFileSync(join(backupDirectory, backup.name), legacyPath);
  const legacy = new Database(legacyPath);
  legacy.pragma('foreign_keys = OFF');
  for (const table of ['city_operations', 'city_decorations', 'city_projects', 'city_meta', 'city_configs', 'world_config']) {
    legacy.exec(`DROP TABLE ${table}`);
  }
  const legacyUser = legacy.prepare('SELECT id, token_hash FROM users WHERE nickname = ?').get('RestoreAlice');
  legacy.prepare('UPDATE player_progress SET currency = 4321 WHERE user_id = ?').run(legacyUser.id);
  legacy.prepare('INSERT OR IGNORE INTO player_building_unlocks (user_id, building_id, unlocked_at) VALUES (?, ?, ?)')
    .run(legacyUser.id, 'academy', new Date().toISOString());
  legacy.pragma('user_version = 5');
  const applicationId = legacy.pragma('application_id', { simple: true });
  legacy.pragma('journal_mode = DELETE');
  legacy.close();
  const legacySha256 = createHash('sha256').update(readFileSync(legacyPath)).digest('hex');
  writeFileSync(`${legacyPath}.manifest.json`, JSON.stringify({
    version: 1, name: legacyName, sha256: legacySha256,
    bytes: statSync(legacyPath).size, userVersion: 5, applicationId,
  }));
  const legacyRestore = spawnSync(process.execPath, ['dist/restoreBackup.js', legacyName, legacySha256, '--confirm'], {
    cwd: serverDir, env: environment, encoding: 'utf8', timeout: 30_000,
  });
  assert.equal(legacyRestore.status, 0, `Schema 5 offline restore failed: ${legacyRestore.stderr || legacyRestore.stdout}`);
  const restoredLegacy = new Database(databasePath, { readonly: true });
  assert.equal(restoredLegacy.prepare('SELECT currency FROM player_progress WHERE user_id = ?').get(legacyUser.id).currency, 4321);
  assert.notEqual(restoredLegacy.prepare('SELECT token_hash FROM users WHERE id = ?').get(legacyUser.id).token_hash, legacyUser.token_hash);
  for (const id of ['build-library', 'build-academy', 'build-photostudio']) {
    const project = restoredLegacy.prepare('SELECT funded, built, definition_json FROM city_projects WHERE id = ?').get(id);
    assert.equal(project.built, 1);
    assert.equal(project.funded, JSON.parse(project.definition_json).cost);
  }
  assert.equal(restoredLegacy.prepare("SELECT built FROM city_projects WHERE id = 'build-shrine'").get().built, 0);
  assert.equal(restoredLegacy.prepare('SELECT COUNT(*) AS n FROM city_operations').get().n, 0);
  assert.equal(restoredLegacy.pragma('foreign_key_check').length, 0);
  restoredLegacy.close();
  running = startServer();
  await running.ready;
  await stopServer(running.processHandle);
  running = undefined;
  const restarted = new Database(databasePath, { readonly: true });
  assert.equal(restarted.prepare("SELECT built FROM city_projects WHERE id = 'build-shrine'").get().built, 0);
  assert.equal(restarted.prepare('SELECT currency FROM player_progress WHERE user_id = ?').get(legacyUser.id).currency, 4321);
  restarted.close();

  console.log('Restore passed: live lock refusal, verified offline replacement, rollback snapshot, session revocation, and legacy schema 5 migration');
} finally {
  resident?.socket.close();
  if (running) await stopServer(running.processHandle);
  physicsLabServer.close();
  rmSync(dataDir, { recursive: true, force: true });
}
