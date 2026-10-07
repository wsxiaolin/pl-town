// 烟花玩法 + 城市主题下发的服务端集成测试。
// 覆盖：hello 携带 theme；烟花保存 30 金币扣款与幂等重放；非法设计/名称
// 拒绝；清单（own + community）；删除不退款；仓库上限；fireworks.library
// 广播；admin 设置主题并推送给在线居民（world.theme + 后续 hello）。
//
//   node tests/fireworks.mjs   （先 npm run build）
//
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import WebSocket from 'ws';
import assert from 'node:assert/strict';

const port = 8795;
const physicsLabPort = 8797;
// 物实社区 API stub：GetUser 一律 404（昵称不占用），匿名 Authenticate
// 发可用的 Token/AuthCode——避免测试触达真实上游。
const physicsLabServer = createServer((request, response) => {
  let raw = '';
  request.on('data', (chunk) => { raw += chunk; });
  request.on('end', () => {
    const reply = (status, payload) => { response.writeHead(status, { 'content-type': 'application/json' }); response.end(JSON.stringify(payload)); };
    if (request.url === '/Users/Authenticate') {
      const body = JSON.parse(raw || '{}');
      if (body.Login == null && body.Password == null) return reply(200, { Status: 200, Message: '', Token: 'stub-token', AuthCode: 'stub-auth-code', Data: null });
      return reply(403, { Status: 403, Message: 'Login.Password.Invalid', Data: null });
    }
    return reply(404, { Status: 404, Message: 'Standard.404', Data: null });
  });
});
await new Promise((resolve, reject) => {
  physicsLabServer.once('error', reject);
  physicsLabServer.listen(physicsLabPort, '127.0.0.1', resolve);
});
const dataDir = mkdtempSync(join(tmpdir(), 'minicity-fireworks-'));
const server = spawn(process.execPath, ['dist/index.js'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env, PORT: String(port), DATA_DIR: dataDir,
    ADMIN_USERNAME: 'operator', ADMIN_PASSWORD: 'fireworks-admin-password',
    AUTO_BACKUP_ENABLED: 'false', ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
    MAX_REGISTRATIONS_PER_IP: '12',
    PHYSICS_LAB_API_BASE: `http://127.0.0.1:${physicsLabPort}`,
  },
  stdio: ['ignore', 'pipe', 'inherit'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput = `${serverOutput}${chunk}`.slice(-8192); });

const waitForServer = () => new Promise((resolve, reject) => {
  if (serverOutput.includes('listening')) { resolve(); return; }
  const timeout = setTimeout(() => reject(new Error(`Server did not start: ${serverOutput}`)), 8_000);
  server.stdout.on('data', (chunk) => {
    if (chunk.toString().includes('listening')) { clearTimeout(timeout); server.stdout.removeAllListeners('data'); resolve(); }
  });
  server.once('exit', (code, signal) => { clearTimeout(timeout); reject(new Error(`Server exited (code=${code}, signal=${signal}): ${serverOutput}`)); });
});

const connect = (nickname, password = 'resident-secret') => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const messages = [];
  const timeout = setTimeout(() => { socket.terminate(); reject(new Error(`Timed out waiting for hello for ${nickname}`)); }, 5_000);
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    messages.push(message);
    if (message.type === 'hello') { clearTimeout(timeout); resolve({ socket, hello: message, messages }); }
    // 仅 hello 之前的 error 是认证失败；hello 之后的是被测场景的业务拒绝。
    else if (message.type === 'error' && !messages.some((entry) => entry.type === 'hello')) { clearTimeout(timeout); socket.terminate(); reject(new Error(`Auth error for ${nickname}: ${message.message}`)); }
  });
  socket.on('error', (event) => { clearTimeout(timeout); reject(event); });
  socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', nickname, password })));
});

