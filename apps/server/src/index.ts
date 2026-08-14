import { createServer, type IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { handleAdminError, handleAdminRequest } from './adminRouter.js';
import { authenticate } from './auth.js';
import { startAutomaticBackups, stopAutomaticBackups, waitForBackup } from './backup.js';
import { ALLOW_ORIGINLESS_WEBSOCKET, HOST, MAX_CONNECTIONS, MAX_CONNECTIONS_PER_IP, MAX_REGISTRATIONS_PER_IP, PORT, REGISTRATION_WINDOW_MINUTES } from './config.js';
import * as db from './db.js';
import { HttpBodyError, readJson } from './httpBody.js';
import { closeLogger, logger } from './logger.js';
import type { ClientMessage, Position, ServerMessage, User } from './types.js';
import { authenticateAccount, getPublicWorks, queryPublicWorks, requestAccount } from './physicsLab.js';
import { ACHIEVEMENT_REWARDS, BUILDING_PRICES, BUILDING_UNLOCKABLE, DAILY_REWARDS, getProgressionCatalog, shanghaiDayKey, SHOP_PRODUCTS, verifiedAchievementReward } from './progression.js';
import { FixedWindowRateLimiter } from './rateLimit.js';
import { clientIp, jsonSecurityHeaders, requestOriginAllowed } from './requestSecurity.js';
import { bumpMetric, handleTelemetryCollection, recordServerError } from './telemetry.js';

type Client = { socket: WebSocket; user: User; ready: boolean; ip: string; authInProgress: boolean; alive: boolean };
const clients = new Map<string, Client>();
const sockets = new Set<WebSocket>();
const connectionsByIp = new Map<string, number>();
const pendingPositions = new Map<string, Position>();
const authAttempts = new Map<string, { count: number; startedAt: number }>();
const physicsLoginAttempts = new Map<string, { count: number; startedAt: number }>();
const messageWindows = new WeakMap<WebSocket, { startedAt: number; count: number }>();
const chatWindows = new Map<string, { startedAt: number; count: number }>();
const physicsSessions = new Map<string, { token: string; authCode: string; user: User; expiresAt: number }>();
const PHYSICS_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGES_PER_SECOND = 60;
const MAX_CHAT_MESSAGES_PER_TEN_SECONDS = 5;
const MAX_PHYSICS_LOGINS_PER_MINUTE = 10;
const publicApiRate = new FixedWindowRateLimiter(120, 60_000);
const publicMutationRate = new FixedWindowRateLimiter(30, 60_000);
const globalPublicApiRate = new FixedWindowRateLimiter(1_000, 60_000, 1);
const globalPublicMutationRate = new FixedWindowRateLimiter(200, 60_000, 1);
const globalAuthenticationRate = new FixedWindowRateLimiter(200, 60_000, 1);
const globalPhysicsLoginRate = new FixedWindowRateLimiter(60, 60_000, 1);
const housingMutationRate = new FixedWindowRateLimiter(6, 10_000);
const send = (socket: WebSocket, message: ServerMessage) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
const broadcast = (message: ServerMessage, except?: string) => clients.forEach((client, id) => { if (id !== except) send(client.socket, message); });
const fail = (socket: WebSocket, message: string) => send(socket, { type: 'error', message });
let housingBroadcastTimer: NodeJS.Timeout | undefined;
function broadcastHousingState() {
  if (housingBroadcastTimer) return;
  housingBroadcastTimer = setTimeout(() => {
    housingBroadcastTimer = undefined;
    const houses = db.listHouses();
    clients.forEach((client) => {
      send(client.socket, { type: 'housing.updated', houses });
      send(client.socket, { type: 'housing.requests', requests: db.listHousingRequestsForUser(client.user.id) });
    });
  }, 50);
  housingBroadcastTimer.unref();
}
const validPosition = (position: unknown): position is Position => {
  if (!position || typeof position !== 'object') return false;
  const value = position as Record<string, unknown>;
  return Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
    && Math.abs(Number(value.x)) <= 80 && Math.abs(Number(value.y)) <= 10 && Math.abs(Number(value.z)) <= 80
    && (value.rotation === undefined || (Number.isFinite(value.rotation) && Math.abs(Number(value.rotation)) <= Math.PI * 4));
};
const validId = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 100;
const validUserId = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const validStoryId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value);
const validStoryNodeId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value);
const validStoryFlags = (value: unknown): value is Record<string, boolean | number | string | null> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > 64) return false;
  return entries.every(([key, item]) => /^[A-Za-z0-9_.:-]{1,64}$/.test(key)
    && (item === null || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item)) || (typeof item === 'string' && item.length <= 500)));
};
const validResidenceId = (value: unknown) => typeof value === 'string' && /^residence:-?\d+(?:\.\d{2})?:-?\d+(?:\.\d{2})?$/.test(value);
const validQuantity = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 20;
const progressState = (userId: string) => ({ progress: db.getPlayerProgress(userId), catalog: getProgressionCatalog() });
const sendProgress = (socket: WebSocket, userId: string, event?: Record<string, unknown>) => send(socket, { type: 'progress.updated', ...progressState(userId), event });

