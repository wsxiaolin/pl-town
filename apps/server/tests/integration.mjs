import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const port = 8791;
const dataDir = mkdtempSync(join(tmpdir(), 'minicity-server-'));
const productionConfigCheck = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./dist/config.js')"], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir, ADMIN_USERNAME: '', ADMIN_PASSWORD: '', ADMIN_ACCOUNTS_JSON: '', ALLOWED_ORIGINS: '' },
  encoding: 'utf8', timeout: 5_000,
});
if (productionConfigCheck.status === 0 || !`${productionConfigCheck.stdout}${productionConfigCheck.stderr}`.includes('Production requires')) {
  throw new Error('Production configuration must fail closed when administrator credentials and origins are missing');
}
const multiAdminConfigCheck = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./dist/config.js').then((config) => console.log(`${config.ADMIN_ENABLED}:${config.ADMIN_ACCOUNTS.length}`))"], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir, ADMIN_USERNAME: '', ADMIN_PASSWORD: '',
    ADMIN_ACCOUNTS_JSON: JSON.stringify({ operator: 'json-only-operator-password', reviewer: 'json-only-reviewer-password' }),
    ALLOWED_ORIGINS: 'https://city.example.com', BIGMODEL_API_KEY: 'integration-api-key',
  },
  encoding: 'utf8', timeout: 5_000,
});
if (multiAdminConfigCheck.status !== 0 || !multiAdminConfigCheck.stdout.includes('true:2')) {
  throw new Error(`Production configuration must support JSON-only administrator accounts:\n${multiAdminConfigCheck.stderr}`);
}
const ossIncompleteConfigCheck = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./dist/config.js')"], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin-password-12345678',
    ADMIN_ACCOUNTS_JSON: '', ALLOWED_ORIGINS: 'https://city.example.com', OSS_ENABLED: 'true', OSS_REGION: 'oss-cn-shanghai',
    OSS_BUCKET: 'bucket', OSS_ACCESS_KEY_ID: 'key-id', OSS_ACCESS_KEY_SECRET: '', BIGMODEL_API_KEY: 'integration-api-key',
  },
  encoding: 'utf8', timeout: 5_000,
});
if (ossIncompleteConfigCheck.status === 0 || !`${ossIncompleteConfigCheck.stdout}${ossIncompleteConfigCheck.stderr}`.includes('OSS_ENABLED requires')) {
  throw new Error('Production configuration must fail closed when OSS is enabled with incomplete credentials');
}
const ossEnabledConfigCheck = spawnSync(process.execPath, ['--input-type=module', '-e', "import('./dist/config.js').then((config) => console.log(`${config.OFFSITE_BACKUP_ENABLED}`))"], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: 'admin-password-12345678',
    ADMIN_ACCOUNTS_JSON: '', ALLOWED_ORIGINS: 'https://city.example.com', OSS_ENABLED: 'true', OSS_REGION: 'oss-cn-shanghai',
    OSS_BUCKET: 'bucket', OSS_ACCESS_KEY_ID: 'key-id', OSS_ACCESS_KEY_SECRET: 'key-secret', BIGMODEL_API_KEY: 'integration-api-key',
  },
  encoding: 'utf8', timeout: 5_000,
});
if (ossEnabledConfigCheck.status !== 0 || !ossEnabledConfigCheck.stdout.includes('true')) {
  throw new Error(`Production configuration must enable off-site backups with complete OSS credentials:\n${ossEnabledConfigCheck.stderr}`);
}
const moderationPort = 8792;
const moderationRequests = [];
const moderationServer = createServer(async (request, response) => {
  let raw = '';
  for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  moderationRequests.push({ authorization: request.headers.authorization, body });
  if (request.headers.authorization !== 'Bearer integration-api-key') {
    response.writeHead(401, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'unauthorized' } }));
    return;
  }
  const riskTypes = body.input === 'integration-blocked' ? ['test-policy-violation'] : [];
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({
    id: `moderation-${moderationRequests.length}`,
    request_id: `request-${moderationRequests.length}`,
    result_list: [{ content_type: 'text', risk_type: riskTypes }],
  }));
});
await new Promise((resolve, reject) => {
  moderationServer.once('error', reject);
  moderationServer.listen(moderationPort, '127.0.0.1', resolve);
});
const server = spawn(process.execPath, ['dist/index.js'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env, PORT: String(port), DATA_DIR: dataDir,
    ADMIN_USERNAME: 'operator', ADMIN_PASSWORD: 'integration-admin-password',
    ADMIN_ACCOUNTS_JSON: JSON.stringify({ reviewer: 'integration-reviewer-password' }),
    AUTO_BACKUP_ENABLED: 'false', ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
    BIGMODEL_API_KEY: 'integration-api-key', BIGMODEL_MODERATION_URL: `http://127.0.0.1:${moderationPort}/moderations`,
  },
  stdio: ['ignore', 'pipe', 'inherit'],
});

const connect = (nickname, password = 'resident-secret') => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const messages = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    messages.push(message);
    if (message.type === 'hello') resolve({ socket, hello: message, messages });
  });
  socket.on('error', reject);
  socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', nickname, password })));
});

const connectExpectingError = (nickname, password = 'resident-secret') => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    if (message.type === 'error') { socket.close(); resolve(message.message); }
  });
  socket.on('error', reject);
  const timeout = setTimeout(() => reject(new Error(`Timed out waiting for auth error for ${nickname}`)), 3_000);
  socket.on('open', () => {
    socket.send(JSON.stringify({ type: 'hello', nickname, password }));
    setTimeout(() => { clearTimeout(timeout); if (socket.readyState === socket.OPEN) socket.close(); }, 1_000);
  });
});