const waitFor = (client, type, predicate = () => true, since = 0) => new Promise((resolve, reject) => {
  const existing = client.messages.slice(Math.max(0, since)).find((message) => message.type === type && predicate(message));
  if (existing) return resolve(existing);
  const timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${type} (recent=[${client.messages.slice(-4).map((message) => message.type).join(' | ')}])`)), 8_000);
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

// 与 web 端 encodePatternCells 相同的位打包：base64，低 bit 在前。
function encodeCells(onCells) {
  const total = 21 * 21;
  const bytes = Buffer.alloc(Math.ceil(total / 8));
  for (const index of onCells) bytes[index >> 3] |= 1 << (index & 7);
  return bytes.toString('base64');
}

const baseDesign = {
  v: 1, height: 55, shape: 'peony',
  colors: { primary: '#ffd76e', secondary: '#ff5f8a', trail: '#ffe9b0' },
  size: 100, sparkle: 35,
};

let failures = 0;
async function main() {
  await waitForServer();

  // ── hello 携带默认主题 ──
  const alice = await connect('alice');
  assert.equal(alice.hello.theme?.id, 'default', 'hello must carry the default theme');
  const startingBalance = alice.hello.progress.currency;

  // ── 保存烟花：扣 30 金币 ──
  send(alice, { type: 'fireworks.save', requestId: 'fw-save-1', name: '  第一朵  ', design: baseDesign });
  const saved = await waitFor(alice, 'fireworks.saved');
  assert.equal(saved.pricePaid, 30);
  assert.equal(saved.replayed, false);
  assert.equal(saved.record.name, '第一朵', 'name is trimmed');
  assert.equal(saved.record.authorNickname, 'alice');
  assert.equal(saved.progress.currency, startingBalance - 30, 'save charges 30 coins');
  const designId = saved.record.id;

  // ── 同 requestId 重放：不重复扣款 ──
  send(alice, { type: 'fireworks.save', requestId: 'fw-save-1', name: '第一朵', design: baseDesign });
  const replayed = await waitFor(alice, 'fireworks.saved', (message) => message.replayed === true);
  assert.equal(replayed.record.id, designId, 'replay returns the same design');
  assert.equal(replayed.progress.currency, startingBalance - 30, 'replay does not double charge');

  // ── 非法载荷拒绝 ──
  const invalidCases = [
    { type: 'fireworks.save', requestId: 'fw-bad-1', name: '坏形状', design: { ...baseDesign, shape: 'dragon' } },
    { type: 'fireworks.save', requestId: 'fw-bad-2', name: '坏高度', design: { ...baseDesign, height: 200 } },
    { type: 'fireworks.save', requestId: 'fw-bad-3', name: '坏颜色', design: { ...baseDesign, colors: { ...baseDesign.colors, primary: 'red' } } },
    { type: 'fireworks.save', requestId: 'fw-bad-4', name: '', design: baseDesign },
    { type: 'fireworks.save', requestId: 'fw-bad-5', name: 'x'.repeat(21), design: baseDesign },
    { type: 'fireworks.save', requestId: 'fw-bad-6', name: '坏点阵', design: { ...baseDesign, shape: 'pattern', pattern: { cols: 21, rows: 21, cells: '!!!' } } },
    { type: 'fireworks.save', requestId: 'fw-bad-7', name: '实心块', design: { ...baseDesign, shape: 'pattern', pattern: { cols: 21, rows: 21, cells: encodeCells([...Array(21 * 21).keys()]) } } },
    { type: 'fireworks.save', name: '无幂等键', design: baseDesign },
    { type: 'fireworks.save', requestId: 'fw-bad-9', name: '太密', design: { ...baseDesign, size: 999 } },
  ];
  let marked = 0;
  for (const invalid of invalidCases) {
    marked = alice.messages.length;
    send(alice, invalid);
    const error = await waitFor(alice, 'error', () => true, marked);
    assert.ok(error.message, `invalid payload must be rejected: ${JSON.stringify(invalid).slice(0, 60)}`);
  }

  // ── 点阵拼字烟花保存成功 ──
  marked = alice.messages.length;
  const patternCells = [];
  // 在 21×21 网格上画一个「十」字：中列 + 中行。
  for (let row = 0; row < 21; row += 1) patternCells.push(row * 21 + 10);
  for (let col = 0; col < 21; col += 1) patternCells.push(10 * 21 + col);
  send(alice, { type: 'fireworks.save', requestId: 'fw-save-2', name: '十字星', design: { ...baseDesign, shape: 'pattern', pattern: { cols: 21, rows: 21, cells: encodeCells([...new Set(patternCells)]) } } });
  const patternSaved = await waitFor(alice, 'fireworks.saved', (message) => message.record?.name === '十字星', marked);
  assert.equal(patternSaved.record.design.shape, 'pattern');
  assert.equal(patternSaved.progress.currency, startingBalance - 60);

  // ── 清单：own 与 community ──
  send(alice, { type: 'fireworks.list' });
  const listed = await waitFor(alice, 'fireworks.listed');
  assert.equal(listed.own.length, 2);
  assert.equal(listed.community.length, 2);
  assert.ok(listed.community.every((record) => record.authorNickname === 'alice'));

  // ── 其他居民连接：广播 fireworks.library + 主题默认 ──
  const bob = await connect('bob');
  assert.equal(bob.hello.theme?.id, 'default');
  marked = bob.messages.length;
  send(alice, { type: 'fireworks.save', requestId: 'fw-save-3', name: '广播之星', design: { ...baseDesign, height: 70 } });
  await waitFor(alice, 'fireworks.saved', (message) => message.record?.name === '广播之星');
  const libraryPush = await waitFor(bob, 'fireworks.library', () => true, marked);
  assert.ok(libraryPush.revision, 'library broadcast carries a revision');

  // ── 删除自己的设计（不退款）──
  marked = alice.messages.length;
  send(alice, { type: 'fireworks.delete', designId });
  await waitFor(alice, 'fireworks.deleted', () => true, marked);
  await waitFor(alice, 'fireworks.library', () => true, marked);
  send(alice, { type: 'fireworks.list' });
  const listedAfterDelete = await waitFor(alice, 'fireworks.listed', (message) => message.own?.length === 2, marked);
  assert.equal(listedAfterDelete.own.length, 2, 'one design deleted (3 saved - 1)');
  assert.ok(listedAfterDelete.own.every((record) => record.id !== designId), 'deleted design is gone from the list');

  // ── 仓库上限：存满 24 份后拒绝第 25 份 ──
  // alice 当前云端 2 份；再存 22 份到满（每次 30 金币；直接改库补足余额，
  // 绕开 dist/db.js 的进程运行锁——WAL 允许并发短写）。
  const rawDb = new Database(join(dataDir, 'minicity.sqlite'));
  rawDb.pragma('busy_timeout = 5000');
  rawDb.prepare('UPDATE player_progress SET currency = 5000 WHERE user_id = ?').run(alice.hello.user.id);
  rawDb.close();
  for (let index = 0; index < 22; index += 1) {
    marked = alice.messages.length;
    send(alice, { type: 'fireworks.save', requestId: `fw-cap-${index}`, name: `编队 ${index}`, design: { ...baseDesign, height: 30 + index } });
    await waitFor(alice, 'fireworks.saved', (message) => message.record?.name === `编队 ${index}`, marked);
  }
  marked = alice.messages.length;
  send(alice, { type: 'fireworks.list' });
  await waitFor(alice, 'fireworks.listed', () => true, marked);
  marked = alice.messages.length;
  send(alice, { type: 'fireworks.save', requestId: 'fw-cap-overflow', name: '超编', design: baseDesign });
  const overflowError = await waitFor(alice, 'error', () => true, marked);
  assert.match(overflowError.message, /烟花仓库已满/);

  // ── 余额不足 ──
  const rawDb2 = new Database(join(dataDir, 'minicity.sqlite'));
  rawDb2.pragma('busy_timeout = 5000');
  rawDb2.prepare('UPDATE player_progress SET currency = 10 WHERE user_id = ?').run(bob.hello.user.id);
  rawDb2.close();
  marked = bob.messages.length;
  send(bob, { type: 'fireworks.save', requestId: 'fw-broke', name: '穷烟花', design: baseDesign });
  const brokeError = await waitFor(bob, 'error', () => true, marked);
  assert.match(brokeError.message, /余额不足/);

  // ── admin 主题下发：广播 + 后续 hello ──
  const adminOrigin = `http://127.0.0.1:${port}`;
  const adminBase = `${adminOrigin}/admin/api`;
  const adminLogin = await fetch(`${adminBase}/login`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: adminOrigin },
    body: JSON.stringify({ username: 'operator', password: 'fireworks-admin-password' }),
  });
  const loginPayload = await adminLogin.json();
  const cookie = adminLogin.headers.get('set-cookie')?.split(';', 1)[0];
  assert.ok(adminLogin.ok && cookie && loginPayload.csrf, 'admin sign-in must succeed');
  const adminHeaders = { cookie, origin: adminOrigin, 'x-csrf-token': loginPayload.csrf, 'content-type': 'application/json' };

  const worldBefore = await fetch(`${adminBase}/world`, { headers: { cookie } });
  assert.equal((await worldBefore.json()).theme?.id, 'default');

  marked = bob.messages.length;
  const setTheme = await fetch(`${adminBase}/world/theme`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ theme: 'spring-festival' }),
  });
  assert.equal(setTheme.status, 200, await setTheme.text());
  const themePush = await waitFor(bob, 'world.theme', () => true, marked);
  assert.equal(themePush.theme?.id, 'spring-festival', 'online residents receive world.theme push');

  const themeReject = await fetch(`${adminBase}/world/theme`, {
    method: 'POST', headers: adminHeaders,
    body: JSON.stringify({ theme: 'christmas' }),
  });
  assert.equal(themeReject.status, 400);

  const carol = await connect('carol');
  assert.equal(carol.hello.theme?.id, 'spring-festival', 'new connections receive the active theme in hello');

  console.log('fireworks integration: all assertions passed');
}

main()
  .catch((error) => { failures = 1; console.error(error); })
  .finally(() => {
    server.kill();
    writeFileSync(join(tmpdir(), 'minicity-fireworks-server.log'), serverOutput);
    setTimeout(() => process.exit(failures), 200);
  });
