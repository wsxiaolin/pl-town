import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { authenticate } from './auth.js';
import { HOST, PORT } from './config.js';
import * as db from './db.js';
import type { ClientMessage, Position, ServerMessage, User } from './types.js';

type Client = { socket: WebSocket; user: User; ready: boolean };
const clients = new Map<string, Client>();
const pendingPositions = new Map<string, Position>();
const authAttempts = new Map<string, { count: number; startedAt: number }>();
const messageWindows = new WeakMap<WebSocket, { startedAt: number; count: number }>();
const MAX_MESSAGES_PER_SECOND = 60;
const send = (socket: WebSocket, message: ServerMessage) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
const broadcast = (message: ServerMessage, except?: string) => clients.forEach((client, id) => { if (id !== except) send(client.socket, message); });
const fail = (socket: WebSocket, message: string) => send(socket, { type: 'error', message });
function broadcastHousingState() {
  const houses = db.listHouses();
  clients.forEach((client) => {
    send(client.socket, { type: 'housing.updated', houses });
    send(client.socket, { type: 'housing.requests', requests: db.listHousingRequestsForUser(client.user.id) });
  });
}
const validPosition = (position: unknown): position is Position => {
  if (!position || typeof position !== 'object') return false;
  const value = position as Record<string, unknown>;
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z) && (value.rotation === undefined || Number.isFinite(value.rotation));
};
const validId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 100;
const validResidenceId = (value: unknown) => typeof value === 'string' && /^residence:-?\d+(?:\.\d{2})?:-?\d+(?:\.\d{2})?$/.test(value);

function flushPosition(userId: string) {
  const position = pendingPositions.get(userId);
  if (!position) return;
  db.savePosition(userId, position);
  pendingPositions.delete(userId);
}
setInterval(() => pendingPositions.forEach((_position, userId) => flushPosition(userId)), 1_000).unref();