const rejectedWebSocketOrigin = () => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`, { origin: 'https://evil.example' });
  const timeout = setTimeout(() => { socket.terminate(); reject(new Error('Timed out waiting for rejected WebSocket origin')); }, 3_000);
  socket.once('unexpected-response', (_request, response) => {
    clearTimeout(timeout); response.resume(); resolve(response.statusCode);
  });
  socket.once('open', () => { clearTimeout(timeout); socket.close(); reject(new Error('Untrusted WebSocket origin was accepted')); });
  socket.once('error', () => { /* unexpected-response is authoritative */ });
});

const waitForClose = (client) => new Promise((resolve, reject) => {
  if (client.socket.readyState === client.socket.CLOSED) return resolve();
  const timeout = setTimeout(() => reject(new Error('Timed out waiting for socket close')), 3_000);
  client.socket.once('close', () => { clearTimeout(timeout); resolve(); });
});

const waitFor = (client, type, predicate = () => true) => new Promise((resolve, reject) => {
  const existing = client.messages.find((message) => message.type === type && predicate(message));
  if (existing) return resolve(existing);
  const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type}`)), 3_000);
  const listener = (raw) => {
    const message = JSON.parse(raw);
    if (message.type !== type || !predicate(message)) return;
    clearTimeout(timeout);
    client.socket.off('message', listener);
    resolve(message);
  };
  client.socket.on('message', listener);
});

const send = (client, message) => client.socket.send(JSON.stringify(message));
const waitForServer = () => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Server did not start')), 5_000);
  server.stdout.on('data', (chunk) => {
    if (!chunk.toString().includes('listening')) return;
    clearTimeout(timeout);
    resolve();
  });
});

