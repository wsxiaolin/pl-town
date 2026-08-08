import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const port = 8791;
const dataDir = mkdtempSync(join(tmpdir(), 'minicity-server-'));
const server = spawn(process.execPath, ['dist/index.js'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, PORT: String(port), DATA_DIR: dataDir },
  stdio: ['ignore', 'pipe', 'inherit'],
});

const connect = (nickname, password = 'secret') => new Promise((resolve, reject) => {
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

const connectExpectingError = (nickname, password = 'secret') => new Promise((resolve, reject) => {
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

let alice;
let bob;
let charlie;
try {
  await waitForServer();
  alice = await connect('Alice');
  bob = await connect('Bob');
  await waitFor(alice, 'player.joined', (message) => message.player.id === bob.hello.user.id);
  charlie = await connect('Charlie');
  await waitFor(alice, 'player.joined', (message) => message.player.id === charlie.hello.user.id);

  send(bob, { type: 'position', position: { x: 3, y: 0, z: 4, rotation: 1 } });
  await waitFor(alice, 'player.moved', (message) => message.playerId === bob.hello.user.id && message.position.x === 3);

  send(alice, { type: 'chat', text: 'integration-chat' });
  await waitFor(bob, 'chat', (message) => message.text === 'integration-chat');

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
  send(alice, { type: 'housing.transfer', buildingId, userId: bob.hello.user.id });
  await waitFor(bob, 'housing.updated', (message) => message.houses.some((house) => house.ownerId === bob.hello.user.id));
  send(bob, { type: 'housing.release', buildingId });
  await waitFor(alice, 'housing.updated', (message) => !message.houses.some((house) => house.buildingId === buildingId));

  // 相同昵称+正确密码登录返回同一个全局唯一 ID
  const aliceAgain = await connect('Alice');
  if (aliceAgain.hello.user.id !== alice.hello.user.id) throw new Error('Logging in again with the same nickname must restore the same user ID');
  if (aliceAgain.hello.user.id === bob.hello.user.id) throw new Error('Different residents must not share an ID');
  aliceAgain.socket.close();

  console.log('Integration passed: identity, position, chat, housing applications, invite decline/accept, and lifecycle');
} finally {
  alice?.socket.close();
  bob?.socket.close();
  charlie?.socket.close();
  server.kill();
  await new Promise((resolve) => server.once('exit', resolve));
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
