import { setTelemetryUser, trackClientMessage, trackEvent } from '../core/telemetryClient';

export type NetPosition = { x: number; y: number; z: number; rotation?: number };
export type NetUser = { id: string; nickname: string; email: string | null; position: NetPosition };
export type House = { buildingId: string; name: string | null; ownerId: string; ownerNickname: string; members: Array<{ userId: string; nickname: string }> };
export type HousingRequest = {
  id: number;
  buildingId: string;
  houseName: string | null;
  ownerId: string;
  ownerNickname: string;
  requesterId: string;
  requesterNickname: string;
  targetId: string;
  targetNickname: string;
  kind: 'invite' | 'application';
  createdAt: string;
};
export type NetPlayerProgress = { currency: number; inventory: Record<string, number>; achievements: string[]; unlockedBuildings: string[]; visitedBuildings: string[] };
export type NetProgressionCatalog = {
  initialCurrency: number;
  buildingPrices: Record<string, number>;
  buildingUnlockable?: Record<string, boolean>;
  achievementRewards: Record<string, number>;
  products: Record<string, { itemId: string; name: string; unitPrice: number }>;
};
export type NetStoryProgress = {
  storyId: string;
  definitionVersion: number;
  nodeId: string;
  flags: Record<string, boolean | number | string | null>;
  ending: string | null;
  visitCount: number;
  updatedAt: string;
};
export type NetWeather = 'clear' | 'rain' | 'snow' | 'snow-deep';

type ServerMessage =
  | { type: 'hello'; token?: string; user?: NetUser; players?: NetUser[]; houses?: House[]; requests?: HousingRequest[]; progress?: NetPlayerProgress; catalog?: NetProgressionCatalog; weather?: NetWeather }
  | { type: 'player.joined'; player: NetUser }
  | { type: 'player.moved'; playerId: string; position: NetPosition }
  | { type: 'player.left'; playerId: string }
  | { type: 'chat'; messageId: number; userId: string; nickname: string; text: string }
  | { type: 'chat.removed'; messageId: number; reason: string }
  | { type: 'housing.updated' | 'housing.list'; houses?: House[] }
  | { type: 'housing.requests'; requests?: HousingRequest[] }
  | { type: 'progress.updated'; progress: NetPlayerProgress; catalog: NetProgressionCatalog; event?: Record<string, unknown> }
  | { type: 'story.updated'; story: NetStoryProgress; event?: Record<string, unknown> }
  | { type: 'world.weather'; weather: NetWeather }
  | { type: 'error'; message?: string };

type Callbacks = {
  connected?: (user: NetUser, players: NetUser[], houses: House[]) => void;
  connection?: (state: 'connecting' | 'connected' | 'disconnected') => void;
  playerJoined?: (player: NetUser) => void;
  playerMoved?: (id: string, position: NetPosition) => void;
  playerLeft?: (id: string) => void;
  chat?: (message: { messageId: number; userId: string; nickname: string; text: string }) => void;
  chatRemoved?: (message: { messageId: number; reason: string }) => void;
  houses?: (houses: House[]) => void;
  requests?: (requests: HousingRequest[]) => void;
  progress?: (progress: NetPlayerProgress, catalog: NetProgressionCatalog, event?: Record<string, unknown>) => void;
  story?: (story: NetStoryProgress, event?: Record<string, unknown>) => void;
  weather?: (weather: NetWeather) => void;
  authenticationFailed?: (message: string) => void;
  error?: (message: string) => void;
};

