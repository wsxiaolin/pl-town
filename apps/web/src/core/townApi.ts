// The frontend ships as a static site while the backend usually lives on a
// separate origin (Render). HTTP calls therefore resolve against a build-time
// API base: VITE_API_BASE wins when set, otherwise VITE_SERVER_URL (the
// WebSocket endpoint) converts from ws(s):// to http(s)://, and when neither
// is configured requests stay same-origin (local dev proxy and single-domain
// self-hosted deployments). Cross-origin responses rely on the server's
// origin allowlist (CORS) mirroring the WebSocket origin check.

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};

const apiBase = (): string => {
  const explicit = env.VITE_API_BASE?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const server = env.VITE_SERVER_URL?.trim();
  if (server) {
    try {
      const url = new URL(server);
      const protocol = url.protocol === 'wss:' ? 'https:' : url.protocol === 'ws:' ? 'http:' : url.protocol;
      return `${protocol}//${url.host}`.replace(/\/+$/, '');
    } catch { return ''; }
  }
  return '';
};

export const townApiUrl = (path: string): string => `${apiBase()}${path}`;

export const townApiFetch = (path: string, init?: RequestInit): Promise<Response> => fetch(townApiUrl(path), init);
