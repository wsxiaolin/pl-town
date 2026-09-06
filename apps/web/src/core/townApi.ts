// The frontend ships as a static site while the backend usually lives on a
// separate origin (Render). HTTP calls resolve against a build-time API base
// injected by vite.config.ts: VITE_API_BASE wins when set, otherwise it is
// derived from VITE_SERVER_URL (wss -> https), and when neither is configured
// requests stay same-origin (local dev proxy and single-domain self-hosted
// deployments). Cross-origin responses rely on the server's origin allowlist
// (CORS) mirroring the WebSocket origin check.

declare const __TOWN_API_BASE__: string;

const apiBase = (): string => {
  const base = typeof __TOWN_API_BASE__ === 'string' ? __TOWN_API_BASE__ : '';
  return base.replace(/\/+$/, '');
};

export const townApiUrl = (path: string): string => `${apiBase()}${path}`;

export const townApiFetch = (path: string, init?: RequestInit): Promise<Response> => fetch(townApiUrl(path), init);