const TOKEN_KEY = 'minicityServerToken';
const serverUrl = (): string => {
  const configured = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_SERVER_URL;
  if (configured) return configured;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:8787`;
};

export class MultiplayerClient {
  private socket: WebSocket | null = null;
  private reconnectTimer = 0;
  private closed = false;
  private authorized = false;
  private callbacks: Callbacks;
  private credentials: { nickname: string; password?: string } = { nickname: '' };
  user: NetUser | null = null;
  restoringIdentity = false;

  constructor(callbacks: Callbacks) { this.callbacks = callbacks; }
  connect(nickname: string, password?: string) {
    this.closed = false; this.authorized = false; this.callbacks.connection?.('connecting');
    this.restoringIdentity = Boolean(localStorage.getItem(TOKEN_KEY));
    this.credentials = { nickname, password };
    try { this.socket = new WebSocket(serverUrl()); } catch { this.scheduleReconnect(); return; }
    this.socket.addEventListener('open', () => {
      const token = localStorage.getItem(TOKEN_KEY) ?? undefined;
      this.send({ type: 'hello', token, nickname, password: token ? undefined : password });
    });
    this.socket.addEventListener('message', (event) => this.handle(event.data));
    this.socket.addEventListener('close', () => { this.socket = null; this.callbacks.connection?.('disconnected'); if (!this.closed) this.scheduleReconnect(); });
    this.socket.addEventListener('error', () => this.socket?.close());
  }
  private scheduleReconnect() { window.clearTimeout(this.reconnectTimer); this.reconnectTimer = window.setTimeout(() => this.connect(this.credentials.nickname, this.credentials.password), 2500); }
  private handle(raw: string) {
    let message: ServerMessage; try { message = JSON.parse(raw) as ServerMessage; } catch { return; }
    if (message.type === 'hello') { if (message.token) localStorage.setItem(TOKEN_KEY, message.token); this.authorized = true; this.user = message.user ?? null; setTelemetryUser(message.user?.id ?? null); this.callbacks.connection?.('connected'); this.callbacks.connected?.(message.user as NetUser, message.players ?? [], message.houses ?? []); this.callbacks.requests?.(message.requests ?? []); this.callbacks.progress?.(message.progress as NetPlayerProgress, message.catalog as NetProgressionCatalog); if (message.weather) this.callbacks.weather?.(message.weather); trackEvent('player.connect', { nickname: message.user?.nickname }); }
    else if (message.type === 'player.joined') this.callbacks.playerJoined?.(message.player);
    else if (message.type === 'player.moved') this.callbacks.playerMoved?.(message.playerId, message.position);
    else if (message.type === 'player.left') this.callbacks.playerLeft?.(message.playerId);
    else if (message.type === 'chat') this.callbacks.chat?.(message);
    else if (message.type === 'chat.removed') this.callbacks.chatRemoved?.(message);
    else if (message.type === 'housing.updated' || message.type === 'housing.list') this.callbacks.houses?.(message.houses ?? []);
    else if (message.type === 'housing.requests') this.callbacks.requests?.(message.requests ?? []);
    else if (message.type === 'progress.updated') this.callbacks.progress?.(message.progress, message.catalog, message.event);
    else if (message.type === 'story.updated') this.callbacks.story?.(message.story, message.event);
    else if (message.type === 'world.weather') this.callbacks.weather?.(message.weather);
    else if (message.type === 'error') {
      const errorMessage = message.message ?? '服务器请求失败';
      if (!this.authorized && !this.closed) {
        localStorage.removeItem(TOKEN_KEY);
        this.callbacks.authenticationFailed?.(errorMessage);
        this.closed = true;
        window.clearTimeout(this.reconnectTimer);
        this.socket?.close();
        this.socket = null;
      } else this.callbacks.error?.(errorMessage);
    }
  }
  send(message: object): boolean { trackClientMessage(message as Record<string, unknown>); if (this.socket?.readyState !== WebSocket.OPEN) return false; this.socket.send(JSON.stringify(message)); return true; }
  position(position: NetPosition) { this.send({ type: 'position', position }); }
  chat(text: string) { this.send({ type: 'chat', text }); }
  housing(type: string, payload: Record<string, unknown> = {}) { this.send({ type: `housing.${type}`, ...payload }); }
  close() { this.closed = true; window.clearTimeout(this.reconnectTimer); this.socket?.close(); this.socket = null; }
}
