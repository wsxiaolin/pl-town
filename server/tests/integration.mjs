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

const connect = (nickname) => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://127.0.0.1:${port}`);
  const messages = [];
  socket.on('message', (raw) => {
    const message = JSON.parse(raw);
    messages.push(message);
    if (message.type === 'hello') resolve({ socket, hello: message, messages });
  });
  socket.on('error', reject);
  socket.on('open', () => socket.send(JSON.stringify({ type: 'hello', nickname })));
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
try {
  await waitForServer();
  alice = await connect('Alice');
  bob = await connect('Bob');
  await waitFor(alice, 'player.joined', (message) => message.player.id === bob.hello.user.id);

  send(bob, { type: 'position', position: { x: 3, y: 0, z: 4, rotation: 1 } });
  await waitFor(alice, 'player.moved', (message) => message.playerId === bob.hello.user.id && message.position.x === 3);

  send(alice, { type: 'chat', text: 'integration-chat' });
  await waitFor(bob, 'chat', (message) => message.text === 'integration-chat');

  const buildingId = 'residence:3.00:4.00';
  send(alice, { type: 'housing.claim', buildingId, name: 'Integration Home' });
  await waitFor(bob, 'housing.updated', (message) => message.houses.some((house) => house.buildingId === buildingId));
  send(alice, { type: 'housing.invite', buildingId, userId: bob.hello.user.id });
  await waitFor(bob, 'housing.updated', (message) => message.houses.some((house) => house.members.length === 2));
  send(alice, { type: 'housing.transfer', buildingId, userId: bob.hello.user.id });
  await waitFor(bob, 'housing.updated', (message) => message.houses.some((house) => house.ownerId === bob.hello.user.id));
  send(bob, { type: 'housing.release', buildingId });
  await waitFor(alice, 'housing.updated', (message) => !message.houses.some((house) => house.buildingId === buildingId));

  console.log('Integration passed: identity, position, chat, and housing lifecycle');
} finally {
  alice?.socket.close();
  bob?.socket.close();
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
