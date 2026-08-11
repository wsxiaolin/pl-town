import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { authenticate } from './auth.js';
import { HOST, PORT } from './config.js';
import * as db from './db.js';
import { logger } from './logger.js';
import type { ClientMessage, Position, ServerMessage, User } from './types.js';
import { authenticateAccount, getPublicWorks, queryPublicWorks, requestAccount } from './physicsLab.js';
import { ACHIEVEMENT_REWARDS, BUILDING_PRICES, BUILDING_UNLOCKABLE, DAILY_REWARDS, getProgressionCatalog, shanghaiDayKey, SHOP_PRODUCTS } from './progression.js';

type Client = { socket: WebSocket; user: User; ready: boolean };
const clients = new Map<string, Client>();
const pendingPositions = new Map<string, Position>();
const authAttempts = new Map<string, { count: number; startedAt: number }>();
const physicsLoginAttempts = new Map<string, { count: number; startedAt: number }>();
const messageWindows = new WeakMap<WebSocket, { startedAt: number; count: number }>();
const physicsSessions = new Map<string, { token: string; authCode: string; user: User; expiresAt: number }>();
const PHYSICS_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGES_PER_SECOND = 60;
const MAX_PHYSICS_LOGINS_PER_MINUTE = 10;
const send = (socket: WebSocket, message: ServerMessage) => { if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); };
const broadcast = (message: ServerMessage, except?: string) => clients.forEach((client, id) => { if (id !== except) send(client.socket, message); });
const fail = (socket: WebSocket, message: string) => send(socket, { type: 'error', message });
const remoteAddress = (socket: WebSocket) => (socket as WebSocket & { _socket?: { remoteAddress?: string } })._socket?.remoteAddress ?? 'unknown';
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
}, 60_000).unref();