function requireReady(client: Client, action: () => void) { if (!client.ready) fail(client.socket, 'Send hello before other messages'); else action(); }
function handle(client: Client, raw: string) {
  if (raw.length > 16_384) return fail(client.socket, 'Message too large');
  const now = Date.now();
  const window = messageWindows.get(client.socket) ?? { startedAt: now, count: 0 };
  if (now - window.startedAt >= 1_000) { window.startedAt = now; window.count = 0; }
  if (++window.count > MAX_MESSAGES_PER_SECOND) return fail(client.socket, 'Too many messages');
  messageWindows.set(client.socket, window);
  let message: ClientMessage;
  try { message = JSON.parse(raw) as ClientMessage; } catch { fail(client.socket, 'Invalid JSON'); return; }
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') { fail(client.socket, 'Invalid message'); return; }
  if (message.type === 'hello') {
    const address = (client.socket as WebSocket & { _socket?: { remoteAddress?: string } })._socket?.remoteAddress ?? 'unknown';
    const attempt = authAttempts.get(address) ?? { count: 0, startedAt: now };
    if (now - attempt.startedAt >= 60_000) { attempt.startedAt = now; attempt.count = 0; }
    if (++attempt.count > 20) return fail(client.socket, 'Too many authentication attempts');
    authAttempts.set(address, attempt);
    let result: ReturnType<typeof authenticate>;
    try {
      result = authenticate({ token: message.token, nickname: message.nickname, password: message.password });
      authAttempts.delete(address);
    } catch (error) {
      fail(client.socket, error instanceof Error ? error.message : '登录失败');
      return;
    }
    client.user = result.user; client.ready = true; clients.set(client.user.id, client);
    send(client.socket, { type: 'hello', token: result.token, user: client.user, players: [...clients.values()].map((item) => item.user), houses: db.listHouses(), requests: db.listHousingRequestsForUser(client.user.id) });
    broadcast({ type: 'player.joined', player: client.user }, client.user.id); return;
  }
  requireReady(client, () => {
    const userId = client.user.id;
    if (message.type === 'position') { if (!validPosition(message.position)) return fail(client.socket, 'Invalid position'); pendingPositions.set(userId, message.position); client.user.position = message.position; broadcast({ type: 'player.moved', playerId: userId, position: message.position }, userId); return; }
    if (message.type === 'chat') { if (typeof message.text !== 'string') return fail(client.socket, 'Invalid chat message'); const text = message.text.trim().slice(0, 500); if (text) broadcast({ type: 'chat', userId, nickname: client.user.nickname, text }, undefined); return; }
    if (message.type === 'housing.list') { send(client.socket, { type: 'housing.list', houses: db.listHouses() }); send(client.socket, { type: 'housing.requests', requests: db.listHousingRequestsForUser(userId) }); return; }
    if (message.type === 'housing.accept' || message.type === 'housing.decline') {
      if (!Number.isInteger(message.requestId)) return fail(client.socket, 'Invalid housing request');
      const request = db.getHousingRequest(message.requestId);
      if (!request || request.targetId !== userId) return fail(client.socket, 'Housing request is no longer available');
      if (message.type === 'housing.accept') {
        const acceptedHouse = db.getHouse(request.buildingId);
        if (!acceptedHouse) return fail(client.socket, 'House is no longer available');
        if (request.kind === 'application' && acceptedHouse.ownerId !== userId) return fail(client.socket, 'Only the current owner can approve applications');
        if (acceptedHouse.members.length >= 10) return fail(client.socket, 'House is full');
        const memberId = request.kind === 'application' ? request.requesterId : userId;
        if (db.listHouses().some((item) => item.members.some((member) => member.userId === memberId))) return fail(client.socket, 'User already lives in a house');
        try { db.addMember(request.buildingId, memberId); } catch { return fail(client.socket, 'Could not join the house'); }
        db.deleteHousingRequestsForUser(memberId);
      }
      db.deleteHousingRequest(message.requestId);
      broadcastHousingState();
      return;
    }
    if (!('buildingId' in message) || !validId(message.buildingId)) return fail(client.socket, 'Invalid building ID');
    const house = db.getHouse(message.buildingId);
    if (message.type === 'housing.claim') { if (!validResidenceId(message.buildingId)) return fail(client.socket, 'Invalid residence ID'); if (house) return fail(client.socket, 'House is already claimed'); try { db.claimHouse(message.buildingId, userId, typeof message.name === 'string' ? message.name.slice(0, 80) : undefined); db.deleteHousingRequestsForUser(userId); broadcastHousingState(); } catch { fail(client.socket, 'Could not claim house; the user may already live elsewhere'); } return; }
    if (!house) return fail(client.socket, 'House not found');
    if (message.type === 'housing.rename') { if (house.ownerId !== userId) return fail(client.socket, 'Only the owner can rename'); if (typeof message.name !== 'string' || !message.name.trim()) return fail(client.socket, 'Invalid house name'); db.renameHouse(message.buildingId, message.name.trim().slice(0, 80)); }
    else if (message.type === 'housing.invite') {
      if (house.ownerId !== userId) return fail(client.socket, 'Only the owner can invite');
      if (!validId(message.userId) || message.userId === userId) return fail(client.socket, 'Invalid invite target');
      if (!db.getUser(message.userId)) return fail(client.socket, 'User not found');
      if (house.members.length >= 10) return fail(client.socket, 'House is full');
      if (house.members.some((member) => member.userId === message.userId)) return fail(client.socket, 'User is already a member');
      if (db.listHouses().some((item) => item.members.some((member) => member.userId === message.userId))) return fail(client.socket, 'User already lives in a house');
      try { db.createHousingRequest(message.buildingId, userId, message.userId, 'invite'); } catch { return fail(client.socket, 'Invite is already pending'); }
    }
    else if (message.type === 'housing.apply') {
      if (house.members.some((member) => member.userId === userId)) return fail(client.socket, 'You already live here');
      if (house.ownerId === userId) return fail(client.socket, 'You already own this house');
      if (house.members.length >= 10) return fail(client.socket, 'House is full');
      if (db.listHouses().some((item) => item.members.some((member) => member.userId === userId))) return fail(client.socket, 'You already live in a house');
      try { db.createHousingRequest(message.buildingId, userId, house.ownerId, 'application'); } catch { return fail(client.socket, 'Application is already pending'); }
    }
    else if (message.type === 'housing.kick') { if (house.ownerId !== userId) return fail(client.socket, 'Only the owner can kick'); if (message.userId === house.ownerId) return fail(client.socket, 'Owner cannot be kicked'); db.removeMember(message.buildingId, message.userId); }
    else if (message.type === 'housing.leave') { if (!house.members.some((member) => member.userId === userId)) return fail(client.socket, 'You do not live here'); if (house.ownerId === userId) return fail(client.socket, 'Transfer or release the house first'); db.removeMember(message.buildingId, userId); }
    else if (message.type === 'housing.transfer') { if (house.ownerId !== userId) return fail(client.socket, 'Only the owner can transfer'); if (!house.members.some((member) => member.userId === message.userId)) return fail(client.socket, 'New owner must be a member'); db.transferHouse(message.buildingId, message.userId); }
    else if (message.type === 'housing.release') { if (house.ownerId !== userId) return fail(client.socket, 'Only the owner can release'); db.deleteHouse(message.buildingId); }
    else return;
    broadcastHousingState();
  });
}

const http = createServer((request, response) => { if (request.url === '/healthz') { response.writeHead(200, { 'content-type': 'application/json', 'x-content-type-options': 'nosniff', 'cache-control': 'no-store' }); response.end(JSON.stringify({ ok: true, online: clients.size })); return; } response.writeHead(404, { 'x-content-type-options': 'nosniff' }); response.end(); });
const wss = new WebSocketServer({ server: http, maxPayload: 16 * 1024 });
wss.on('connection', (socket) => { const client = { socket, user: null as unknown as User, ready: false }; socket.on('message', (data) => handle(client, data.toString())); socket.on('close', () => { if (client.ready && clients.get(client.user.id)?.socket === socket) { flushPosition(client.user.id); clients.delete(client.user.id); broadcast({ type: 'player.left', playerId: client.user.id }); } }); });
http.listen(PORT, HOST, () => console.log(`MiniCity server listening on http://${HOST}:${PORT}`));