function flushPosition(userId: string) {
  const position = pendingPositions.get(userId);
  if (!position) return;
  db.savePosition(userId, position);
  pendingPositions.delete(userId);
}
setInterval(() => pendingPositions.forEach((_position, userId) => flushPosition(userId)), 1_000).unref();
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [ip, attempt] of authAttempts) if (attempt.startedAt < cutoff) authAttempts.delete(ip);
  for (const [ip, attempt] of physicsLoginAttempts) if (attempt.startedAt < cutoff) physicsLoginAttempts.delete(ip);
  const now = Date.now();
  for (const [id, session] of physicsSessions) if (session.expiresAt <= now) physicsSessions.delete(id);
  for (const [id, window] of chatWindows) if (window.startedAt < now - 10_000) chatWindows.delete(id);
}, 60_000).unref();

function requireReady(client: Client, action: () => void) { if (!client.ready) fail(client.socket, 'Send hello before other messages'); else action(); }
async function handle(client: Client, raw: string) {
  if (raw.length > 16_384) { logger.warn('Oversized WebSocket message rejected', { bytes: raw.length, ip: client.ip }); return fail(client.socket, 'Message too large'); }
  const now = Date.now();
  const window = messageWindows.get(client.socket) ?? { startedAt: now, count: 0 };
  if (now - window.startedAt >= 1_000) { window.startedAt = now; window.count = 0; }
  if (++window.count > MAX_MESSAGES_PER_SECOND) { logger.warn('Message rate limit exceeded', { ip: client.ip }); client.socket.close(4008, 'Message rate limit exceeded'); return; }
  messageWindows.set(client.socket, window);
  let message: ClientMessage;
  try { message = JSON.parse(raw) as ClientMessage; } catch { fail(client.socket, 'Invalid JSON'); return; }
  if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') { fail(client.socket, 'Invalid message'); return; }
  if (message.type === 'hello') {
    if (client.ready || client.authInProgress) { fail(client.socket, 'Already authenticating'); return; }
    if ((message.token !== undefined && typeof message.token !== 'string')
      || (message.nickname !== undefined && typeof message.nickname !== 'string')
      || (message.password !== undefined && typeof message.password !== 'string')) return fail(client.socket, 'Invalid authentication message');
    client.authInProgress = true;
    const address = client.ip;
    const attempt = authAttempts.get(address) ?? { count: 0, startedAt: now };
    if (now - attempt.startedAt >= 60_000) { attempt.startedAt = now; attempt.count = 0; }
    if (++attempt.count > 20 || !globalAuthenticationRate.consume('global').allowed) { client.authInProgress = false; logger.warn('Authentication rate limit exceeded', { ip: address, count: attempt.count }); return fail(client.socket, 'Too many authentication attempts'); }
    authAttempts.set(address, attempt);
    let result: Awaited<ReturnType<typeof authenticate>>;
    try {
      const sinceIso = new Date(Date.now() - REGISTRATION_WINDOW_MINUTES * 60_000).toISOString();
      result = await authenticate({ token: message.token, nickname: message.nickname, password: message.password, ip: address, registrationLimit: { sinceIso, max: MAX_REGISTRATIONS_PER_IP } });
    } catch (error) {
      const reason = error instanceof Error ? error.message : '登录失败';
      logger.warn('Login failed', { ip: address, reason });
      fail(client.socket, reason);
      client.authInProgress = false;
      return;
    }
    if (client.socket.readyState !== WebSocket.OPEN) { client.authInProgress = false; return; }
    const previous = clients.get(result.user.id);
    if (previous && previous.socket !== client.socket) previous.socket.close(4001, 'Signed in elsewhere');
    client.user = result.user; client.ready = true; clients.set(client.user.id, client);
    logger.info('Resident joined', { id: client.user.id, nickname: client.user.nickname, online: clients.size, ip: address });
    send(client.socket, { type: 'hello', token: result.token, user: client.user, players: [...clients.values()].map((item) => item.user), houses: db.listHouses(), requests: db.listHousingRequestsForUser(client.user.id), ...progressState(client.user.id) });
    broadcast({ type: 'player.joined', player: client.user }, client.user.id); client.authInProgress = false; return;
  }
  requireReady(client, () => {
    const userId = client.user.id;
    if (message.type.startsWith('housing.') && message.type !== 'housing.list') {
      const rate = housingMutationRate.consume(userId);
      if (!rate.allowed) return fail(client.socket, 'Housing rate limit exceeded');
    }
    if (message.type === 'position') { if (!validPosition(message.position)) return fail(client.socket, 'Invalid position'); pendingPositions.set(userId, message.position); client.user.position = message.position; broadcast({ type: 'player.moved', playerId: userId, position: message.position }, userId); return; }
    if (message.type === 'chat') {
      if (typeof message.text !== 'string' || message.text.length > 500) return fail(client.socket, 'Invalid chat message');
      const window = chatWindows.get(userId) ?? { startedAt: now, count: 0 };
      if (now - window.startedAt >= 10_000) { window.startedAt = now; window.count = 0; }
      if (++window.count > MAX_CHAT_MESSAGES_PER_TEN_SECONDS) { chatWindows.set(userId, window); return fail(client.socket, 'Chat rate limit exceeded'); }
      chatWindows.set(userId, window);
      const text = message.text.trim(); if (text) { db.recordChatMessage(userId, client.user.nickname, text.slice(0, 500)); bumpMetric('chatMessages'); broadcast({ type: 'chat', userId, nickname: client.user.nickname, text }, undefined); } return;
    }
    if (message.type === 'progress.get') { sendProgress(client.socket, userId); return; }
    if (message.type === 'progress.building.visit') {
      if (!validId(message.buildingId) || !(message.buildingId in BUILDING_PRICES)) return fail(client.socket, 'Building is not available');
      if (BUILDING_UNLOCKABLE[message.buildingId] !== true) return fail(client.socket, 'Building is story-locked');
      const progress = db.getPlayerProgress(userId);
      if (!progress.unlockedBuildings.includes(message.buildingId)) return fail(client.socket, 'Building is locked');
      const result = db.recordBuildingVisit(userId, message.buildingId);
      send(client.socket, { type: 'progress.updated', progress: result.progress, catalog: getProgressionCatalog(), event: { type: 'building.visited', buildingId: message.buildingId, welcomeItemsGranted: result.welcomeItemsGranted } });
      return;
    }
    if (message.type === 'progress.building.unlock') {
      if (!validId(message.buildingId) || !(message.buildingId in BUILDING_PRICES)) return fail(client.socket, 'Building cannot be unlocked');
      if (BUILDING_UNLOCKABLE[message.buildingId] !== true) return fail(client.socket, 'Building is story-locked');
      try {
        const result = db.purchaseBuilding(userId, message.buildingId, BUILDING_PRICES[message.buildingId]!);
        send(client.socket, { type: 'progress.updated', progress: result.progress, catalog: getProgressionCatalog(), event: { type: 'building.unlocked', buildingId: message.buildingId, purchased: result.unlocked } });
      } catch (error) { fail(client.socket, error instanceof Error ? error.message : 'Could not unlock building'); }
      return;
    }
    if (message.type === 'progress.achievement.unlock') {
      if (!validId(message.achievementId) || !(message.achievementId in ACHIEVEMENT_REWARDS)) return fail(client.socket, 'Achievement is not available');
      const reward = verifiedAchievementReward(db.getPlayerProgress(userId), message.achievementId);
      const result = db.unlockAchievement(userId, message.achievementId, reward);
      send(client.socket, { type: 'progress.updated', progress: result.progress, catalog: getProgressionCatalog(), event: { type: 'achievement.unlocked', achievementId: message.achievementId, reward: result.rewardGranted } });
      return;
    }
    if (message.type === 'progress.shop.buy') {
      if (!validId(message.productId) || !(message.productId in SHOP_PRODUCTS)) return fail(client.socket, 'Product is not available');
      const quantity = message.quantity ?? 1;
      if (!validQuantity(quantity)) return fail(client.socket, 'Invalid quantity');
      const product = SHOP_PRODUCTS[message.productId as keyof typeof SHOP_PRODUCTS];
      try {
        const progress = db.purchaseItem(userId, product.itemId, quantity, product.unitPrice);
        send(client.socket, { type: 'progress.updated', progress, catalog: getProgressionCatalog(), event: { type: 'shop.purchased', productId: message.productId, quantity } });
      } catch (error) { fail(client.socket, error instanceof Error ? error.message : 'Purchase failed'); }
      return;
    }
    if (message.type === 'progress.item.consume') {
      const quantity = message.quantity ?? 1;
      if (!Object.values(SHOP_PRODUCTS).some((product) => product.itemId === message.itemId) || !validQuantity(quantity)) return fail(client.socket, 'Item cannot be consumed');
      try {
        const progress = db.consumeItem(userId, message.itemId, quantity);
        send(client.socket, { type: 'progress.updated', progress, catalog: getProgressionCatalog(), event: { type: 'item.consumed', itemId: message.itemId, quantity } });
      } catch (error) { fail(client.socket, error instanceof Error ? error.message : 'Could not consume item'); }
      return;
    }
    if (message.type === 'progress.reward.claim') {
      if (!validId(message.rewardId) || !(message.rewardId in DAILY_REWARDS)) return fail(client.socket, 'Reward is not available');
      const reward = DAILY_REWARDS[message.rewardId as keyof typeof DAILY_REWARDS];
      const result = db.claimReward(userId, message.rewardId, shanghaiDayKey(), reward.itemId, reward.quantity);
      send(client.socket, { type: 'progress.updated', progress: result.progress, catalog: getProgressionCatalog(), event: { type: 'reward.claimed', rewardId: message.rewardId, claimed: result.claimed } });
      return;
    }
    if (message.type === 'story.get') {
      if (!validStoryId(message.storyId)) return fail(client.socket, 'Invalid story ID');
      send(client.socket, { type: 'story.updated', story: db.getStoryProgress(userId, message.storyId), event: { type: 'story.loaded', storyId: message.storyId } });
      return;
    }
    if (message.type === 'story.update') {
      if (!validStoryId(message.storyId)) return fail(client.socket, 'Invalid story ID');
      if (message.definitionVersion !== undefined && (!Number.isInteger(message.definitionVersion) || message.definitionVersion < 1 || message.definitionVersion > 1_000_000)) return fail(client.socket, 'Invalid story definition version');
      if (message.nodeId !== undefined && !validStoryNodeId(message.nodeId)) return fail(client.socket, 'Invalid story node');
      if (message.flags !== undefined && !validStoryFlags(message.flags)) return fail(client.socket, 'Invalid story flags');
      if (message.ending !== undefined && message.ending !== null && !validStoryNodeId(message.ending)) return fail(client.socket, 'Invalid story ending');
      if (message.visit !== undefined && typeof message.visit !== 'boolean') return fail(client.socket, 'Invalid story visit');
      try {
        const story = db.updateStoryProgress(userId, message.storyId, { definitionVersion: message.definitionVersion, nodeId: message.nodeId, flags: message.flags, ending: message.ending, visit: message.visit });
        send(client.socket, { type: 'story.updated', story, event: { type: 'story.updated', storyId: message.storyId } });
      } catch (error) { fail(client.socket, error instanceof Error ? error.message : 'Story could not be updated'); }
      return;
    }
    if (message.type === 'housing.list') { send(client.socket, { type: 'housing.list', houses: db.listHouses() }); send(client.socket, { type: 'housing.requests', requests: db.listHousingRequestsForUser(userId) }); return; }
    if (message.type === 'housing.accept' || message.type === 'housing.decline') {
      if (!Number.isSafeInteger(message.requestId) || message.requestId <= 0) return fail(client.socket, 'Invalid housing request');
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
      if (!validUserId(message.userId) || message.userId === userId) return fail(client.socket, 'Invalid invite target');
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
    else if (message.type === 'housing.kick') { if (house.ownerId !== userId) return fail(client.socket, 'Only the owner can kick'); if (!validUserId(message.userId) || message.userId === house.ownerId) return fail(client.socket, 'Invalid member'); if (!house.members.some((member) => member.userId === message.userId)) return fail(client.socket, 'Member not found'); db.removeMember(message.buildingId, message.userId); }
    else if (message.type === 'housing.leave') { if (!house.members.some((member) => member.userId === userId)) return fail(client.socket, 'You do not live here'); if (house.ownerId === userId) return fail(client.socket, 'Transfer or release the house first'); db.removeMember(message.buildingId, userId); }
    else if (message.type === 'housing.transfer') { if (house.ownerId !== userId) return fail(client.socket, 'Only the owner can transfer'); if (!validUserId(message.userId) || !house.members.some((member) => member.userId === message.userId)) return fail(client.socket, 'New owner must be a member'); db.transferHouse(message.buildingId, message.userId); }
    else if (message.type === 'housing.release') { if (house.ownerId !== userId) return fail(client.socket, 'Only the owner can release'); db.deleteHouse(message.buildingId); }
    else return;
    broadcastHousingState();
  });
}

const logApiError = (request: import('node:http').IncomingMessage, error: unknown) => logger.warn('API request failed', { url: request.url, error: error instanceof Error ? error.message : String(error) });
const respondHttpBodyError = (response: import('node:http').ServerResponse, error: unknown): boolean => {
  if (!(error instanceof HttpBodyError)) return false;
  response.writeHead(error.statusCode, jsonSecurityHeaders);
  response.end(JSON.stringify({ error: error.message }));
  return true;
};
const startedAt = Date.now();
const http = createServer(async (request, response) => {
  const requestStartedAt = Date.now();
  const requestIp = clientIp(request);
  response.on('finish', () => {
    const detail = { method: request.method ?? '', url: request.url ?? '', status: response.statusCode, ms: Date.now() - requestStartedAt, ip: requestIp };
    if (response.statusCode >= 500) recordServerError(`${detail.method} ${detail.url} → ${detail.status}`, `${detail.ms}ms`);
    if ((request.url === '/healthz' || request.url === '/readyz') && response.statusCode < 400) return logger.debug('HTTP', detail);
    bumpMetric('httpRequests');
    logger.info('HTTP', detail);
  });
  try {
  if (await handleAdminRequest(request, response, {
    online: () => clients.size,
    disconnectUser: (userId) => clients.get(userId)?.socket.close(4003, 'Account status changed'),
    disconnectAll: () => { for (const client of clients.values()) client.socket.close(4003, 'Database restored'); },
    startedAt,
  })) return;
  const headers = jsonSecurityHeaders;
  if (request.url === '/healthz') { response.writeHead(200, headers); response.end(JSON.stringify({ ok: true })); return; }
  if (request.url === '/readyz') {
    const database = db.databaseStatus();
    response.writeHead(database.ready ? 200 : 503, headers); response.end(JSON.stringify({ ok: database.ready, database, online: clients.size })); return;
  }
  if (request.url?.startsWith('/town-api/')) {
    const limiter = ['GET', 'HEAD'].includes(request.method ?? '') ? publicApiRate : publicMutationRate;
    const globalLimiter = ['GET', 'HEAD'].includes(request.method ?? '') ? globalPublicApiRate : globalPublicMutationRate;
    const result = limiter.consume(requestIp);
    const globalResult = globalLimiter.consume('global');
    if (!result.allowed || !globalResult.allowed) {
      response.writeHead(429, { ...headers, 'retry-after': String(result.retryAfterSeconds) });
      response.end(JSON.stringify({ error: 'Too many requests' })); return;
    }
    if (!['GET', 'HEAD'].includes(request.method ?? '') && !requestOriginAllowed(request, process.env.NODE_ENV !== 'production')) {
      response.writeHead(403, headers); response.end(JSON.stringify({ error: 'Request origin is not allowed' })); return;
    }
  }
  if (await handleTelemetryCollection(request, response)) return;
  const match = request.url?.match(/^\/town-api\/works\?scope=(knowledge|senate|all|discussion|featured)$/);
  if (request.method === 'GET' && match) {
    try { response.writeHead(200, headers); response.end(JSON.stringify(await getPublicWorks(match[1] as 'knowledge' | 'senate' | 'all' | 'discussion' | 'featured'))); }
    catch (error) { logApiError(request, error); response.writeHead(502, { ...headers, 'cache-control': 'no-store' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Upstream unavailable' })); }
    return;
  }
  if (request.method === 'POST' && request.url === '/town-api/works/query') {
    try { const body=await readJson(request); response.writeHead(200,headers); response.end(JSON.stringify(await queryPublicWorks(body.query))); }
    catch(error){ if (respondHttpBodyError(response, error)) return; logApiError(request, error); response.writeHead(502,{...headers,'cache-control':'no-store'}); response.end(JSON.stringify({error:error instanceof Error?error.message:'Upstream unavailable'})); }
    return;
  }
  if (request.method === 'POST' && request.url === '/town-api/pl/login') {
    try {
      const attempt = physicsLoginAttempts.get(requestIp) ?? { count: 0, startedAt: Date.now() };
      if (Date.now() - attempt.startedAt >= 60_000) { attempt.startedAt = Date.now(); attempt.count = 0; }
      if (++attempt.count > MAX_PHYSICS_LOGINS_PER_MINUTE || !globalPhysicsLoginRate.consume('global').allowed) {
        logger.warn('Physics Lab login rate limit exceeded', { ip: requestIp });
        response.writeHead(429, { ...headers, 'cache-control': 'no-store', 'retry-after': '60' });
        response.end(JSON.stringify({ error: 'Too many login attempts' }));
        return;
      }
      physicsLoginAttempts.set(requestIp, attempt);
      const body = await readJson(request); const login = typeof body.login === 'string' ? body.login.trim() : ''; const password = typeof body.password === 'string' ? body.password : '';
      if (!login || !password || login.length > 160 || password.length > 256) throw new Error('Login details are invalid');
      const result = await authenticateAccount(login, password); const id = randomUUID();
      const user = { id: String(result.user?.ID || id), nickname: String(result.user?.Nickname || login), email: null, position: { x: 0, y: 0, z: -6 } };
      physicsSessions.set(id, { token: result.token, authCode: result.authCode, user, expiresAt: Date.now() + PHYSICS_SESSION_TTL_MS });
      while (physicsSessions.size > 10_000) physicsSessions.delete(physicsSessions.keys().next().value as string);
      response.writeHead(200, headers); response.end(JSON.stringify({ session: id, user }));
    } catch (error) { if (respondHttpBodyError(response, error)) return; logApiError(request, error); response.writeHead(401, { ...headers, 'cache-control': 'no-store' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Physics Lab login failed' })); }
    return;
  }
  const accountMatch = request.url?.match(/^\/town-api\/pl\/(messages|notifications)(?:\?(.*))?$/);
  if (request.method === 'GET' && accountMatch) {
    const key = request.headers['x-town-pl-session']; const account = typeof key === 'string' ? physicsSessions.get(key) : undefined;
    if (!account || account.expiresAt <= Date.now()) { response.writeHead(401, headers); response.end(JSON.stringify({ error: 'Physics Lab session expired' })); return; }
    try {
      const path = '/Messages/GetMessages';
      const params = new URLSearchParams(accountMatch[2] || '');
      const skip = Math.max(0, Number.parseInt(params.get('skip') || '0', 10) || 0);
      const take = Math.min(24, Math.max(1, Number.parseInt(params.get('take') || '20', 10) || 20));
      const body = { CategoryID: 3, Skip: skip, Take: take, NoTemplates: accountMatch[1] === 'messages' };
      const data = await requestAccount(account, path, body);
      const collection = (value: any) => Array.isArray(value) ? value : Array.isArray(value?.$values) ? value.$values : [];
      const items = collection(data.Data?.Messages).length ? collection(data.Data.Messages) : collection(data.Data);
      const templates = collection(data.Data?.Templates);
      response.writeHead(200, headers); response.end(JSON.stringify({ data: items, templates, hasMore: items.length >= take }));
    } catch (error) { logApiError(request, error); response.writeHead(502, headers); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Physics Lab request failed' })); }
    return;
  }
  const socialMatch = request.url?.match(/^\/town-api\/pl\/social\?kind=(profile|following|followers|volunteers|mine|favorites)$/);
  if (request.method === 'GET' && socialMatch) {
    const key = request.headers['x-town-pl-session']; const account = typeof key === 'string' ? physicsSessions.get(key) : undefined;
    if (!account || account.expiresAt <= Date.now()) { response.writeHead(401, headers); response.end(JSON.stringify({ error: 'Physics Lab session expired' })); return; }
    try {
      const kind = socialMatch[1]; let result;
      if (kind === 'profile') result = await requestAccount(account, '/Users/GetUser', { ID: account.user.id });
      else if (kind === 'following' || kind === 'followers' || kind === 'volunteers') result = await requestAccount(account, '/Users/GetRelations', { UserID: account.user.id, DisplayType: kind === 'following' ? 1 : kind === 'followers' ? 0 : 3, Skip: 0, Take: 24, Query: '' });
      else result = await requestAccount(account, '/Contents/QueryExperiments', { Query: { Category: 'Experiment', Languages: [], ExcludeLanguages: null, Tags: null, ExcludeTags: null, ModelTags: null, ModelID: null, ParentID: null, UserID: kind === 'mine' ? account.user.id : 'Favorite', Special: null, From: null, Skip: 0, Take: 24, Days: 0, Sort: 0, ShowAnnouncement: false } });
      response.writeHead(200, headers); response.end(JSON.stringify({ kind, data: result.Data }));
    } catch (error) { logApiError(request, error); response.writeHead(502, headers); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Physics Lab request failed' })); }
    return;
  }
  const workMatch = request.url?.match(/^\/town-api\/pl\/work\/([A-Za-z0-9]+)(?:\/(comments|star|star-status|support|supporters|derivatives))?$/);
  if (workMatch && (request.method === 'GET' || request.method === 'POST')) {
    const key = request.headers['x-town-pl-session']; const account = typeof key === 'string' ? physicsSessions.get(key) : undefined;
    if (!account || account.expiresAt <= Date.now()) { response.writeHead(401, headers); response.end(JSON.stringify({ error: 'Physics Lab session expired' })); return; }
    try {
      const id=workMatch[1]; const action=workMatch[2]; const category=request.headers['x-town-work-category']==='Discussion'?'Discussion':'Experiment'; let path='/Contents/GetSummary'; let body:any={ContentID:id,Category:category};
      if(action==='comments'&&request.method==='GET'){path='/Messages/GetComments';body={TargetID:id,TargetType:category,Skip:0,Take:16};}
      if(action==='comments'&&request.method==='POST'){const input=await readJson(request);const content=typeof input.content==='string'?input.content.trim().slice(0,1200):'';if(!content)throw new Error('Comment cannot be empty');path='/Messages/PostComment';body={TargetID:id,TargetType:category,Content:content,Language:'Chinese'};}
      if(action==='star'){const input=await readJson(request);path='/Contents/StarContent';body={ContentID:id,Category:category,Status:input.action!==0,Type:0};}
      if(action==='star-status'){path='/Contents/IsStarred';body={ContentID:id,Category:category};}
      if(action==='support'){const input=await readJson(request);path='/Contents/StarContent';body={ContentID:id,Category:category,Status:input.action!==0,Type:1};}
      if(action==='supporters'){path='/Contents/GetSupporters';body={ContentID:id,Category:category,Skip:0,Take:20};}
      if(action==='derivatives'){path='/Contents/GetDerivatives';body={ContentID:id,Category:category,WithSummary:true,Language:'Chinese'};}
      const data=await requestAccount(account,path,body); response.writeHead(200,headers); response.end(JSON.stringify({data:data.Data}));
    } catch(error){if(respondHttpBodyError(response,error))return;logApiError(request, error);response.writeHead(502,headers);response.end(JSON.stringify({error:error instanceof Error?error.message:'Work request failed'}));}
    return;
  }
  const libraryMatch=request.url?.match(/^\/town-api\/pl\/library\?kind=(experiments|discussions)$/);
  if(request.method==='GET'&&libraryMatch){
    const key=request.headers['x-town-pl-session'];const account=typeof key==='string'?physicsSessions.get(key):undefined;
    if(!account||account.expiresAt<=Date.now()){response.writeHead(401,headers);response.end(JSON.stringify({error:'Physics Lab session expired'}));return;}
    try{const identifier=libraryMatch[1]==='discussions'?'Discussions':'Experiments';const data=await requestAccount(account,'/Contents/GetLibrary',{Identifier:identifier,Language:'Chinese'});response.writeHead(200,headers);response.end(JSON.stringify({data:data.Data}));}catch(error){logApiError(request, error);response.writeHead(502,headers);response.end(JSON.stringify({error:error instanceof Error?error.message:'Library unavailable'}));}return;
  }
  if(request.method==='POST'&&request.url==='/town-api/pl/logout'){
    const key=request.headers['x-town-pl-session'];if(typeof key==='string')physicsSessions.delete(key);response.writeHead(200,{...headers,'cache-control':'no-store'});response.end(JSON.stringify({ok:true}));return;
  }
  if(request.method==='POST'&&request.url==='/town-api/pl/social/follow'){
    const key=request.headers['x-town-pl-session'];const account=typeof key==='string'?physicsSessions.get(key):undefined;
    if(!account||account.expiresAt<=Date.now()){response.writeHead(401,headers);response.end(JSON.stringify({error:'Physics Lab session expired'}));return;}
    try{const input=await readJson(request);const targetId=typeof input.targetId==='string'?input.targetId:'';if(!/^[A-Za-z0-9]{12,40}$/.test(targetId))throw new Error('Invalid user');const data=await requestAccount(account,'/Users/Follow',{TargetID:targetId,Action:input.action===0?0:1});response.writeHead(200,headers);response.end(JSON.stringify({data:data.Data}));}
    catch(error){if(respondHttpBodyError(response,error))return;logApiError(request, error);response.writeHead(400,headers);response.end(JSON.stringify({error:error instanceof Error?error.message:'Follow request failed'}));}return;
  }
  response.writeHead(404, { 'x-content-type-options': 'nosniff' }); response.end();
  } catch (error) {
    if (request.url?.startsWith('/admin')) { handleAdminError(response, error); return; }
    if (error instanceof HttpBodyError) { response.writeHead(error.statusCode, jsonSecurityHeaders); response.end(JSON.stringify({ error: error.message })); return; }
    logger.error('Unhandled request error', { url: request.url, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    if (!response.headersSent) response.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ error: 'Internal server error' }));
  }
});
const wss = new WebSocketServer({
  server: http,
  maxPayload: 16 * 1024,
  verifyClient: ({ req }: { req: IncomingMessage }) => {
    const ip = clientIp(req);
    return requestOriginAllowed(req, ALLOW_ORIGINLESS_WEBSOCKET)
      && sockets.size < MAX_CONNECTIONS
      && (connectionsByIp.get(ip) ?? 0) < MAX_CONNECTIONS_PER_IP;
  },
});
wss.on('connection', (socket, request) => {
  const ip = clientIp(request);
  const client: Client = { socket, user: null as unknown as User, ready: false, ip, authInProgress: false, alive: true };
  sockets.add(socket); connectionsByIp.set(ip, (connectionsByIp.get(ip) ?? 0) + 1);
  bumpMetric('wsConnects');
  const authTimeout = setTimeout(() => { if (!client.ready) socket.close(4008, 'Authentication timeout'); }, 10_000);
  const heartbeat = setInterval(() => {
    if (!client.alive) { socket.terminate(); return; }
    client.alive = false;
    if (socket.readyState === WebSocket.OPEN) socket.ping();
  }, 30_000);
  heartbeat.unref();
  logger.info('WebSocket connected', { ip });
  socket.on('message', (data) => {
    bumpMetric('wsMessages');
    void handle(client, data.toString()).catch((error) => {
      logger.error('WebSocket message handler failed', { ip: client.ip, error: error instanceof Error ? error.message : String(error) });
      recordServerError('WebSocket message handler failed', client.ip);
      fail(socket, 'Request could not be processed');
      socket.close(1011, 'Message processing failed');
    });
  });
  socket.on('pong', () => { client.alive = true; });
  socket.on('close', () => {
    clearTimeout(authTimeout); clearInterval(heartbeat); sockets.delete(socket);
    const count = (connectionsByIp.get(ip) ?? 1) - 1; if (count > 0) connectionsByIp.set(ip, count); else connectionsByIp.delete(ip);
    if (client.ready && clients.get(client.user.id)?.socket === socket) {
      flushPosition(client.user.id); clients.delete(client.user.id); chatWindows.delete(client.user.id);
      logger.info('Resident left', { id: client.user.id, nickname: client.user.nickname, online: clients.size });
      broadcast({ type: 'player.left', playerId: client.user.id });
    }
  });
});
http.requestTimeout = 15_000;
http.headersTimeout = 20_000;
http.keepAliveTimeout = 5_000;
http.maxHeadersCount = 100;
http.listen(PORT, HOST, () => {
  startAutomaticBackups();
  logger.info(`MiniCity server listening on http://${HOST}:${PORT}`);
});

let stopping = false;
const shutdown = async (signal: string) => {
  if (stopping) return;
  stopping = true;
  logger.info('Graceful shutdown started', { signal, clients: clients.size });
  stopAutomaticBackups();
  if (housingBroadcastTimer) clearTimeout(housingBroadcastTimer);
  pendingPositions.forEach((_position, userId) => flushPosition(userId));
  for (const socket of sockets) socket.close(1001, 'Server shutting down');
  wss.close();
  try { await waitForBackup(); } catch (error) { logger.error('Backup did not finish during shutdown', { error: String(error) }); }
  http.close(async () => {
    db.closeDatabase();
    logger.info('Graceful shutdown complete');
    await closeLogger();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
