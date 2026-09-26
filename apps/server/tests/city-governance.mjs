import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import Database from 'better-sqlite3';
import WebSocket from 'ws';
import { BUILDING_CATALOG } from '../dist/buildingCatalog.js';
import './city-area-layout.mjs';

const dataDir = mkdtempSync(join(tmpdir(), 'minicity-city-'));
const env = { ...process.env, NODE_ENV: 'test', DATA_DIR: dataDir, LOG_DIR: join(dataDir, 'logs'), BACKUP_DIR: join(dataDir, 'backups'), HOST: '127.0.0.1', PORT: '8787', ALLOW_ORIGINLESS_WEBSOCKET: 'true', AUTO_BACKUP_ENABLED: 'false', BACKUP_ON_START: 'false', BIGMODEL_API_KEY: '', OSS_ENABLED: 'false', ALLOWED_ORIGINS: 'https://city.example.test', ADMIN_USERNAME: '', ADMIN_PASSWORD: '', ADMIN_ACCOUNTS_JSON: '' };
const cwd = new URL('..', import.meta.url);
function fixture(code) {
  // Keep large migration fixtures off the command line for Windows hosts.
  const result = spawnSync(process.execPath, ['--input-type=module'], { cwd, env, input: code, encoding: 'utf8', timeout: 15000 });
  assert.ifError(result.error);
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
  for (let attempt = 0; attempt < 400; attempt++) {
    try { if ((await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(500) })).ok) return; } catch { /* wait for listener */ }
    if (server.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Server failed to start: ${logs}`);
}
async function stop() {
  for (const socket of sockets.splice(0)) socket.terminate();
  const child = server;
  server = undefined;
  // A signal-terminated child keeps exitCode=null. Repeated cleanup must not
  // wait for an exit event that has already fired (including on Windows).
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit');
    child.kill('SIGTERM');
    const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
    try { await exited; }
    finally { clearTimeout(timeout); }
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
  assert.deepEqual(config.initialBuiltBuildingIds, ['commons']);
  const freshState = await (await fetch(`${base}/town-api/city/state`)).json();
  assert.ok(freshState.projects.every((entry) => !entry.built && entry.funded === 0));
  // Typecheck verifies this generated catalog mirrors every client building,
  // including special interaction entrypoints. Every entry needs a city policy.
  for (const { id } of BUILDING_CATALOG) {
    assert.ok(config.initialBuiltBuildingIds.includes(id)
      || config.projects.some((entry) => entry.kind === 'building' && entry.buildingId === id),
    `Missing city construction policy for ${id}`);
  }
  // Story venues are intentionally gated by the Commons vote. This guard
  // keeps a future "only Commons starts built" change from orphaning their
  // entrypoints when a project is accidentally removed.
  for (const id of ['archive', 'newsstand', 'guesthouse', 'mall_south', 'mall_west', 'research']) {
    assert.equal(config.initialBuiltBuildingIds.includes(id), false);
    assert.ok(config.projects.some((entry) => entry.kind === 'building' && entry.buildingId === id));
  }
  for (const id of ['catcafe', 'school_north', 'teahouse', 'shrine', 'beacon', 'television_tower', 'fried_chicken_shop']) {
    assert.equal(config.initialBuiltBuildingIds.includes(id), false);
    assert.ok(config.projects.some((entry) => entry.buildingId === id));
  }
  assert.ok(config.projects.some((entry) => entry.id === 'east-gate-path' && entry.kind === 'road'));
  assert.ok(config.projects.some((entry) => entry.id === 'corner-trees-ne' && entry.kind === 'trees'));
  assert.ok(config.personalPlots.some((entry) => entry.id === 'residence-yard-1'));
  assert.ok(config.personalPlots.some((entry) => entry.id === 'residence-yard-2'));
  assert.equal(config.personalAreas.length, 4);
  assert.ok(config.personalAreas.every((area) => area.plotIds.length >= 20));
  assert.equal(new Set(config.personalAreas.flatMap((area) => area.plotIds)).size, 88);
  assert.equal(config.projects.find((entry) => entry.id === 'greenbelt-trees').placements.length, 2);
  for (const id of ['north-community-garden', 'south-community-grove']) assert.ok(config.projects.find((entry) => entry.id === id).placements.length >= 8);
  const project = config.projects.find((entry) => entry.buildingId === 'catcafe');
  const votingResident = await resident('city-token-a');
  const votingObserver = await resident('city-token-b');
  assert.equal((await fetch(`${base}/town-api/city/votes`)).status, 401);
  const vote = { token: 'city-token-a', requestId: 'vote-first', projectId: project.id };
  await post('vote', { ...vote, token: 'invalid' }, 401);
  await post('vote', { ...vote, requestId: '' }, 400);
  await post('vote', { ...vote, projectId: 'missing' }, 404);
  await post('vote', { ...vote, projectId: 'east-gate-path' }, 400);
  await post('vote', { ...vote, configVersion: 'old' }, 409);
  const voted = await post('vote', vote);
  assert.equal(voted.state.projects.find((entry) => entry.id === project.id).votes, 1);
  assert.equal(voted.state.projects.find((entry) => entry.id === project.id).funded, 0);
  assert.deepEqual(voted.votes.projectIds, [project.id]);
  await votingObserver.wait((entry) => entry.type === 'city.updated' && entry.state.revision === voted.state.revision);
  assert.equal(votingResident.messages.find((entry) => entry.type === 'hello').progress.currency, 10000);
  const repeatedVote = await post('vote', vote);
  assert.equal(repeatedVote.replayed, true);
  assert.equal(repeatedVote.operationRevision, voted.state.revision);
  assert.equal((await post('vote', { ...vote, requestId: 'another-click' })).state.revision, voted.state.revision);
  await post('vote', { ...vote, projectId: config.projects.find((entry) => entry.buildingId === 'shrine').id }, 409);
  const secondVote = await post('vote', { ...vote, token: 'city-token-b' });
  assert.equal(secondVote.state.projects.find((entry) => entry.id === project.id).votes, 2);
  const myVotesResponse = await fetch(`${base}/town-api/city/votes`, { headers: { authorization: 'Bearer city-token-a' } });
  assert.equal(myVotesResponse.headers.get('cache-control'), 'no-store');
  assert.deepEqual((await myVotesResponse.json()).projectIds, [project.id]);
  const anotherProject = config.projects.find((entry) => entry.buildingId === 'shrine');
  const concurrentVotes = await Promise.all(['vote-race-a', 'vote-race-b'].map((requestId) => post('vote', { ...vote, requestId, projectId: anotherProject.id })));
  assert.equal(concurrentVotes.filter((entry) => entry.replayed).length, 1);
  assert.equal(concurrentVotes[1].state.projects.find((entry) => entry.id === anotherProject.id).votes, 1);
  await stop();
  await start();
  assert.equal((await post('vote', vote)).replayed, true);
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
  // Replaying an existing vote remains safe even after construction completes.
  assert.equal((await post('vote', vote)).replayed, true);
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
  await stop();
  await start();
  const areaBody = { token: 'city-token-a', requestId: 'area-build', areaId: 'north-meadow', decorationId: 'flowers', quantity: 5 };
  for (const quantity of [0, -1, 1.5, '2', null, 101, Number.MAX_SAFE_INTEGER + 1]) await post('decorate', { ...areaBody, quantity }, 400);
  await post('decorate', { ...areaBody, areaId: 'missing' }, 404);
  await post('decorate', { ...areaBody, plotId: plot.id }, 400);
  await post('decorate', { ...areaBody, quantity: 21 }, 409);
  const areaBuilt = await post('decorate', areaBody);
  assert.equal(areaBuilt.acceptedAmount, 400);
  assert.equal(areaBuilt.state.decorations.filter((entry) => entry.plotId.startsWith('north-meadow-')).length, 5);
  const areaReplay = await post('decorate', areaBody);
  assert.equal(areaReplay.replayed, true);
  assert.equal(areaReplay.state.revision, areaBuilt.state.revision);
  assert.equal(areaReplay.progress.currency, areaBuilt.progress.currency);
  await post('decorate', { ...areaBody, quantity: 4 }, 409);
  const areaCompetitors = await Promise.all(['city-token-a', 'city-token-b'].map((token) => competingDecoration({ token, requestId: 'area-race', areaId: 'east-park', decorationId: 'flowers', quantity: 24 })));
  assert.deepEqual(areaCompetitors.map((entry) => entry.status).sort(), [200, 409]);
  const areaWinner = areaCompetitors.find((entry) => entry.status === 200).body;
  assert.equal(areaWinner.acceptedAmount, 24 * 80);
  assert.equal(areaWinner.state.decorations.filter((entry) => entry.plotId.startsWith('east-park-')).length, 24);
  assert.equal(areaWinner.state.revision, areaBuilt.state.revision + 1);
  const duplicateBatch = await Promise.all([1, 2].map(() => post('decorate', { ...areaBody, token: 'city-token-b', requestId: 'area-duplicate', areaId: 'south-meadow', quantity: 3 })));
  assert.equal(duplicateBatch.filter((entry) => entry.replayed).length, 1);
  assert.equal(duplicateBatch[0].progress.currency, duplicateBatch[1].progress.currency);
  const publicArea = await post('donate', { token: 'city-token-b', requestId: 'area-public', projectId: 'north-community-garden', amount: 640 });
  assert.equal(publicArea.state.projects.find((entry) => entry.id === 'north-community-garden').built, true);
  const beforeRestart = await (await fetch(`${base}/town-api/city/state`)).json();
  await stop();
  await start();
  const afterRestart = await (await fetch(`${base}/town-api/city/state`)).json();
  assert.deepEqual(afterRestart, beforeRestart);
  // Restart isolates this process-local rate budget. The GET above is free;
  // this replay and the following 19 mutations fill its 20-request window.
  const restartReplay = await post('donate', donation);
  assert.equal(restartReplay.replayed, true);
  for (let i = 0; i < 19; i++) await post('donate', donation);
  await post('donate', donation, 429);
  await stop();
  fixture(`
    const assert = (await import('node:assert/strict')).default;
    const { db, getUser, purchaseBuilding, recordBuildingVisit, purchaseItem, backupDatabase, restoreFromBackupFile, closeDatabase } = await import('./dist/db.js');
    const { mutateCity, getCityState } = await import('./dist/cityGovernance.js');
    const { voteCity, getCityVotes } = await import('./dist/cityVoting.js');
    const { CITY_CONSTRUCTION_CONFIG: config } = await import('./dist/data/cityConstructionConfig.js');
    const { BUILDING_CATALOG } = await import('./dist/data/buildingCatalog.js');
    const { LEGACY_INITIAL_BUILDINGS, LEGACY_UNLOCK_PRESERVATION_BUILDINGS, reconcileInitialBuildings } = await import('./dist/cityGovernanceMigration.js');
    const legacyPendingBuildings = [
      'catcafe', 'academy', 'shrine', 'beacon', 'television_tower', 'fried_chicken_shop',
      'tradingpost', 'guildhall', 'conservatory', 'arena', 'school_north', 'teahouse',
      'teahouse_outer', 'writingclub', 'senate', 'musichall', 'banana_palace', 'qipai_hall',
      'wushi_restaurant', 'tavern',
    ];
    const catalogBuildingIds = new Set(BUILDING_CATALOG.map((building) => building.id));
    assert.deepEqual([...LEGACY_UNLOCK_PRESERVATION_BUILDINGS].sort(), [...legacyPendingBuildings].sort());
    const legacyPolicyIds = new Set([...LEGACY_INITIAL_BUILDINGS, ...legacyPendingBuildings]);
    assert.equal(legacyPolicyIds.size, BUILDING_CATALOG.length, 'legacy construction policy must cover every catalog building');
    assert.deepEqual([...legacyPolicyIds].filter((id) => !catalogBuildingIds.has(id)), [], 'legacy policy must not contain removed buildings');
    assert.deepEqual([...catalogBuildingIds].filter((id) => !legacyPolicyIds.has(id)), [], 'new catalog buildings require an explicit legacy policy decision');
    const user = getUser('11111111-1111-4111-8111-111111111111');
    db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run('RenamedResident', user.id);
    assert.equal(getCityState().decorations.find((entry) => entry.ownerId === user.id).ownerNickname, 'RenamedResident');
    db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(user.nickname, user.id);
    db.prepare('UPDATE player_progress SET currency = 0 WHERE user_id = ?').run(user.id);
    const freeVote = voteCity(user, { configVersion: config.version, requestId: 'zero-balance-vote', projectId: config.projects.find((entry) => entry.buildingId === 'academy').id });
    assert.equal(db.prepare('SELECT currency FROM player_progress WHERE user_id = ?').get(user.id).currency, 0);
    assert.ok(freeVote.votes.projectIds.includes(config.projects.find((entry) => entry.buildingId === 'academy').id));
    const before = getCityState();
    assert.throws(() => mutateCity(user, 'donate', { configVersion: config.version, requestId: 'poor', projectId: 'greenbelt-trees', amount: 1 }), /Insufficient/);
    assert.deepEqual(getCityState(), before);
    assert.throws(() => mutateCity(user, 'decorate', { configVersion: config.version, requestId: 'poor-plot', plotId: config.personalPlots[1].id, decorationId: 'oak' }), /Insufficient/);
    assert.deepEqual(getCityState(), before);
    assert.throws(() => mutateCity(user, 'decorate', { configVersion: config.version, requestId: 'poor-area', areaId: 'west-park', decorationId: 'flowers', quantity: 20 }), /Insufficient/);
    assert.deepEqual(getCityState(), before);
    assert.equal(db.prepare('SELECT currency FROM player_progress WHERE user_id = ?').get(user.id).currency, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM city_operations WHERE request_id IN ('poor', 'poor-plot', 'poor-area')").get().n, 0);
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
    assert.deepEqual(getCityVotes(user.id).projectIds, freeVote.votes.projectIds);
    assert.equal(voteCity(user, { configVersion: config.version, requestId: 'zero-balance-vote', projectId: config.projects.find((entry) => entry.buildingId === 'academy').id }).replayed, true);
    assert.equal(db.prepare('SELECT session_expires_at FROM users WHERE id = ?').get(user.id).session_expires_at, null);
    const { initializeCityGovernance } = await import('./dist/cityGovernanceSchema.js');
    const stored = db.prepare('SELECT config_json FROM city_configs WHERE version = ?').get(config.version).config_json;
    db.prepare('UPDATE city_configs SET config_json = ? WHERE version = ?').run('{}', config.version);
    assert.throws(() => db.transaction(() => initializeCityGovernance(db))(), /version bump/);
    db.prepare('UPDATE city_configs SET config_json = ? WHERE version = ?').run(stored, config.version);
    // Failed restore must roll back every table and close its source handle.
    const Database = (await import('better-sqlite3')).default;
    // Unlock preservation is a one-time pre-ledger policy, not a fallback for
    // arbitrary missing project rows or buildings introduced in later releases.
    const policyDb = new Database(':memory:');
    policyDb.exec('CREATE TABLE users (id TEXT); CREATE TABLE city_meta (id INTEGER, config_version TEXT); CREATE TABLE city_configs (version TEXT, config_json TEXT); CREATE TABLE city_projects (id TEXT); CREATE TABLE player_building_unlocks (building_id TEXT)');
    policyDb.prepare('INSERT INTO users VALUES (?)').run(user.id);
    for (const id of ['academy', 'writingclub_outer', 'future-default-building']) policyDb.prepare('INSERT INTO player_building_unlocks VALUES (?)').run(id);
    const futureConfig = { ...config, version: 'future-policy', projects: [...config.projects,
      { id: 'future-project', buildingId: 'future-default-building', kind: 'building', name: 'Future', description: 'Future', cost: 3000 }] };
    const preservedLegacy = reconcileInitialBuildings(policyDb, futureConfig);
    assert.equal(preservedLegacy.preserved.has('academy'), true);
    assert.equal(preservedLegacy.preserved.has('future-default-building'), false);
    assert.equal(preservedLegacy.previousConfig, undefined);
    policyDb.prepare('INSERT INTO city_configs VALUES (?, ?)').run(config.version, JSON.stringify(config));
    policyDb.prepare('INSERT INTO city_meta VALUES (1, ?)').run(config.version);
    const preservedUpgrade = reconcileInitialBuildings(policyDb, futureConfig);
    for (const id of ['academy', 'writingclub_outer', 'future-default-building']) assert.equal(preservedUpgrade.preserved.has(id), false);
    assert.deepEqual(preservedUpgrade.previousConfig, config);
    policyDb.close();
    // The first pending-building policy missed the client-only photo studio.
    // A real old ledger has neither its project definition nor its progress row.
    const photoPath = ${JSON.stringify(join(dataDir, 'city-before-photostudio.sqlite'))};
    await backupDatabase(photoPath);
    const photoDb = new Database(photoPath);
    const photoOldConfig = { ...config, version: '2026-09-25.pending.1', projects: config.projects.filter((project) => project.buildingId !== 'photostudio') };
    photoDb.prepare('INSERT INTO city_configs VALUES (?, ?)').run(photoOldConfig.version, JSON.stringify(photoOldConfig));
    photoDb.prepare('UPDATE city_meta SET config_version = ?').run(photoOldConfig.version);
    photoDb.prepare('DELETE FROM city_configs WHERE version = ?').run(config.version);
    photoDb.prepare("DELETE FROM city_projects WHERE id = 'build-photostudio'").run();
    const photoOldProjects = photoDb.prepare('SELECT * FROM city_projects ORDER BY id').all();
    const photoOldReceipts = photoDb.prepare('SELECT * FROM city_operations ORDER BY user_id, request_id').all();
    const photoOldBalances = photoDb.prepare('SELECT * FROM player_progress ORDER BY user_id').all();
    photoDb.close();
    restoreFromBackupFile(photoPath);
    const photoBuilt = getCityState().projects.find((project) => project.id === 'build-photostudio');
    assert.equal(photoBuilt.built, true);
    assert.equal(photoBuilt.funded, config.projects.find((project) => project.id === photoBuilt.id).cost);
    for (const oldProject of photoOldProjects) assert.deepEqual(db.prepare('SELECT * FROM city_projects WHERE id = ?').get(oldProject.id), oldProject);
    assert.deepEqual(db.prepare('SELECT * FROM city_operations ORDER BY user_id, request_id').all(), photoOldReceipts);
    assert.deepEqual(db.prepare('SELECT * FROM player_progress ORDER BY user_id').all(), photoOldBalances);
    const photoMigrated = getCityState();
    db.transaction(() => initializeCityGovernance(db))();
    assert.deepEqual(getCityState(), photoMigrated);
    restoreFromBackupFile(path);
    // Reconstruct a real pre-area backup: its historical config, receipts and
    // purchased single plots must survive the explicit additive reconciliation.
    const preAreaPath = ${JSON.stringify(join(dataDir, 'city-pre-area.sqlite'))};
    await backupDatabase(preAreaPath);
    const preArea = new Database(preAreaPath);
    const legacyBuildingIds = ['catcafe', 'academy', 'shrine', 'beacon', 'television_tower', 'fried_chicken_shop', 'tradingpost', 'guildhall', 'conservatory', 'arena', 'school_north', 'teahouse', 'teahouse_outer', 'writingclub', 'senate', 'musichall', 'banana_palace', 'qipai_hall', 'wushi_restaurant', 'tavern'];
    const oldConfig = structuredClone(config);
    const newPlotIds = new Set(oldConfig.personalAreas.flatMap((area) => area.plotIds));
    oldConfig.personalPlots = oldConfig.personalPlots.filter((plot) => !newPlotIds.has(plot.id));
    oldConfig.projects = oldConfig.projects.filter((project) => !['north-community-garden', 'south-community-grove'].includes(project.id)
      && (!project.buildingId || legacyBuildingIds.includes(project.buildingId)));
    oldConfig.initialBuiltBuildingIds = ['commons', ...config.projects.filter((project) => project.buildingId && project.buildingId !== 'photostudio' && !legacyBuildingIds.includes(project.buildingId)).map((project) => project.buildingId)];
    delete oldConfig.personalAreas;
    oldConfig.version = '2026-09-19.1';
    preArea.prepare('INSERT INTO city_configs VALUES (?, ?)').run(oldConfig.version, JSON.stringify(oldConfig));
    preArea.prepare('UPDATE city_meta SET config_version = ? WHERE id = 1').run(oldConfig.version);
    preArea.prepare('DELETE FROM city_configs WHERE version = ?').run(config.version);
    for (const id of newPlotIds) preArea.prepare('DELETE FROM city_decorations WHERE plot_id = ?').run(id);
    for (const project of config.projects.filter((project) => !oldConfig.projects.some((old) => old.id === project.id))) preArea.prepare('DELETE FROM city_projects WHERE id = ?').run(project.id);
    preArea.prepare("DELETE FROM city_operations WHERE request_id LIKE 'area-%'").run();
    for (const operation of preArea.prepare('SELECT user_id, request_id, fingerprint FROM city_operations').all()) {
      const fingerprint = JSON.parse(operation.fingerprint);
      assert(Array.isArray(fingerprint) && fingerprint.length === 4
        && ['donate', 'decorate'].includes(fingerprint[0]) && fingerprint[3] === config.version,
      'Only legacy donate/decorate receipts can be rewritten into the pre-area fixture');
      fingerprint[3] = oldConfig.version;
      preArea.prepare('UPDATE city_operations SET fingerprint = ? WHERE user_id = ? AND request_id = ?').run(JSON.stringify(fingerprint), operation.user_id, operation.request_id);
    }
    // Keep one area receipt from the historical catalog so restoring the
    // backup proves a decorate-area retry can replay across config versions.
    const legacyAreaRequest = 'legacy-area-replay';
    const legacyAreaFingerprint = JSON.stringify(['decorate-area', 'north-meadow', 'flowers', 1, oldConfig.version]);
    preArea.prepare('INSERT INTO city_operations (user_id, request_id, fingerprint, accepted_amount, revision) VALUES (?, ?, ?, ?, ?)')
      .run(user.id, legacyAreaRequest, legacyAreaFingerprint, 80, before.revision);
    const oldDecorations = preArea.prepare('SELECT * FROM city_decorations ORDER BY plot_id').all();
    const oldReceipts = preArea.prepare('SELECT * FROM city_operations ORDER BY user_id, request_id').all();
    const oldBalance = preArea.prepare('SELECT currency FROM player_progress WHERE user_id = ?').get(user.id).currency;
    preArea.close();
    restoreFromBackupFile(preAreaPath);
    assert.equal(getCityState().configVersion, config.version);
    assert.equal(getCityState().projects.find((project) => project.id === 'build-photostudio').built, true);
    assert.deepEqual(db.prepare('SELECT * FROM city_decorations ORDER BY plot_id').all(), oldDecorations);
    assert.deepEqual(db.prepare('SELECT * FROM city_operations ORDER BY user_id, request_id').all(), oldReceipts);
    const oldReplay = mutateCity(user, 'donate', { configVersion: oldConfig.version, requestId: 'first', projectId: 'build-catcafe', amount: 100 });
    assert.equal(oldReplay.replayed, true);
    assert.equal(oldReplay.progress.currency, oldBalance);
    const legacyAreaReplay = mutateCity(user, 'decorate', {
      configVersion: oldConfig.version, requestId: legacyAreaRequest,
      areaId: 'north-meadow', decorationId: 'flowers', quantity: 1,
    });
    assert.equal(legacyAreaReplay.replayed, true);
    assert.equal(legacyAreaReplay.acceptedAmount, 80);
    assert.equal(legacyAreaReplay.progress.currency, oldBalance);
    assert.ok(getCityState().projects.filter((project) => ['north-community-garden', 'south-community-grove'].includes(project.id)).every((project) => project.funded === 0 && !project.built));
    restoreFromBackupFile(path);
    // Restore the original area layout with real purchased plots and receipts.
    // Only the known geometry changes; ownership, balances and funding survive.
    const { LEGACY_AREA_PLOTS, LEGACY_AREA_PROJECTS, LEGACY_PERSONAL_AREAS } = await import('./dist/data/legacyCityConstructionAreas.js');
    const layoutPath = ${JSON.stringify(join(dataDir, 'city-old-area-layout.sqlite'))};
    db.prepare('UPDATE player_progress SET currency = 10 WHERE user_id = ?').run(user.id);
    mutateCity(user, 'donate', { configVersion: config.version, requestId: 'layout-donation', projectId: 'south-community-grove', amount: 10 });
    await backupDatabase(layoutPath);
    const oldLayoutDb = new Database(layoutPath);
    const oldLayout = structuredClone(config);
    oldLayout.version = '2026-09-25.areas.1';
    oldLayout.personalAreas = structuredClone(LEGACY_PERSONAL_AREAS);
    oldLayout.personalPlots = oldLayout.personalPlots.map((plot) => structuredClone(LEGACY_AREA_PLOTS.find((old) => old.id === plot.id) ?? plot));
    oldLayout.projects = oldLayout.projects.map((project) => structuredClone(LEGACY_AREA_PROJECTS.find((old) => old.id === project.id) ?? project));
    oldLayoutDb.prepare('INSERT INTO city_configs VALUES (?, ?)').run(oldLayout.version, JSON.stringify(oldLayout));
    oldLayoutDb.prepare('UPDATE city_meta SET config_version = ?').run(oldLayout.version);
    oldLayoutDb.prepare('DELETE FROM city_configs WHERE version = ?').run(config.version);
    for (const project of LEGACY_AREA_PROJECTS) oldLayoutDb.prepare('UPDATE city_projects SET definition_json = ? WHERE id = ?').run(JSON.stringify(project), project.id);
    for (const operation of oldLayoutDb.prepare('SELECT user_id, request_id, fingerprint FROM city_operations').all()) {
      const fingerprint = JSON.parse(operation.fingerprint);
      assert(Array.isArray(fingerprint) && fingerprint.at(-1) === config.version
        && ((fingerprint.length === 4 && ['donate', 'decorate'].includes(fingerprint[0]))
          || (fingerprint.length === 5 && fingerprint[0] === 'decorate-area')));
      fingerprint[fingerprint.length - 1] = oldLayout.version;
      oldLayoutDb.prepare('UPDATE city_operations SET fingerprint = ? WHERE user_id = ? AND request_id = ?').run(JSON.stringify(fingerprint), operation.user_id, operation.request_id);
    }
    const layoutDecorations = oldLayoutDb.prepare('SELECT * FROM city_decorations ORDER BY plot_id').all();
    assert(layoutDecorations.some((entry) => LEGACY_AREA_PLOTS.some((plot) => plot.id === entry.plot_id)));
    const layoutReceipts = oldLayoutDb.prepare('SELECT * FROM city_operations ORDER BY user_id, request_id').all();
    const layoutVotes = oldLayoutDb.prepare('SELECT * FROM city_votes ORDER BY user_id, project_id').all();
    const layoutVoteReceipts = oldLayoutDb.prepare('SELECT * FROM city_vote_operations ORDER BY user_id, request_id').all();
    assert(layoutVotes.length > 0 && layoutVoteReceipts.length > 0);
    const layoutFunding = oldLayoutDb.prepare('SELECT id, funded, built FROM city_projects ORDER BY id').all();
    const layoutBalance = oldLayoutDb.prepare('SELECT user_id, currency FROM player_progress ORDER BY user_id').all();
    oldLayoutDb.close();
    restoreFromBackupFile(layoutPath);
    assert.equal(getCityState().configVersion, config.version);
    assert.deepEqual(db.prepare('SELECT * FROM city_decorations ORDER BY plot_id').all(), layoutDecorations);
    assert.deepEqual(db.prepare('SELECT * FROM city_operations ORDER BY user_id, request_id').all(), layoutReceipts);
    assert.deepEqual(db.prepare('SELECT * FROM city_votes ORDER BY user_id, project_id').all(), layoutVotes);
    assert.deepEqual(db.prepare('SELECT * FROM city_vote_operations ORDER BY user_id, request_id').all(), layoutVoteReceipts);
    assert.deepEqual(db.prepare('SELECT id, funded, built FROM city_projects ORDER BY id').all(), layoutFunding);
    assert.deepEqual(db.prepare('SELECT user_id, currency FROM player_progress ORDER BY user_id').all(), layoutBalance);
    for (const project of config.projects.filter((entry) => LEGACY_AREA_PROJECTS.some((old) => old.id === entry.id))) {
      assert.deepEqual(JSON.parse(db.prepare('SELECT definition_json FROM city_projects WHERE id = ?').get(project.id).definition_json), project);
    }
    assert.equal(layoutFunding.find((entry) => entry.id === 'north-community-garden').built, 1);
    assert.equal(layoutFunding.find((entry) => entry.id === 'south-community-grove').funded, 10);
    assert.equal(mutateCity(user, 'donate', { configVersion: oldLayout.version, requestId: 'layout-donation', projectId: 'south-community-grove', amount: 10 }).replayed, true);
    const purchasedAreaReceipt = layoutReceipts.find((entry) => JSON.parse(entry.fingerprint)[0] === 'decorate-area');
    assert(purchasedAreaReceipt, 'The old-layout fixture must contain a real paid area operation');
    const [, purchasedAreaId, purchasedDecorationId, purchasedQuantity, purchasedVersion] = JSON.parse(purchasedAreaReceipt.fingerprint);
    assert.equal(mutateCity(getUser(purchasedAreaReceipt.user_id), 'decorate', {
      configVersion: purchasedVersion, requestId: purchasedAreaReceipt.request_id,
      areaId: purchasedAreaId, decorationId: purchasedDecorationId, quantity: purchasedQuantity,
    }).replayed, true);
    const beforeLayoutFailure = getCityState();
    const constructionLedger = () => Object.fromEntries(['city_configs', 'city_meta', 'city_projects', 'city_decorations', 'city_operations', 'city_votes', 'city_vote_operations', 'player_progress']
      .map((table) => [table, db.prepare('SELECT * FROM ' + table + ' ORDER BY rowid').all()]));
    const beforeLayoutLedger = constructionLedger();
    db.transaction(() => initializeCityGovernance(db))();
    assert.deepEqual(constructionLedger(), beforeLayoutLedger);
    const tamperedLayoutDb = new Database(layoutPath);
    const knownOldLayout = JSON.stringify(oldLayout);
    oldLayout.personalPlots.find((plot) => plot.id === LEGACY_AREA_PLOTS[0].id).x += 0.1;
    tamperedLayoutDb.prepare('UPDATE city_configs SET config_json = ? WHERE version = ?').run(JSON.stringify(oldLayout), oldLayout.version);
    tamperedLayoutDb.close();
    assert.throws(() => restoreFromBackupFile(layoutPath), /explicit reconciliation|City project changed/);
    assert.deepEqual(getCityState(), beforeLayoutFailure);
    assert.deepEqual(constructionLedger(), beforeLayoutLedger);
    // Correct config with a corrupt project row is not silently repaired; even
    // the preceding valid project's staged geometry update must roll back.
    const corruptLayoutDb = new Database(layoutPath);
    corruptLayoutDb.prepare('UPDATE city_configs SET config_json = ? WHERE version = ?').run(knownOldLayout, oldLayout.version);
    const corruptProject = structuredClone(LEGACY_AREA_PROJECTS[1]);
    corruptProject.placements[0].x += 0.1;
    corruptLayoutDb.prepare('UPDATE city_projects SET definition_json = ? WHERE id = ?').run(JSON.stringify(corruptProject), corruptProject.id);
    corruptLayoutDb.close();
    assert.throws(() => restoreFromBackupFile(layoutPath), /City project changed/);
    assert.deepEqual(constructionLedger(), beforeLayoutLedger);
    restoreFromBackupFile(path);
    // A legacy initial building could not also be a funded project. Reject a
    // corrupt mixed ledger instead of silently filling its partial funding.
    const mixedPreservation = new Database(preAreaPath);
    const preservedProject = config.projects.find((project) => project.buildingId === 'library');
    assert(oldConfig.initialBuiltBuildingIds.includes(preservedProject.buildingId));
    assert.equal(mixedPreservation.prepare('SELECT id FROM city_projects WHERE id = ?').get(preservedProject.id), undefined);
    mixedPreservation.prepare('INSERT INTO city_projects (id, definition_json, funded, built) VALUES (?, ?, 1, 0)')
      .run(preservedProject.id, JSON.stringify(preservedProject));
    mixedPreservation.close();
    const beforePreservationFailure = constructionLedger();
    assert.throws(() => restoreFromBackupFile(preAreaPath), /Preserved city building has funded progress/);
    assert.deepEqual(constructionLedger(), beforePreservationFailure);
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
    const { reconcileAreaCatalog } = await import('./dist/cityAreaMigration.js');
    const renamedArea = structuredClone(config);
    renamedArea.personalAreas[0].name += '（新名称）';
    renamedArea.decorations[0].cost += 1;
    assert.doesNotThrow(() => reconcileAreaCatalog(config, renamedArea));
    const unlistedAreaPrevious = structuredClone(config);
    unlistedAreaPrevious.personalAreas = [{ id: 'future-area', name: '未来区域', plotIds: [] }];
    const unlistedAreaNext = structuredClone(unlistedAreaPrevious);
    unlistedAreaNext.personalPlots[0].x += 0.1;
    assert.throws(() => reconcileAreaCatalog(unlistedAreaPrevious, unlistedAreaNext), /personal plot ledger changed/);
    const noAreaPrevious = structuredClone(config);
    const noAreaNext = structuredClone(config);
    delete noAreaPrevious.personalAreas;
    delete noAreaNext.personalAreas;
    noAreaNext.personalPlots[0].x += 0.1;
    assert.throws(() => reconcileAreaCatalog(noAreaPrevious, noAreaNext), /personal plot ledger changed/);
    // A pre-city backup seeds clean construction state and operations.
    // Restore an actual previous ledger policy: standing core buildings become
    // completed projects, while paid progress and request replay records survive.
    for (const version of ['2026-09-25.areas.1', '2026-09-26.areas.2']) {
      restoreFromBackupFile(path);
      const oldPath = ${JSON.stringify(join(dataDir, 'city-old-policy-'))} + version + '.sqlite';
      await backupDatabase(oldPath);
      const oldDb = new Database(oldPath);
      const oldPolicyConfig = { ...config, version,
        projects: config.projects.filter((project) => !project.buildingId || legacyBuildingIds.includes(project.buildingId)),
        initialBuiltBuildingIds: ['commons', ...config.projects.filter((project) => project.buildingId && project.buildingId !== 'photostudio' && !legacyBuildingIds.includes(project.buildingId)).map((project) => project.buildingId)],
      };
      // areas.1 combines original-layout and building-policy migration;
      // areas.2 already has corrected geometry and migrates only building policy.
      if (version === '2026-09-25.areas.1') {
        oldPolicyConfig.personalPlots = oldPolicyConfig.personalPlots.map((plot) => structuredClone(LEGACY_AREA_PLOTS.find((old) => old.id === plot.id) ?? plot));
        oldPolicyConfig.projects = oldPolicyConfig.projects.map((project) => structuredClone(LEGACY_AREA_PROJECTS.find((old) => old.id === project.id) ?? project));
        for (const project of LEGACY_AREA_PROJECTS) oldDb.prepare('UPDATE city_projects SET definition_json = ? WHERE id = ?').run(JSON.stringify(project), project.id);
      }
      oldDb.prepare('INSERT INTO city_configs VALUES (?, ?)').run(oldPolicyConfig.version, JSON.stringify(oldPolicyConfig));
      oldDb.prepare('UPDATE city_meta SET config_version = ?').run(oldPolicyConfig.version);
      for (const project of config.projects.filter((project) => project.buildingId && !legacyBuildingIds.includes(project.buildingId))) oldDb.prepare('DELETE FROM city_projects WHERE id = ?').run(project.id);
      const oldOperations = oldDb.prepare('SELECT * FROM city_operations ORDER BY user_id, request_id').all();
      const oldMoney = oldDb.prepare('SELECT user_id, currency FROM player_progress ORDER BY user_id').all();
      const oldPaid = oldDb.prepare('SELECT * FROM city_projects ORDER BY id').all();
      oldDb.close();
      restoreFromBackupFile(oldPath);
      assert.equal(getCityState().configVersion, config.version);
      assert.equal(getCityState().projects.find((project) => project.id === 'build-photostudio').built, true);
      for (const id of oldPolicyConfig.initialBuiltBuildingIds.filter((id) => id !== 'commons')) assert.equal(getCityState().projects.find((project) => project.id === 'build-' + id).built, true);
      for (const paid of oldPaid) {
        const definition = config.projects.find((project) => project.id === paid.id);
        assert.deepEqual(db.prepare('SELECT * FROM city_projects WHERE id = ?').get(paid.id), { ...paid, definition_json: JSON.stringify(definition) });
      }
      assert.deepEqual(db.prepare('SELECT * FROM city_operations ORDER BY user_id, request_id').all(), oldOperations);
      assert.deepEqual(db.prepare('SELECT user_id, currency FROM player_progress ORDER BY user_id').all(), oldMoney);
      const migrated = getCityState();
      db.transaction(() => initializeCityGovernance(db))();
      assert.deepEqual(getCityState(), migrated);
    }
    // A pre-city backup preserves historical defaults and explicit unlocks,
    // but cannot retain city operations that did not exist in that snapshot.
    // Backups from the construction-only schema migrate to empty votes without
    // changing project funding, decorations, or paid request receipts.
    const preVotePath = ${JSON.stringify(join(dataDir, 'city-pre-vote.sqlite'))};
    await backupDatabase(preVotePath);
    const preVote = new Database(preVotePath);
    preVote.exec('DROP TABLE city_vote_operations; DROP TABLE city_votes');
    preVote.pragma('user_version = 6');
    preVote.close();
    const fundedBeforeVotingMigration = getCityState().projects.map(({ votes, ...project }) => project);
    restoreFromBackupFile(preVotePath);
    assert.ok(getCityState().projects.every((project) => project.votes === 0));
    assert.deepEqual(getCityState().projects.map(({ votes, ...project }) => project), fundedBeforeVotingMigration);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM city_operations').get().n, operationsBefore);
    assert.deepEqual(getCityVotes(user.id).projectIds, []);
    const legacyPath = ${JSON.stringify(join(dataDir, 'city-legacy.sqlite'))};
    await backupDatabase(legacyPath);
    const legacy = new Database(legacyPath);
    legacy.pragma('foreign_keys = OFF');
    for (const table of ['city_vote_operations', 'city_votes', 'city_operations', 'city_decorations', 'city_projects', 'city_meta', 'city_configs']) legacy.exec('DROP TABLE ' + table);
    legacy.prepare('INSERT OR IGNORE INTO player_building_unlocks VALUES (?, ?, ?)').run(user.id, 'academy', new Date().toISOString());
    // Beacon is governed by the current ledger. A legacy admin override must
    // not gift it merely because the pre-ledger database mentions it.
    legacy.prepare("INSERT INTO world_config (key, value_json, updated_at) VALUES ('buildings', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json").run(JSON.stringify({ beacon: 'open', catcafe: 'open' }), new Date().toISOString());
    legacy.pragma('user_version = 5');
    legacy.close();
    restoreFromBackupFile(legacyPath);
    resetWorldConfig();
    assert.equal(getCityState().revision, 0);
    assert.equal(getCityState().projects.find((project) => project.id === 'build-library').built, true);
    assert.equal(getCityState().projects.find((project) => project.id === 'build-photostudio').built, true);
    assert.equal(getCityState().projects.find((project) => project.id === 'build-academy').built, true);
    assert.equal(getCityState().projects.find((project) => project.id === 'build-beacon').built, false);
    assert.equal(getCityState().projects.find((project) => project.id === 'build-catcafe').built, false);
    assert.equal(getCityState().projects.find((project) => project.id === 'build-shrine').built, false);
    assert.equal(getCityState().projects.find((project) => project.id === 'greenbelt-trees').funded, 0);
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
  const { MINICITY_SCHEMA_VERSION } = await import('../dist/databaseMetadata.js');
  assert.equal(backup.pragma('user_version', { simple: true }), MINICITY_SCHEMA_VERSION);
  assert.equal(backup.pragma('foreign_key_check').length, 0);
  backup.close();
  console.log('City governance integration passed');
} finally {
  await stop();
}