function requireReady(client: Client, action: () => void) { if (!client.ready) fail(client.socket, 'Send hello before other messages'); else action(); }
function handle(client: Client, raw: string) {
  if (raw.length > 16_384) { logger.warn('Oversized WebSocket message rejected', { bytes: raw.length, ip: remoteAddress(client.socket) }); return fail(client.socket, 'Message too large'); }
  const now = Date.now();
  const window = messageWindows.get(client.socket) ?? { startedAt: now, count: 0 };
  if (now - window.startedAt >= 1_000) { window.startedAt = now; window.count = 0; }
  if (++window.count > MAX_MESSAGES_PER_SECOND) { logger.warn('Message rate limit exceeded', { ip: remoteAddress(client.socket) }); return fail(client.socket, 'Too many messages'); }
  messageWindows.set(client.socket, window);
  let message: ClientMessage;
  try { message = JSON.parse(raw) as ClientMessage; } catch { fail(client.socket, 'Invalid JSON'); return; }
  if (!message || typeof message !== 'object' || typeof message.type !== 'string') { fail(client.socket, 'Invalid message'); return; }
  if (message.type === 'hello') {
    const address = remoteAddress(client.socket);
    const attempt = authAttempts.get(address) ?? { count: 0, startedAt: now };
    if (now - attempt.startedAt >= 60_000) { attempt.startedAt = now; attempt.count = 0; }
    if (++attempt.count > 20) { logger.warn('Authentication rate limit exceeded', { ip: address, count: attempt.count }); return fail(client.socket, 'Too many authentication attempts'); }
    authAttempts.set(address, attempt);
    let result: ReturnType<typeof authenticate>;
    try {
      result = authenticate({ token: message.token, nickname: message.nickname, password: message.password });
      authAttempts.delete(address);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '登录失败';
      const nickname = typeof message.nickname === 'string' ? message.nickname : '';
      logger.warn('Login failed', { nickname, ip: address, reason });
      fail(client.socket, reason);
      return;
    }
    client.user = result.user; client.ready = true; clients.set(client.user.id, client);
    logger.info('Resident joined', { id: client.user.id, nickname: client.user.nickname, online: clients.size, ip: address });
    send(client.socket, { type: 'hello', token: result.token, user: client.user, players: [...clients.values()].map((item) => item.user), houses: db.listHouses(), requests: db.listHousingRequestsForUser(client.user.id), ...progressState(client.user.id) });
    broadcast({ type: 'player.joined', player: client.user }, client.user.id); return;
  }
  requireReady(client, () => {
    const userId = client.user.id;
    if (message.type === 'position') { if (!validPosition(message.position)) return fail(client.socket, 'Invalid position'); pendingPositions.set(userId, message.position); client.user.position = message.position; broadcast({ type: 'player.moved', playerId: userId, position: message.position }, userId); return; }
    if (message.type === 'chat') { if (typeof message.text !== 'string') return fail(client.socket, 'Invalid chat message'); const text = message.text.trim().slice(0, 500); if (text) broadcast({ type: 'chat', userId, nickname: client.user.nickname, text }, undefined); return; }
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
      const result = db.unlockAchievement(userId, message.achievementId, ACHIEVEMENT_REWARDS[message.achievementId]!);
      send(client.socket, { type: 'progress.updated', progress: result.progress, catalog: getProgressionCatalog(), event: { type: 'achievement.unlocked', achievementId: message.achievementId, reward: result.unlocked ? ACHIEVEMENT_REWARDS[message.achievementId] : 0 } });
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
      if (message.itemId !== 'dragonwell_tea' || !validQuantity(quantity)) return fail(client.socket, 'Item cannot be consumed');
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
      const story = db.updateStoryProgress(userId, message.storyId, { definitionVersion: message.definitionVersion, nodeId: message.nodeId, flags: message.flags, ending: message.ending, visit: message.visit });
      send(client.socket, { type: 'story.updated', story, event: { type: 'story.updated', storyId: message.storyId } });
      return;
    }
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

async function readJson(request: import('node:http').IncomingMessage) {
  let raw = ''; for await (const chunk of request) { raw += chunk.toString(); if (raw.length > 64_000) throw new Error('Request too large'); }
  return raw ? JSON.parse(raw) : {};
}
const logApiError = (request: import('node:http').IncomingMessage, error: unknown) => logger.warn('API request failed', { url: request.url, error: error instanceof Error ? error.message : String(error) });
const http = createServer(async (request, response) => {
  const startedAt = Date.now();
  const clientIp = request.socket.remoteAddress ?? '';
  response.on('finish', () => {
    const detail = { method: request.method ?? '', url: request.url ?? '', status: response.statusCode, ms: Date.now() - startedAt, ip: clientIp };
    if (request.url === '/healthz') return logger.debug('HTTP', detail);
    logger.info('HTTP', detail);
  });
  try {
  const headers = { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'cache-control': 'public, max-age=60' };
  if (request.url === '/healthz') { response.writeHead(200, { ...headers, 'cache-control': 'no-store' }); response.end(JSON.stringify({ ok: true, online: clients.size })); return; }
  const match = request.url?.match(/^\/town-api\/works\?scope=(knowledge|senate|all|discussion|featured)$/);
  if (request.method === 'GET' && match) {
    try { response.writeHead(200, headers); response.end(JSON.stringify(await getPublicWorks(match[1] as 'knowledge' | 'senate' | 'all' | 'discussion' | 'featured'))); }
    catch (error) { logApiError(request, error); response.writeHead(502, { ...headers, 'cache-control': 'no-store' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Upstream unavailable' })); }
    return;
  }
  if (request.method === 'POST' && request.url === '/town-api/works/query') {
    try { const body=await readJson(request); response.writeHead(200,headers); response.end(JSON.stringify(await queryPublicWorks(body.query))); }
    catch(error){ logApiError(request, error); response.writeHead(502,{...headers,'cache-control':'no-store'}); response.end(JSON.stringify({error:error instanceof Error?error.message:'Upstream unavailable'})); }
    return;
  }
  if (request.method === 'POST' && request.url === '/town-api/pl/login') {
    try {
      const attempt = physicsLoginAttempts.get(clientIp) ?? { count: 0, startedAt: Date.now() };
      if (Date.now() - attempt.startedAt >= 60_000) { attempt.startedAt = Date.now(); attempt.count = 0; }
      if (++attempt.count > MAX_PHYSICS_LOGINS_PER_MINUTE) {
        logger.warn('Physics Lab login rate limit exceeded', { ip: clientIp });
        response.writeHead(429, { ...headers, 'cache-control': 'no-store', 'retry-after': '60' });
        response.end(JSON.stringify({ error: 'Too many login attempts' }));
        return;
      }
      physicsLoginAttempts.set(clientIp, attempt);
      const body = await readJson(request); const login = typeof body.login === 'string' ? body.login.trim() : ''; const password = typeof body.password === 'string' ? body.password : '';
      if (!login || !password || login.length > 160 || password.length > 256) throw new Error('Login details are invalid');
      const result = await authenticateAccount(login, password); physicsLoginAttempts.delete(clientIp); const id = randomUUID();
      const user = { id: String(result.user?.ID || id), nickname: String(result.user?.Nickname || login), email: null, position: { x: 0, y: 0, z: -6 } };
      physicsSessions.set(id, { token: result.token, authCode: result.authCode, user, expiresAt: Date.now() + PHYSICS_SESSION_TTL_MS });
      response.writeHead(200, headers); response.end(JSON.stringify({ session: id, user }));
    } catch (error) { logApiError(request, error); response.writeHead(401, { ...headers, 'cache-control': 'no-store' }); response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Physics Lab login failed' })); }
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
    } catch(error){logApiError(request, error);response.writeHead(502,headers);response.end(JSON.stringify({error:error instanceof Error?error.message:'Work request failed'}));}
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
    catch(error){logApiError(request, error);response.writeHead(400,headers);response.end(JSON.stringify({error:error instanceof Error?error.message:'Follow request failed'}));}return;
  }
  response.writeHead(404, { 'x-content-type-options': 'nosniff' }); response.end();
  } catch (error) {
    logger.error('Unhandled request error', { url: request.url, error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    if (!response.headersSent) response.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ error: 'Internal server error' }));
  }
});
const wss = new WebSocketServer({ server: http, maxPayload: 16 * 1024 });
wss.on('connection', (socket) => { const client = { socket, user: null as unknown as User, ready: false }; const address = remoteAddress(socket); logger.info('WebSocket connected', { ip: address }); socket.on('message', (data) => handle(client, data.toString())); socket.on('close', () => { if (client.ready && clients.get(client.user.id)?.socket === socket) { flushPosition(client.user.id); clients.delete(client.user.id); logger.info('Resident left', { id: client.user.id, nickname: client.user.nickname, online: clients.size }); broadcast({ type: 'player.left', playerId: client.user.id }); } }); });
http.requestTimeout = 15_000;
http.headersTimeout = 20_000;
http.keepAliveTimeout = 5_000;
http.listen(PORT, HOST, () => logger.info(`MiniCity server listening on http://${HOST}:${PORT}`));
