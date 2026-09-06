type ServerEnv = { VITE_SERVER_URL?: string; VITE_API_BASE_URL?: string };
type ServerLocation = Pick<Location, 'hostname' | 'protocol'>;

const environment = (): ServerEnv => (import.meta as ImportMeta & { env?: ServerEnv }).env ?? {};

// Product deployment: production and single-label Cloudflare Pages previews.
const isProductHost = (hostname: string): boolean => /^(?:[a-z0-9-]+\.)?pl-town\.pages\.dev$/i.test(hostname);

export function getServerUrl(env: ServerEnv = environment(), location: ServerLocation = window.location): string {
  if (env.VITE_SERVER_URL) return env.VITE_SERVER_URL;
  if (isProductHost(location.hostname)) return 'wss://plaqtown.onrender.com';
  const hostname = location.hostname;
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]';
  const protocol = location.protocol === 'https:' || !loopback ? 'wss:' : 'ws:';
  return `${protocol}//${hostname}:8787`;
}

export function getApiUrl(path: string, env: ServerEnv = environment(), location: ServerLocation = window.location): string {
  const configured = env.VITE_API_BASE_URL || env.VITE_SERVER_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.protocol === 'ws:') url.protocol = 'http:';
    if (url.protocol === 'wss:') url.protocol = 'https:';
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new TypeError('Expected an HTTP or WebSocket server URL');
    return new URL(path, url.origin).href;
  }
  return isProductHost(location.hostname) ? new URL(path, 'https://plaqtown.onrender.com').href : path;
}

export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(getApiUrl(path), init);
}
