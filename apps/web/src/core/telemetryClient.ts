// Lightweight analytics + error capture. Reports user events and uncaught
// errors to the server's /town-api/telemetry endpoints. Failures are silent
// so analytics never breaks the game.

const SESSION_KEY = 'minicity.sessionId';
let sessionId = '';
let userId: string | null = null;
const eventId = /^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/;

const generateId = (): string => {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch { /* fall through */ }
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/x/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const loadSessionId = (): string => {
  try {
    let value = sessionStorage.getItem(SESSION_KEY);
    if (!value) { value = generateId(); sessionStorage.setItem(SESSION_KEY, value); }
    return value;
  } catch { return 'anon'; }
};

const send = (path: string, payload: Record<string, unknown>): void => {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(path, blob)) return;
    }
    void fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => { /* ignore */ });
  } catch { /* ignore */ }
};

const dedupe = new Map<string, number>();
const withinDedupe = (key: string): boolean => {
  const now = Date.now();
  const last = dedupe.get(key);
  const fresh = last === undefined || now - last > 2_000;
  if (fresh) dedupe.set(key, now);
  return fresh;
};

export function setTelemetryUser(id: string | null): void {
  userId = id;
}

export function trackEvent(event: string, properties: Record<string, unknown> = {}): void {
  if (!eventId.test(event)) return;
  if (!withinDedupe(`event:${event}:${JSON.stringify(properties)}`)) return;
  send('/town-api/telemetry/event', { event, properties, sessionId, userId });
};

// Map an outbound WebSocket message to a telemetry event. Centralised here so
// every business action (chat, progression, story, housing) is recorded without
// touching each caller. `hello` (carries credentials) and `position` (high-rate)
// are excluded; only a whitelist of safe, non-sensitive fields is forwarded.
const TRACKED_FIELDS = ['buildingId', 'achievementId', 'itemId', 'rewardId', 'storyId', 'nodeId', 'name', 'kind', 'userId', 'quantity', 'requestId'];
const SKIP_OUTBOUND = new Set(['hello', 'position']);
export function trackClientMessage(message: Record<string, unknown> | null | undefined): void {
  const type = message?.type;
  if (typeof type !== 'string' || SKIP_OUTBOUND.has(type) || !eventId.test(type)) return;
  const properties: Record<string, unknown> = {};
  for (const key of TRACKED_FIELDS) if (key in message!) properties[key] = message![key];
  if (typeof message!.text === 'string') properties.length = message!.text.length;
  trackEvent(type, properties);
};

const reportError = (kind: string, message: string, stack?: string): void => {
  if (!message) return;
  if (!withinDedupe(`error:${kind}:${message}`)) return;
  send('/town-api/telemetry/error', { kind, message: message.slice(0, 1_000), stack: stack?.slice(0, 4_000), url: location.href, userAgent: navigator.userAgent, sessionId, userId });
};

let initialized = false;
export function initTelemetry(): void {
  if (initialized) return;
  initialized = true;
  sessionId = loadSessionId();
  globalThis.addEventListener('error', (event) => {
    const message = event.message || (event.error instanceof Error ? event.error.message : 'Unknown error');
    const stack = event.error instanceof Error ? event.error.stack ?? undefined : undefined;
    reportError('runtime', message, stack);
  });
  globalThis.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Unhandled promise rejection';
    const stack = reason instanceof Error ? reason.stack ?? undefined : undefined;
    reportError('unhandled', message, stack);
  });
  trackEvent('session.start', { referrer: document.referrer });
  globalThis.addEventListener('pagehide', () => trackEvent('session.end'));
}