const poll = async (operation, predicate, description) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = await operation();
    if (predicate(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${description}`);
};

let alice;
let bob;
let charlie;
let requester;
try {
  await waitForServer();

  if (await rejectedWebSocketOrigin() !== 401) throw new Error('Untrusted WebSocket origins must be rejected during the handshake');

  const adminOrigin = `http://127.0.0.1:${port}`;
  const adminBase = `${adminOrigin}/admin/api`;
  const unauthenticated = await fetch(`${adminBase}/overview`);
  if (unauthenticated.status !== 401 || unauthenticated.headers.get('cache-control') !== 'no-store') throw new Error('Admin API must reject unauthenticated requests without caching');

  // The admin HTML shell must never be cached, and it must reference the
  // fingerprinted asset URLs so that updated JS/CSS is served immediately
  // after a deploy rather than from a stale long-lived cache.
  const adminHtmlResponse = await fetch(`${adminOrigin}/admin/`);
  if (!adminHtmlResponse.ok || adminHtmlResponse.headers.get('cache-control') !== 'no-store') throw new Error('Admin HTML shell must never be cached');
  const adminHtml = await adminHtmlResponse.text();
  const versionedRefs = [...adminHtml.matchAll(/\/admin\/(app\.js|styles\.css)\?v=([0-9a-f]{16})/g)];
  if (versionedRefs.length !== 2) throw new Error('Admin HTML must fingerprint app.js and styles.css with a ?v= hash');
  const cssVersion = versionedRefs.find((match) => match[1] === 'styles.css')[2];
  const jsVersion = versionedRefs.find((match) => match[1] === 'app.js')[2];
  for (const [path, version] of [['/admin/styles.css', cssVersion], ['/admin/app.js', jsVersion]]) {
    const assetResponse = await fetch(`${adminOrigin}${path}?v=${version}`);
    if (!assetResponse.ok) throw new Error(`Admin asset ${path} must be served with a ?v= fingerprint`);
    const cacheControl = assetResponse.headers.get('cache-control') ?? '';
    if (!cacheControl.includes('immutable') || !cacheControl.includes('max-age=31536000')) throw new Error(`Admin asset ${path} must be cached immutably; got "${cacheControl}"`);
  }

  const rejectedOrigin = await fetch(`${adminBase}/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: JSON.stringify({ username: 'operator', password: 'integration-admin-password' }),
  });
  if (rejectedOrigin.status !== 403) throw new Error('Admin sign-in must reject untrusted origins');
  const login = await fetch(`${adminBase}/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ username: 'operator', password: 'integration-admin-password' }),
  });
  const loginPayload = await login.json();
  const cookie = login.headers.get('set-cookie')?.split(';', 1)[0];
  if (!login.ok || !cookie || !loginPayload.csrf || !login.headers.get('set-cookie')?.includes('HttpOnly')) throw new Error('Admin sign-in must issue an HttpOnly session and CSRF token');
  const reviewerLogin = await fetch(`${adminBase}/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ username: 'reviewer', password: 'integration-reviewer-password' }),
  });
  const reviewerPayload = await reviewerLogin.json();
  if (!reviewerLogin.ok || reviewerPayload.actor !== 'reviewer' || !reviewerPayload.csrf || !reviewerLogin.headers.get('set-cookie')) throw new Error('Each configured administrator account must be able to sign in independently');
  const missingCsrf = await fetch(`${adminBase}/backups`, { method: 'POST', headers: { cookie, origin: adminOrigin } });
  if (missingCsrf.status !== 403) throw new Error('Admin mutations must require CSRF verification');
  const invalidJsonRequest = await fetch(`${adminOrigin}/town-api/works/query`, {
    method: 'POST', headers: { origin: adminOrigin }, body: '{}',
  });
  if (invalidJsonRequest.status !== 415) throw new Error('JSON proxy endpoints must enforce Content-Type');

  alice = await connect('Alice');
  bob = await connect('Bob');
  await waitFor(alice, 'player.joined', (message) => message.player.id === bob.hello.user.id);
  charlie = await connect('Charlie');
  await waitFor(alice, 'player.joined', (message) => message.player.id === charlie.hello.user.id);

  if (alice.hello.weather !== 'clear') throw new Error(`New residents must receive the current server weather, got ${alice.hello.weather}`);
  const initialWeather = await fetch(`${adminBase}/weather`, { headers: { cookie } });
  const initialWeatherPayload = await initialWeather.json();
  if (!initialWeather.ok || initialWeatherPayload.weather !== 'clear') throw new Error('Admin weather GET must return the current server weather');
  const weatherUpdate = await fetch(`${adminBase}/weather`, {
    method: 'POST',
    headers: { cookie, origin: adminOrigin, 'content-type': 'application/json', 'x-csrf-token': loginPayload.csrf },
    body: JSON.stringify({ weather: 'rain' }),
  });
  const weatherUpdatePayload = await weatherUpdate.json();
  if (!weatherUpdate.ok || weatherUpdatePayload.weather !== 'rain') throw new Error('Admin weather POST must accept a valid weather value');
  for (const client of [alice, bob, charlie]) {
    const weatherMessage = await waitFor(client, 'world.weather', (message) => message.weather === 'rain');
    if (weatherMessage.weather !== 'rain') throw new Error('Weather updates must broadcast the new server weather');
  }
  const restoredWeather = await fetch(`${adminBase}/weather`, {
    method: 'POST',
    headers: { cookie, origin: adminOrigin, 'content-type': 'application/json', 'x-csrf-token': loginPayload.csrf },
    body: JSON.stringify({ weather: 'clear' }),
  });
  if (!restoredWeather.ok) throw new Error('Integration setup must restore the default server weather');

  const overview = await fetch(`${adminBase}/overview`, { headers: { cookie } });
  const overviewPayload = await overview.json();
  if (!overview.ok || overviewPayload.summary.users !== 3 || overviewPayload.online !== 3 || !overviewPayload.integrity.ok) throw new Error('Admin overview must report live and persisted health');
  const backupResponse = await fetch(`${adminBase}/backups`, {
    method: 'POST', headers: { cookie, origin: adminOrigin, 'x-csrf-token': loginPayload.csrf },
  });
  const backupPayload = await backupResponse.json();
  if (backupResponse.status !== 201 || !backupPayload.backup?.name || backupPayload.backup.bytes <= 0) throw new Error('Admin API must create a verified online database backup');
  const sidecarPath = join(dataDir, 'backups', `${backupPayload.backup.name}.manifest.json`);
  const sidecar = existsSync(sidecarPath) ? JSON.parse(readFileSync(sidecarPath, 'utf8')) : null;
  if (!sidecar || sidecar.name !== backupPayload.backup.name || sidecar.sha256 !== backupPayload.backup.sha256) throw new Error('Verified backups must include an immutable checksum sidecar');
  const backupDownload = await fetch(`${adminBase}/backups/${backupPayload.backup.name}`, { headers: { cookie } });
  if (!backupDownload.ok || !backupDownload.headers.get('content-type')?.includes('sqlite') || (await backupDownload.arrayBuffer()).byteLength <= 0) throw new Error('Admin API must download a database backup');
  const backupVerify = await fetch(`${adminBase}/backups/${backupPayload.backup.name}/verify`, {
    method: 'POST', headers: { cookie, origin: adminOrigin, 'x-csrf-token': loginPayload.csrf },
  });
  const backupVerifyPayload = await backupVerify.json();
  if (!backupVerify.ok || !backupVerifyPayload.backup?.verified || backupVerifyPayload.backup.sha256 !== backupPayload.backup.sha256) throw new Error('Admin API must re-verify backup integrity and checksum');

  // Off-site OSS backups: without OSS_ENABLED the endpoints must fail closed,
  // while the authenticated overview must report the feature as disabled.
  const offsiteDisabled = await fetch(`${adminBase}/offsite/backups`, { headers: { cookie } });
  if (offsiteDisabled.status !== 503) throw new Error('Off-site backup endpoints must return 503 when OSS is not configured');
  const offsiteUploadDisabled = await fetch(`${adminBase}/offsite/backups/${backupPayload.backup.name}/upload`, {
    method: 'POST', headers: { cookie, origin: adminOrigin, 'x-csrf-token': loginPayload.csrf },
  });
  if (offsiteUploadDisabled.status !== 503) throw new Error('Off-site backup upload must return 503 when OSS is not configured');
  const overviewWithOffsite = await fetch(`${adminBase}/overview`, { headers: { cookie } });
  const overviewWithOffsitePayload = await overviewWithOffsite.json();
  if (!overviewWithOffsite.ok || overviewWithOffsitePayload.offsite?.enabled !== false) throw new Error('Admin overview must report off-site backups as disabled when OSS is not configured');

  if (alice.hello.progress.currency !== 1200) throw new Error('New residents must receive configured initial currency');
  if (alice.hello.catalog.buildingPrices.activity !== 0) throw new Error('Building unlocks must be free');
  if (alice.hello.catalog.buildingPrices.wushi_restaurant !== 0) throw new Error('The Wushi restaurant must be available in the city catalog');
  if (alice.hello.catalog.buildingUnlockable.litreview !== false) throw new Error('Literature review must remain story-locked');
  if (!alice.hello.progress.unlockedBuildings.includes('writingclub_outer')) throw new Error('The wild mushroom restaurant must be unlocked by default');

  send(bob, { type: 'progress.filmCity.experience' });
  const firstFilmCityExperience = await waitFor(bob, 'progress.updated', (message) => message.event?.type === 'film_city.experience' && message.event.purchased === true);
  if (firstFilmCityExperience.progress.currency !== 800 || firstFilmCityExperience.event.price !== 400) throw new Error('Film city experience must atomically deduct 400 currency');
  send(bob, { type: 'progress.filmCity.experience' });
  await waitFor(bob, 'progress.updated', (message) => message.event?.type === 'film_city.experience' && message.progress.currency === 400);
  send(bob, { type: 'progress.filmCity.experience' });
  await waitFor(bob, 'progress.updated', (message) => message.event?.type === 'film_city.experience' && message.progress.currency === 0);
  send(bob, { type: 'progress.filmCity.experience' });
  await waitFor(bob, 'error', (message) => message.message === 'Insufficient currency');

  send(alice, { type: 'story.get', storyId: 'sample-story' });
  const freshStory = await waitFor(alice, 'story.updated', (message) => message.event?.type === 'story.loaded' && message.story?.storyId === 'sample-story');
  if (freshStory.story.nodeId !== 'start' || freshStory.story.visitCount !== 0 || Object.keys(freshStory.story.flags).length !== 0) throw new Error('New story progress must start from a clean server state');
  send(alice, { type: 'story.update', storyId: 'sample-story', definitionVersion: 3, nodeId: 'first-signal', flags: { heardWhisper: true, signalCount: 1 }, visit: true });
  const storyStep = await waitFor(alice, 'story.updated', (message) => message.event?.type === 'story.updated' && message.story?.nodeId === 'first-signal');
  if (storyStep.story.definitionVersion !== 3 || !storyStep.story.flags.heardWhisper || storyStep.story.flags.signalCount !== 1 || storyStep.story.visitCount !== 1) throw new Error('Story decisions must persist definition version, node, flags, and visit count');
  send(alice, { type: 'story.update', storyId: 'sample-story', ending: 'reconciled', flags: { heardWhisper: false } });
  const storyEnding = await waitFor(alice, 'story.updated', (message) => message.story?.ending === 'reconciled');
  if (storyEnding.story.flags.heardWhisper !== false || storyEnding.story.visitCount !== 1) throw new Error('Story updates must merge flags without resetting other state');

  send(alice, { type: 'progress.building.unlock', buildingId: 'litreview' });
  await waitFor(alice, 'error', (message) => message.message === 'Building is story-locked');
  send(alice, { type: 'progress.building.visit', buildingId: 'litreview' });
  await waitFor(alice, 'error', (message) => message.message === 'Building is story-locked');

  send(alice, { type: 'progress.building.visit', buildingId: 'activity' });
  await waitFor(alice, 'error', (message) => message.message === 'Building is locked');
  send(alice, { type: 'progress.building.unlock', buildingId: 'activity' });
  await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'building.unlocked' && message.event.buildingId === 'activity' && message.progress.currency === 1200);
  send(alice, { type: 'progress.building.visit', buildingId: 'activity' });
  await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'building.visited' && message.progress.visitedBuildings.includes('activity'));
  send(alice, { type: 'progress.building.unlock', buildingId: 'bulletin' });
  await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'building.unlocked' && message.event.buildingId === 'bulletin');
  send(alice, { type: 'progress.building.visit', buildingId: 'bulletin' });
  const secondVisit = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'building.visited' && message.event.buildingId === 'bulletin');
  if (!secondVisit.event.welcomeItemsGranted || secondVisit.progress.inventory.city_guide !== 1 || secondVisit.progress.inventory.city_badge !== 1) throw new Error('Second unique building visit must grant the starter inventory once');
  send(alice, { type: 'progress.building.visit', buildingId: 'bulletin' });
  const duplicateVisit = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'building.visited' && message.event.buildingId === 'bulletin' && message.event.welcomeItemsGranted === false);
  if (duplicateVisit.event.welcomeItemsGranted || duplicateVisit.progress.inventory.city_guide !== 1) throw new Error('Repeated building visits must not duplicate starter items');
  send(alice, { type: 'progress.building.visit', buildingId: 'writingclub_outer' });
  await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'building.visited' && message.event.buildingId === 'writingclub_outer');

  send(alice, { type: 'progress.shop.buy', productId: 'dragonwell_tea', quantity: 2 });
  const purchase = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'shop.purchased');
  if (purchase.progress.inventory.dragonwell_tea !== 2 || purchase.progress.currency !== 1140) throw new Error('Shop purchase must atomically merge inventory and deduct currency');
  send(alice, { type: 'progress.achievement.unlock', achievementId: 'first_building' });
  const achievement = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'achievement.unlocked' && message.event.achievementId === 'first_building');
  if (achievement.event.reward !== 20 || achievement.progress.currency !== 1160) throw new Error('Achievement must grant its configured currency reward');
  send(alice, { type: 'progress.achievement.unlock', achievementId: 'first_building' });
  const duplicateAchievement = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'achievement.unlocked' && message.event.achievementId === 'first_building' && message.event.reward === 0);
  if (duplicateAchievement.progress.currency !== 1160) throw new Error('Achievement rewards must be idempotent');
  send(alice, { type: 'progress.achievement.unlock', achievementId: 'walker_500' });
  const unverifiedAchievement = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'achievement.unlocked' && message.event.achievementId === 'walker_500');
  if (unverifiedAchievement.event.reward !== 0 || unverifiedAchievement.progress.currency !== 1160) throw new Error('Client-only achievement claims must not mint currency');
  send(alice, { type: 'progress.item.consume', itemId: 'dragonwell_tea', quantity: 1 });
  const consumed = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'item.consumed');
  if (consumed.progress.inventory.dragonwell_tea !== 1) throw new Error('Consuming an item must persist the remaining quantity');
  send(alice, { type: 'progress.item.consume', itemId: 'dragonwell_tea', quantity: 1 });
  const consumedLast = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'item.consumed' && message.progress.inventory.dragonwell_tea === undefined);
  if ('dragonwell_tea' in consumedLast.progress.inventory) throw new Error('Consuming the last item must remove its inventory row');
  send(alice, { type: 'progress.reward.claim', rewardId: 'mandarin_daily' });
  const daily = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'reward.claimed' && message.event.claimed === true);
  if (daily.progress.inventory.mandarin !== 1) throw new Error('Daily reward must grant one item');
  send(alice, { type: 'progress.reward.claim', rewardId: 'mandarin_daily' });
  const repeatedDaily = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'reward.claimed' && message.event.claimed === false);
  if (repeatedDaily.progress.inventory.mandarin !== 1) throw new Error('Daily reward must only be granted once per Shanghai day');
  send(alice, { type: 'progress.reward.claim', rewardId: 'tirpitz_beach' });
  const beachReward = await waitFor(alice, 'progress.updated', (message) => message.event?.rewardId === 'tirpitz_beach' && message.event.claimed === true);
  if (beachReward.progress.inventory.tirpitz_card !== 1) throw new Error('Beach reward must grant the Tirpitz card');
  send(alice, { type: 'progress.reward.claim', rewardId: 'tirpitz_beach' });
  const repeatedBeachReward = await waitFor(alice, 'progress.updated', (message) => message.event?.rewardId === 'tirpitz_beach' && message.event.claimed === false);
  if (repeatedBeachReward.progress.inventory.tirpitz_card !== 1) throw new Error('Beach reward must only be granted once');

  send(bob, { type: 'position', position: { x: 3, y: 0, z: 4, rotation: 1 } });
  await waitFor(alice, 'player.moved', (message) => message.playerId === bob.hello.user.id && message.position.x === 3);

  send(alice, { type: 'chat', text: 'integration-chat' });
  const approvedChat = await waitFor(bob, 'chat', (message) => message.text === 'integration-chat');
  if (!Number.isInteger(approvedChat.messageId)) throw new Error('Chat broadcasts must include a persisted message id');
  await poll(
    () => fetch(`${adminBase}/chat?hidden=1`, { headers: { cookie } }).then((response) => response.json()),
    (payload) => payload.items?.some((item) => item.id === approvedChat.messageId && item.moderationStatus === 'approved'),
    'approved chat moderation',
  );

  send(alice, { type: 'chat', text: 'integration-blocked' });
  const blockedChat = await waitFor(bob, 'chat', (message) => message.text === 'integration-blocked');
  await waitFor(bob, 'chat.removed', (message) => message.messageId === blockedChat.messageId && message.reason === 'moderation');
  const moderatedChat = await poll(
    () => fetch(`${adminBase}/chat?hidden=1`, { headers: { cookie } }).then((response) => response.json()),
    (payload) => payload.items?.some((item) => item.id === blockedChat.messageId && item.moderationStatus === 'rejected'),
    'rejected chat audit trail',
  );
  const rejectedRecord = moderatedChat.items.find((item) => item.id === blockedChat.messageId);
  if (!rejectedRecord.hiddenAt || rejectedRecord.hiddenBy !== 'system:bigmodel' || rejectedRecord.moderationRiskTypes[0] !== 'test-policy-violation' || !rejectedRecord.moderationRequestId) {
    throw new Error('Rejected chat must retain the provider decision while becoming hidden');
  }
  const moderationAudit = await fetch(`${adminBase}/audit`, { headers: { cookie } }).then((response) => response.json());
  if (!moderationAudit.items?.some((item) => item.action === 'chat.moderation.reject' && item.target === String(blockedChat.messageId))) {
    throw new Error('Rejected chat must create an administrator audit record');
  }
  if (!moderationRequests.some((request) => request.body.model === 'moderation' && request.body.input === 'integration-blocked')) {
    throw new Error('Chat moderation must call the BigModel moderation endpoint');
  }

    // ── 身份与昵称校验 ─────────────────────────────────────────────
  const oneChar = await connectExpectingError('A');
  if (!oneChar) throw new Error('One-character nickname should be rejected');
  const specialChars = await connectExpectingError('小明!');
  if (!specialChars) throw new Error('Special characters should be rejected');
  const noPassword = await connectExpectingError('小王', '');
  if (!noPassword) throw new Error('Missing password should be rejected');
  const wrongPassword = await connectExpectingError('Alice', 'wrong-pass');
  if (!wrongPassword) throw new Error('Wrong password should be rejected');

  const buildingId = 'residence:3.00:4.00';
  send(alice, { type: 'housing.claim', buildingId, name: 'Integration Home' });
  await waitFor(bob, 'housing.updated', (message) => message.houses.some((house) => house.buildingId === buildingId));
  send(alice, { type: 'housing.kick', buildingId, userId: {} });
  await waitFor(alice, 'error', (message) => message.message === 'Invalid member');
  const healthAfterMaliciousMessage = await fetch(`${adminOrigin}/healthz`);
  if (!healthAfterMaliciousMessage.ok) throw new Error('Malformed housing messages must not terminate the server');
  send(bob, { type: 'housing.apply', buildingId });
  const application = await waitFor(alice, 'housing.requests', (message) => message.requests.some((request) => request.kind === 'application' && request.requesterId === bob.hello.user.id));
  send(alice, { type: 'housing.accept', requestId: application.requests.find((request) => request.kind === 'application').id });
  await waitFor(bob, 'housing.updated', (message) => message.houses.some((house) => house.members.length === 2));

  send(alice, { type: 'housing.invite', buildingId, userId: charlie.hello.user.id });
  const invitation = await waitFor(charlie, 'housing.requests', (message) => message.requests.some((request) => request.kind === 'invite' && request.requesterId === alice.hello.user.id));
  send(charlie, { type: 'housing.decline', requestId: invitation.requests.find((request) => request.kind === 'invite').id });
  charlie.messages.length = 0;
  await waitFor(charlie, 'housing.requests', (message) => !message.requests.some((request) => request.kind === 'invite'));
  send(alice, { type: 'housing.invite', buildingId, userId: charlie.hello.user.id });
  const secondInvitation = await waitFor(charlie, 'housing.requests', (message) => message.requests.some((request) => request.kind === 'invite' && request.requesterId === alice.hello.user.id));
  send(charlie, { type: 'housing.accept', requestId: secondInvitation.requests.find((request) => request.kind === 'invite').id });
  await waitFor(alice, 'housing.updated', (message) => message.houses.some((house) => house.members.length === 3));
  alice.messages.length = 0;
  const editHouseMembers = await fetch(`${adminBase}/houses/${encodeURIComponent(buildingId)}`, {
    method: 'PATCH',
    headers: { cookie, origin: adminOrigin, 'content-type': 'application/json', 'x-csrf-token': loginPayload.csrf },
    body: JSON.stringify({ name: 'Integration Home', memberIds: [alice.hello.user.id, bob.hello.user.id] }),
  });
  if (!editHouseMembers.ok) throw new Error('Administrator must be able to remove a house member');
  await waitFor(alice, 'housing.updated', (message) => message.houses.some((house) => house.buildingId === buildingId && house.members.length === 2 && !house.members.some((member) => member.userId === charlie.hello.user.id)));
  send(alice, { type: 'housing.transfer', buildingId, userId: bob.hello.user.id });
  await waitFor(bob, 'housing.updated', (message) => message.houses.some((house) => house.ownerId === bob.hello.user.id));
  send(bob, { type: 'housing.release', buildingId });
  await waitFor(alice, 'housing.updated', (message) => !message.houses.some((house) => house.buildingId === buildingId));

  const adminDeletedBuildingId = 'residence:8.00:4.00';
  send(bob, { type: 'housing.claim', buildingId: adminDeletedBuildingId, name: 'Admin Deleted Home' });
  await waitFor(alice, 'housing.updated', (message) => message.houses.some((house) => house.buildingId === adminDeletedBuildingId));
  alice.messages.length = 0;
  const deleteHouse = await fetch(`${adminBase}/houses/${encodeURIComponent(adminDeletedBuildingId)}`, {
    method: 'DELETE', headers: { cookie, origin: adminOrigin, 'x-csrf-token': loginPayload.csrf },
  });
  if (!deleteHouse.ok) throw new Error('Administrator must be able to delete a house');
  await waitFor(alice, 'housing.updated', (message) => !message.houses.some((house) => house.buildingId === adminDeletedBuildingId));
  const housesAfterAdminDelete = await fetch(`${adminBase}/houses`, { headers: { cookie } }).then((response) => response.json());
  if (housesAfterAdminDelete.items.some((house) => house.buildingId === adminDeletedBuildingId)) throw new Error('Deleted houses must be removed from the admin housing list');

  // 相同昵称+正确密码登录返回同一个全局唯一 ID
  const aliceAgain = await connect('Alice');
  if (aliceAgain.hello.user.id !== alice.hello.user.id) throw new Error('Logging in again with the same nickname must restore the same user ID');
  if (aliceAgain.hello.user.id === bob.hello.user.id) throw new Error('Different residents must not share an ID');
  if ('dragonwell_tea' in aliceAgain.hello.progress.inventory || !aliceAgain.hello.progress.achievements.includes('first_building') || !aliceAgain.hello.progress.unlockedBuildings.includes('activity')) throw new Error('Cloud progression must survive reconnecting');
  send(aliceAgain, { type: 'story.get', storyId: 'sample-story' });
  const restoredStory = await waitFor(aliceAgain, 'story.updated', (message) => message.event?.type === 'story.loaded' && message.story?.storyId === 'sample-story');
  if (restoredStory.story.definitionVersion !== 3 || restoredStory.story.nodeId !== 'first-signal' || restoredStory.story.ending !== 'reconciled' || restoredStory.story.visitCount !== 1 || restoredStory.story.flags.heardWhisper !== false || restoredStory.story.flags.signalCount !== 1) throw new Error('Story progress must survive reconnecting');
  aliceAgain.socket.close();

  const disableCharlie = await fetch(`${adminBase}/users/${charlie.hello.user.id}/status`, {
    method: 'PATCH', headers: { cookie, origin: adminOrigin, 'content-type': 'application/json', 'x-csrf-token': loginPayload.csrf },
    body: JSON.stringify({ disabled: true }),
  });
  if (!disableCharlie.ok) throw new Error('Administrator must be able to disable a resident');
  await waitForClose(charlie);
  const disabledLogin = await connectExpectingError('Charlie');
  if (!disabledLogin) throw new Error('Disabled residents must not be able to sign in');

  // Telemetry: public collection + admin visibility.
  const eventPost = await fetch(`${adminOrigin}/town-api/telemetry/event`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ event: 'integration.test', sessionId: 'sess-1', properties: { ok: true } }),
  });
  if (eventPost.status !== 202) throw new Error('Telemetry event collection must accept valid payloads');
  const badEvent = await fetch(`${adminOrigin}/town-api/telemetry/event`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ event: 'bad name!', sessionId: 'sess-1' }),
  });
  if (badEvent.status !== 400) throw new Error('Telemetry collection must reject malformed event names');
  const errorPost = await fetch(`${adminOrigin}/town-api/telemetry/error`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ kind: 'runtime', message: 'integration failure', sessionId: 'sess-1' }),
  });
  if (errorPost.status !== 202) throw new Error('Telemetry error collection must accept valid payloads');
  const telemetryOverview = await fetch(`${adminBase}/telemetry/overview`, { headers: { cookie } });
  const telemetryOverviewPayload = await telemetryOverview.json();
  if (!telemetryOverview.ok || telemetryOverviewPayload.events.total < 1 || telemetryOverviewPayload.errors.total < 1) throw new Error('Admin telemetry overview must surface collected events and errors');
  const eventList = await fetch(`${adminBase}/telemetry/events?limit=10`, { headers: { cookie } });
  const eventListPayload = await eventList.json();
  if (!eventList.ok || !eventListPayload.items.some((item) => item.event === 'integration.test')) throw new Error('Admin telemetry events list must include the recorded event');
  const errorList = await fetch(`${adminBase}/telemetry/errors?limit=10`, { headers: { cookie } });
  const errorListPayload = await errorList.json();
  if (!errorList.ok || !errorListPayload.items.some((item) => item.message === 'integration failure')) throw new Error('Admin telemetry errors list must include the recorded error');
  const health = await fetch(`${adminBase}/telemetry/health`, { headers: { cookie } });
  const healthPayload = await health.json();
  if (!health.ok || healthPayload.counters.httpRequests < 1) throw new Error('Admin telemetry health must report server metrics');
  const logs = await fetch(`${adminBase}/telemetry/logs?lines=50`, { headers: { cookie } });
  const logsPayload = await logs.json();
  if (!logs.ok || !Array.isArray(logsPayload.lines)) throw new Error('Admin telemetry logs must return a line array');
  const clearTelemetry = await fetch(`${adminBase}/telemetry/clear`, { method: 'POST', headers: { cookie, origin: adminOrigin, 'x-csrf-token': loginPayload.csrf } });
  if (!clearTelemetry.ok) throw new Error('Admin telemetry clear must require CSRF and succeed');

  // NPC change requests: player submits a ticket, admin reviews the queue.
  const publicNpcCatalog = await fetch(`${adminOrigin}/town-api/npc-edit-catalog`);
  const publicNpcCatalogPayload = await publicNpcCatalog.json();
  if (!publicNpcCatalog.ok || !Array.isArray(publicNpcCatalogPayload.items) || !publicNpcCatalogPayload.items.some((npc) => npc.id === 'linche')) throw new Error('NPC edit page must load the public NPC catalog');
  const catalogIdentity = publicNpcCatalogPayload.items.find((npc) => npc.id === 'linche');
  if (!catalogIdentity || typeof catalogIdentity.name !== 'string' || typeof catalogIdentity.role !== 'string' || typeof catalogIdentity.npcType !== 'string' || 'dialogNodes' in catalogIdentity) throw new Error('NPC edit catalog must expose only trimmed identity fields');
  const npcEditLogin = await fetch(`${adminOrigin}/town-api/npc-edit-login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ nickname: 'NpcEditor', password: 'npc-edit-test-password' }),
  });
  const npcEditLoginPayload = await npcEditLogin.json();
  if (!npcEditLogin.ok || !npcEditLoginPayload.token || npcEditLoginPayload.user?.nickname !== 'NpcEditor') throw new Error('NPC edit page must support independent resident sign-in');
  const tokenRestore = await fetch(`${adminOrigin}/town-api/npc-edit-login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ token: npcEditLoginPayload.token }),
  });
  const tokenRestorePayload = await tokenRestore.json();
  if (!tokenRestore.ok || tokenRestorePayload.user?.nickname !== 'NpcEditor') throw new Error('NPC edit page must restore a session from a stored token');
  const npcEditSubmission = await fetch(`${adminOrigin}/town-api/npc-change-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ token: npcEditLoginPayload.token, npcId: 'linche', kind: 'edit', title: '补充林澈资料', summary: '建议补充工作时间。', change: { proposal: '增加工作时间字段。' } }),
  });
  if (npcEditSubmission.status !== 201) throw new Error('Independent NPC edit sign-in must submit to the review queue');

  // Reconnect a resident here to obtain a fresh, valid session token (earlier
  // reconnects invalidate previously issued tokens).
  requester = await connect('Dana');
  const requesterToken = requester.hello.token;
  if (!requesterToken) throw new Error('Server hello must issue a session token for authenticated residents');
  const unauthenticatedNpcRequest = await fetch(`${adminOrigin}/town-api/npc-change-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ npcId: 'linche', kind: 'dialog', title: 'No token', summary: 'should fail' }),
  });
  if (unauthenticatedNpcRequest.status !== 401) throw new Error('NPC change request submission must require authentication');
  const invalidKind = await fetch(`${adminOrigin}/town-api/npc-change-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ token: requesterToken, npcId: 'linche', kind: 'bogus', title: 'Bad kind', summary: 'should fail' }),
  });
  if (invalidKind.status !== 400) throw new Error('NPC change request submission must reject invalid change kind');
  const unknownNpc = await fetch(`${adminOrigin}/town-api/npc-change-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ token: requesterToken, npcId: 'does_not_exist', kind: 'edit', title: 'Unknown NPC', summary: 'should fail' }),
  });
  if (unknownNpc.status !== 400) throw new Error('NPC change request submission must reject unknown NPC for non-add kinds');
  // Reuse the NPC editor session (no new registration, which would hit the
  // per-IP registration cap) for the add/change-validation cases below.
  const addEditorToken = npcEditLoginPayload.token;
  const addWithoutName = await fetch(`${adminOrigin}/town-api/npc-change-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ token: addEditorToken, npcId: 'proposal-new', kind: 'add', title: '新增 NPC', summary: '忘记填名称。' }),
  });
  if (addWithoutName.status !== 400) throw new Error('NPC change request submission must require a proposed name for the add kind');
  const badChangeType = await fetch(`${adminOrigin}/town-api/npc-change-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ token: addEditorToken, npcId: 'linche', kind: 'edit', title: '坏 change', summary: 'should fail', change: { proposal: 123 } }),
  });
  if (badChangeType.status !== 400) throw new Error('NPC change request submission must reject a non-string change field');
  const addSubmission = await fetch(`${adminOrigin}/town-api/npc-change-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ token: addEditorToken, npcId: 'proposal-new', kind: 'add', title: '新增报刊亭老板', summary: '希望增加一个常驻 NPC。', change: { proposedName: '报刊亭老板' } }),
  });
  const addPayload = await addSubmission.json();
  if (addSubmission.status !== 201 || !addPayload.ok) throw new Error('NPC change request submission must accept an add kind with a proposed name');
  const submitted = await fetch(`${adminOrigin}/town-api/npc-change-requests`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ token: requesterToken, npcId: 'linche', kind: 'dialog', title: '润色林澈开场白', summary: '建议把第一句改得更柔和。' }),
  });
  const submittedPayload = await submitted.json();
  if (submitted.status !== 201 || !submittedPayload.ok || !submittedPayload.id) throw new Error('Authenticated NPC change request submission must succeed and return an id');

  const npcCatalog = await fetch(`${adminBase}/npcs`, { headers: { cookie } });
  const npcCatalogPayload = await npcCatalog.json();
  if (!npcCatalog.ok || !Array.isArray(npcCatalogPayload.items) || npcCatalogPayload.items.length === 0) throw new Error('Admin NPC catalog must return the read-only NPC mirror');
  if (!npcCatalogPayload.items.some((npc) => npc.id === 'linche')) throw new Error('Admin NPC catalog must include the story NPC linche');

  const pendingRequests = await fetch(`${adminBase}/npc-change-requests?status=pending`, { headers: { cookie } });
  const pendingPayload = await pendingRequests.json();
  if (!pendingRequests.ok || !pendingPayload.items.some((item) => item.id === submittedPayload.id && item.status === 'pending')) throw new Error('Admin NPC change request queue must list the pending ticket');

  const approve = await fetch(`${adminBase}/npc-change-requests/${submittedPayload.id}/approve`, {
    method: 'POST', headers: { cookie, origin: adminOrigin, 'x-csrf-token': loginPayload.csrf },
    body: JSON.stringify({ note: '已记录' }),
  });
  const approvePayload = await approve.json();
  if (!approve.ok || !approvePayload.ok || approvePayload.request.status !== 'approved') throw new Error('Admin must be able to approve a pending NPC change request');
  const reApprove = await fetch(`${adminBase}/npc-change-requests/${submittedPayload.id}/approve`, {
    method: 'POST', headers: { cookie, origin: adminOrigin, 'x-csrf-token': loginPayload.csrf },
    body: JSON.stringify({}),
  });
  if (reApprove.status !== 404) throw new Error('Admin must not be able to review an already-processed NPC change request');

  // Story topology: read-only graph data for the topology page.
  const topology = await fetch(`${adminBase}/story-topology?storyId=${encodeURIComponent('main.echo.act-one')}`, { headers: { cookie } });
  const topologyPayload = await topology.json();
  if (!topology.ok || !topologyPayload.summary || !Array.isArray(topologyPayload.summary.nodes) || !Array.isArray(topologyPayload.summary.edges) || topologyPayload.summary.nodes.length === 0) throw new Error('Admin story topology must return populated nodes and edges for the echo story');
  if (topologyPayload.summary.nodes.length !== 18) throw new Error(`Admin story topology should list exactly 18 savepoint nodes, got ${topologyPayload.summary.nodes.length}`);
  if (topologyPayload.summary.definitionVersion !== 13) throw new Error(`Admin story topology should report definitionVersion 13, got ${topologyPayload.summary.definitionVersion}`);
  const storyCatalog = await fetch(`${adminBase}/stories`, { headers: { cookie } });
  const storyCatalogPayload = await storyCatalog.json();
  if (!storyCatalog.ok || !storyCatalogPayload.items?.some((story) => story.id === 'main.echo.act-one' && story.nodes.length > 0)) throw new Error('Admin story catalog must expose node details even when no resident progress matches');
  const topologyHtml = await fetch(`${adminOrigin}/admin/story-topology`);
  if (!topologyHtml.ok || topologyHtml.headers.get('cache-control') !== 'no-store') throw new Error('Story topology HTML shell must be served without caching');

  console.log('Integration passed: production fail-closed, origin/CSRF, identity, chat moderation, progression, malicious messages, admin, verified backups, housing, lifecycle, telemetry, NPC change workflow, and story topology');
} finally {
  alice?.socket.close();
  bob?.socket.close();
  charlie?.socket.close();
  requester?.socket.close();
  if (server.exitCode === null && server.signalCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await exited;
  }
  await new Promise((resolve) => moderationServer.close(resolve));
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      rmSync(dataDir, { recursive: true, force: true });
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
