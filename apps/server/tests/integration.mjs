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

  if (alice.hello.progress.currency !== 1200) throw new Error('New residents must receive configured initial currency');
  if (alice.hello.catalog.buildingPrices.activity !== 0) throw new Error('Building unlocks must be free');
  if (alice.hello.catalog.buildingUnlockable.litreview !== false) throw new Error('Literature review must remain story-locked');

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

  send(alice, { type: 'progress.shop.buy', productId: 'dragonwell_tea', quantity: 2 });
  const purchase = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'shop.purchased');
  if (purchase.progress.inventory.dragonwell_tea !== 2 || purchase.progress.currency !== 1140) throw new Error('Shop purchase must atomically merge inventory and deduct currency');
  send(alice, { type: 'progress.achievement.unlock', achievementId: 'first_building' });
  const achievement = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'achievement.unlocked' && message.event.achievementId === 'first_building');
  if (achievement.event.reward !== 20 || achievement.progress.currency !== 1160) throw new Error('Achievement must grant its configured currency reward');
  send(alice, { type: 'progress.achievement.unlock', achievementId: 'first_building' });
  const duplicateAchievement = await waitFor(alice, 'progress.updated', (message) => message.event?.type === 'achievement.unlocked' && message.event.achievementId === 'first_building' && message.event.reward === 0);
  if (duplicateAchievement.progress.currency !== 1160) throw new Error('Achievement rewards must be idempotent');
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
  if ('dragonwell_tea' in aliceAgain.hello.progress.inventory || !aliceAgain.hello.progress.achievements.includes('first_building') || !aliceAgain.hello.progress.unlockedBuildings.includes('activity')) throw new Error('Cloud progression must survive reconnecting');
  aliceAgain.socket.close();

  console.log('Integration passed: identity, cloud progression, position, chat, housing applications, invite decline/accept, and lifecycle');
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
