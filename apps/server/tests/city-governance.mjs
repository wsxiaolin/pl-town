import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import Database from 'better-sqlite3';
import WebSocket from 'ws';

const dataDir = mkdtempSync(join(tmpdir(), 'minicity-city-'));
const env = { ...process.env, NODE_ENV: 'test', DATA_DIR: dataDir, LOG_DIR: join(dataDir, 'logs'), BACKUP_DIR: join(dataDir, 'backups'), HOST: '127.0.0.1', PORT: '8787', ALLOW_ORIGINLESS_WEBSOCKET: 'true', AUTO_BACKUP_ENABLED: 'false', BACKUP_ON_START: 'false', BIGMODEL_API_KEY: '', OSS_ENABLED: 'false', ALLOWED_ORIGINS: 'https://city.example.test', ADMIN_USERNAME: '', ADMIN_PASSWORD: '', ADMIN_ACCOUNTS_JSON: '' };
const cwd = new URL('..', import.meta.url);
function fixture(code) {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, env, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
fixture(`
  const { db, createUser, getPlayerProgress, closeDatabase } = await import('./dist/db.js');
  const { tokenHash } = await import('./dist/auth.js');
  for (const [id, token] of [['11111111-1111-4111-8111-111111111111','city-token-a'],['22222222-2222-4222-8222-222222222222','city-token-b']]) {
    createUser(id, tokenHash(token), id, 'unused', '2099-01-01T00:00:00.000Z');
    getPlayerProgress(id);
    db.prepare('UPDATE player_progress SET currency = 10000 WHERE user_id = ?').run(id);
  }
  closeDatabase();
`);
let server;
let base;
let logs = '';
let configVersion;
const sockets = [];
async function start() {
  // Reserve a port for this isolated integration suite, independently of the
  // existing integration and Physics Lab stub ports.
  const { createServer } = await import('node:net');
  const reservation = createServer();
  reservation.listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['dist/index.js'], { cwd, env: { ...env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (chunk) => { logs += chunk; });
  server.stderr.on('data', (chunk) => { logs += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(500) })).ok) return; } catch { /* wait for listener */ }
    if (server.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Server failed to start: ${logs}`);
}
async function stop() {
  for (const socket of sockets.splice(0)) socket.terminate();
  if (server && server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill('SIGTERM');
    const timeout = setTimeout(() => server.kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(timeout);
  }
}
async function resident(token) {
  const socket = new WebSocket(base.replace('http:', 'ws:'));
  sockets.push(socket);
  const messages = [];
  socket.on('message', (raw) => messages.push(JSON.parse(raw)));
  await once(socket, 'open', { signal: AbortSignal.timeout(5000) });
  socket.send(JSON.stringify({ type: 'hello', token }));
  const wait = async (predicate) => {
    for (let i = 0; i < 100; i++) {
      const message = messages.find(predicate);
      if (message) return message;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error(`Missing WS message: ${JSON.stringify(messages)}`);
  };
  await wait((message) => message.type === 'hello');
  await wait((message) => message.type === 'city.updated');
  return { socket, messages, wait };
}
async function post(path, body, status = 200) {
  const response = await fetch(`${base}/town-api/city/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ configVersion, ...body }), signal: AbortSignal.timeout(5000) });
  const result = await response.json();
  assert.equal(response.status, status, JSON.stringify(result));
  return result;
}
async function competingDecoration(body) {
  const response = await fetch(`${base}/town-api/city/decorate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ configVersion, ...body }), signal: AbortSignal.timeout(5000) });
  return { status: response.status, body: await response.json() };
}
try {
  await start();
  const response = await fetch(`${base}/town-api/city/config`);
  const config = await response.json();
  configVersion = config.version;
  assert.equal(config.schemaVersion, 1);
  assert.ok(response.headers.get('etag'));
  assert.equal((await fetch(`${base}/town-api/city/config`, { headers: { 'if-none-match': response.headers.get('etag') } })).status, 304);
  const weak = await fetch(`${base}/town-api/city/config?check=1`, { headers: { 'if-none-match': `"other", W/${response.headers.get('etag')}`, origin: 'https://city.example.test' } });
  assert.equal(weak.status, 304);
  assert.equal(await weak.text(), '');
  assert.equal(weak.headers.get('etag'), response.headers.get('etag'));
  assert.equal(weak.headers.get('access-control-expose-headers'), 'ETag');
  assert.equal((await fetch(`${base}/town-api/city/config`, { headers: { 'if-none-match': '*' } })).status, 304);
  assert.equal((await fetch(`${base}/town-api/city/config`, { headers: { 'if-none-match': '"old"' } })).status, 200);
  for (const id of ['techhalf', 'blackhole', 'library', 'lab', 'commons', 'commons_outer', 'school_east', 'archive', 'guesthouse', 'writingclub_outer']) assert.ok(config.initialBuiltBuildingIds.includes(id));
  const project = config.projects.find((entry) => entry.buildingId === 'catcafe');
  const a = await resident('city-token-a');
  const b = await resident('city-token-b');
  const hello = a.messages.find((entry) => entry.type === 'hello');
  assert.equal(hello.catalog.buildingUnlockable.catcafe, false);
  a.socket.send(JSON.stringify({ type: 'progress.building.unlock', buildingId: 'catcafe' }));
  await a.wait((entry) => entry.type === 'error');
  const donation = { token: 'city-token-a', requestId: 'first', projectId: project.id, amount: 100 };
  const first = await post('donate', donation);
  assert.equal(first.progress.currency, 9900);
  assert.equal(first.acceptedAmount, 100);
  await b.wait((entry) => entry.type === 'city.updated' && entry.state.revision === first.state.revision);
  await a.wait((entry) => entry.type === 'progress.updated' && entry.progress.currency === 9900);
  const repeated = await post('donate', donation);
  assert.equal(repeated.replayed, true);
  assert.equal(repeated.state.revision, first.state.revision);
  assert.equal(repeated.progress.currency, 9900);
  assert.equal(repeated.operationRevision, first.state.revision);
  assert.equal(repeated.requestId, donation.requestId);
  await a.wait((entry) => entry.event?.type === 'city.committed' && entry.event.requestId === 'first' && entry.event.replayed === true);
  assert.equal(a.messages.filter((entry) => entry.type === 'city.updated' && entry.state.revision === first.state.revision).length, 1);
  await post('donate', { ...donation, amount: 101 }, 409);
  for (const amount of [0, -1, 1.5, '100', Number.MAX_SAFE_INTEGER + 1, null]) await post('donate', { ...donation, requestId: 'invalid', amount }, 400);
  await post('donate', { ...donation, token: 'invalid' }, 401);
  await post('donate', { ...donation, requestId: 'missing', projectId: 'missing' }, 404);
  const finish = await post('donate', { ...donation, requestId: 'finish', amount: 10000 });
  assert.equal(finish.acceptedAmount, project.cost - 100);
  assert.equal(finish.progress.currency, 10000 - project.cost);
  assert.equal(finish.state.projects.find((entry) => entry.id === project.id).built, true);
  await b.wait((entry) => entry.type === 'world.catalog' && entry.catalog.buildingUnlockable.catcafe === true);
  await post('donate', { ...donation, requestId: 'finished' }, 409);
  // Reset rate windows before the next independent group of scenarios.
  await stop();
  await start();
  const plot = config.personalPlots[0];
  const decorate = { token: 'city-token-a', requestId: 'plot', plotId: plot.id, decorationId: plot.options[0] };
  await post('decorate', { ...decorate, decorationId: 'pine' }, 400);
  const decorated = await post('decorate', decorate);
  assert.equal(decorated.state.decorations[0].ownerId, hello.user.id);
  assert.equal((await post('decorate', decorate)).replayed, true);
  await post('decorate', { ...decorate, token: 'city-token-b' }, 409);
  await post('decorate', { ...decorate, requestId: 'first' }, 409);
  const raceProject = config.projects.find((entry) => entry.kind === 'lights');
  const race = { ...donation, requestId: 'race', projectId: raceProject.id, amount: 1 };
  const results = await Promise.all([post('donate', race), post('donate', race)]);
  assert.equal(results.filter((entry) => entry.replayed).length, 1);
  await post('donate', { ...race, requestId: 'stale', configVersion: 'old' }, 409);
  await post('donate', { ...race, requestId: 'no-version', configVersion: null }, 400);
  const finalPayments = await Promise.all([
    post('donate', { ...race, requestId: 'last-a', amount: raceProject.cost - 2 }),
    post('donate', { ...race, token: 'city-token-b', requestId: 'last-b', amount: raceProject.cost - 2 }),
  ]);
  assert.equal(finalPayments.reduce((sum, entry) => sum + entry.acceptedAmount, 0), raceProject.cost - 1);
  assert.ok(finalPayments.some((entry) => entry.acceptedAmount === 1));
  const joined = await resident('city-token-b');
  assert.ok(joined.messages.find((entry) => entry.type === 'hello').catalog.globallyUnlockedBuildings.includes('catcafe'));
  joined.socket.send(JSON.stringify({ type: 'progress.building.visit', buildingId: 'catcafe' }));
  await joined.wait((entry) => entry.event?.type === 'building.visited' && entry.event.buildingId === 'catcafe');
  const replayLatest = await post('donate', donation);
  assert.equal(replayLatest.operationRevision, first.operationRevision);
  assert.ok(replayLatest.state.revision > first.operationRevision);
  assert.equal(replayLatest.replayed, true);
  const competitors = await Promise.all(['city-token-a', 'city-token-b'].map((token) => competingDecoration({ token, requestId: 'plot-race', plotId: config.personalPlots[2].id, decorationId: 'flowers' })));
  assert.deepEqual(competitors.map((entry) => entry.status).sort(), [200, 409]);
  assert.equal(competitors.find((entry) => entry.status === 200).body.acceptedAmount, 80);
  const beforeRestart = await (await fetch(`${base}/town-api/city/state`)).json();
  await stop();
  await start();
  assert.deepEqual(await (await fetch(`${base}/town-api/city/state`)).json(), beforeRestart);
  assert.equal((await post('donate', donation)).replayed, true);
  for (let i = 0; i < 19; i++) await post('donate', donation);
  await post('donate', donation, 429);
  await stop();
  fixture(`
    const assert = (await import('node:assert/strict')).default;
    const { db, getUser, purchaseBuilding, recordBuildingVisit, purchaseItem, backupDatabase, restoreFromBackupFile, closeDatabase } = await import('./dist/db.js');
    const { mutateCity, getCityState } = await import('./dist/cityGovernance.js');
    const { CITY_CONSTRUCTION_CONFIG: config } = await import('./dist/data/cityConstructionConfig.js');
    const user = getUser('11111111-1111-4111-8111-111111111111');
    db.prepare('UPDATE player_progress SET currency = 0 WHERE user_id = ?').run(user.id);
    const before = getCityState();
    assert.throws(() => mutateCity(user, 'donate', { configVersion: config.version, requestId: 'poor', projectId: 'greenbelt-trees', amount: 1 }), /Insufficient/);
    assert.deepEqual(getCityState(), before);
    assert.throws(() => mutateCity(user, 'decorate', { configVersion: config.version, requestId: 'poor-plot', plotId: config.personalPlots[1].id, decorationId: 'oak' }), /Insufficient/);
    assert.deepEqual(getCityState(), before);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM city_operations WHERE request_id IN ('poor', 'poor-plot')").get().n, 0);
    assert.throws(() => purchaseBuilding(user.id, 'academy', 0), /not built/);
    assert.throws(() => recordBuildingVisit(user.id, 'academy'), /not built/);
    const { setBuildingOverrides, resetWorldConfig } = await import('./dist/worldConfig.js');
    const { isBuildingUnlockable, isBuildingGloballyUnlocked, getProgressionCatalog } = await import('./dist/progression.js');
    setBuildingOverrides({ academy: 'open', catcafe: 'locked' });
    assert.equal(isBuildingUnlockable('academy'), false);
    assert.equal(isBuildingGloballyUnlocked('academy'), false);
    assert.equal(isBuildingGloballyUnlocked('catcafe'), false);
    assert.equal(getProgressionCatalog().buildingUnlockable.catcafe, false);
    setBuildingOverrides({});
    assert.equal(isBuildingGloballyUnlocked('catcafe'), true);
    assert.equal(isBuildingUnlockable('litreview'), false);
    const operationsBefore = db.prepare('SELECT COUNT(*) AS n FROM city_operations').get().n;
    const path = ${JSON.stringify(join(dataDir, 'city-backup.sqlite'))};
    await backupDatabase(path);
    db.prepare('UPDATE city_projects SET funded = 2 WHERE id = ?').run('greenbelt-trees');
    restoreFromBackupFile(path);
    const restored = getCityState();
    assert.notEqual(restored.epoch, before.epoch);
    assert.deepEqual({ ...restored, epoch: before.epoch }, before);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM city_operations').get().n, operationsBefore);
    assert.equal(db.prepare('SELECT session_expires_at FROM users WHERE id = ?').get(user.id).session_expires_at, null);
    const { initializeCityGovernance } = await import('./dist/cityGovernanceSchema.js');
    const stored = db.prepare('SELECT config_json FROM city_configs WHERE version = ?').get(config.version).config_json;
    db.prepare('UPDATE city_configs SET config_json = ? WHERE version = ?').run('{}', config.version);
    assert.throws(() => db.transaction(() => initializeCityGovernance(db))(), /version bump/);
    db.prepare('UPDATE city_configs SET config_json = ? WHERE version = ?').run(stored, config.version);
    // Failed restore must roll back every table and close its source handle.
    const Database = (await import('better-sqlite3')).default;
    const damagedPath = ${JSON.stringify(join(dataDir, 'city-damaged.sqlite'))};
    await backupDatabase(damagedPath);
    const damaged = new Database(damagedPath);
    damaged.prepare('UPDATE city_projects SET funded = 999999 WHERE id = ?').run('greenbelt-trees');
    damaged.close();
    const beforeFailure = getCityState();
    assert.throws(() => restoreFromBackupFile(damagedPath), /Invalid city project progress/);
    assert.deepEqual(getCityState(), beforeFailure);
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    const originalVersion = config.version;
    const originalCost = config.projects[0].cost;
    const originalPlotX = config.personalPlots[0].x;
    config.version = 'test-upgrade';
    config.projects[0].cost += 1;
    assert.throws(() => db.transaction(() => initializeCityGovernance(db))(), /City project changed/);
    config.projects[0].cost = originalCost;
    config.personalPlots[0].x += 0.1;
    assert.throws(() => db.transaction(() => initializeCityGovernance(db))(), /explicit reconciliation/);
    config.personalPlots[0].x = originalPlotX;
    config.version = originalVersion;
    // A pre-city backup seeds clean construction state and operations.
    const legacyPath = ${JSON.stringify(join(dataDir, 'city-legacy.sqlite'))};
    await backupDatabase(legacyPath);
    const legacy = new Database(legacyPath);
    legacy.pragma('foreign_keys = OFF');
    for (const table of ['city_operations', 'city_decorations', 'city_projects', 'city_meta', 'city_configs']) legacy.exec('DROP TABLE ' + table);
    legacy.pragma('user_version = 5');
    legacy.close();
    restoreFromBackupFile(legacyPath);
    resetWorldConfig();
    assert.equal(getCityState().revision, 0);
    assert.ok(getCityState().projects.every((project) => !project.built && project.funded === 0));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM city_operations').get().n, 0);
    db.prepare('UPDATE player_progress SET currency = 100 WHERE user_id = ?').run(user.id);
    const beforeAbort = getCityState();
    db.exec("CREATE TEMP TRIGGER city_operation_failure BEFORE INSERT ON city_operations WHEN NEW.request_id = 'abort' BEGIN SELECT RAISE(ABORT, 'operation failed'); END");
    assert.throws(() => mutateCity(user, 'donate', { configVersion: config.version, requestId: 'abort', projectId: 'greenbelt-trees', amount: 50 }), /operation failed/);
    assert.equal(db.prepare('SELECT currency FROM player_progress WHERE user_id = ?').get(user.id).currency, 100);
    assert.deepEqual(getCityState(), beforeAbort);
    // Shopping and donations share one balance, including rollback after stock writes.
    db.prepare('UPDATE player_progress SET currency = 100 WHERE user_id = ?').run(user.id);
    mutateCity(user, 'donate', { configVersion: config.version, requestId: 'balance', projectId: 'greenbelt-trees', amount: 80 });
    assert.throws(() => purchaseItem(user.id, 'dragonwell_tea', 1, 30), /Insufficient/);
    assert.equal(db.prepare('SELECT currency FROM player_progress WHERE user_id = ?').get(user.id).currency, 20);
    closeDatabase();
  `);
  const backup = new Database(join(dataDir, 'city-backup.sqlite'), { readonly: true });
  assert.equal(backup.pragma('user_version', { simple: true }), 6);
  assert.equal(backup.pragma('foreign_key_check').length, 0);
  backup.close();
  console.log('City governance integration passed');
} finally {
  await stop();
}
