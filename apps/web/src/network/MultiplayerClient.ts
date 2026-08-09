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

type Callbacks = {
  connected?: (user: NetUser, players: NetUser[], houses: House[]) => void;
  connection?: (state: 'connecting' | 'connected' | 'disconnected') => void;
  playerJoined?: (player: NetUser) => void;
  playerMoved?: (id: string, position: NetPosition) => void;
  playerLeft?: (id: string) => void;
  chat?: (message: { userId: string; nickname: string; text: string }) => void;
  houses?: (houses: House[]) => void;
  requests?: (requests: HousingRequest[]) => void;
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
    let message: any; try { message = JSON.parse(raw); } catch { return; }
    if (message.type === 'hello') { if (message.token) localStorage.setItem(TOKEN_KEY, message.token); this.authorized = true; this.user = message.user; this.callbacks.connection?.('connected'); this.callbacks.connected?.(message.user, message.players ?? [], message.houses ?? []); this.callbacks.requests?.(message.requests ?? []); }
    else if (message.type === 'player.joined') this.callbacks.playerJoined?.(message.player);
    else if (message.type === 'player.moved') this.callbacks.playerMoved?.(message.playerId, message.position);
    else if (message.type === 'player.left') this.callbacks.playerLeft?.(message.playerId);
    else if (message.type === 'chat') this.callbacks.chat?.(message);
    else if (message.type === 'housing.updated' || message.type === 'housing.list') this.callbacks.houses?.(message.houses ?? []);
    else if (message.type === 'housing.requests') this.callbacks.requests?.(message.requests ?? []);
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
  private send(message: object) { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message)); }
  position(position: NetPosition) { this.send({ type: 'position', position }); }
  chat(text: string) { this.send({ type: 'chat', text }); }
  housing(type: string, payload: Record<string, unknown> = {}) { this.send({ type: `housing.${type}`, ...payload }); }
  close() { this.closed = true; window.clearTimeout(this.reconnectTimer); this.socket?.close(); this.socket = null; }
}
