// Resolve HTTP API requests for static hosting and local development.
declare const __TOWN_VITE_API_BASE__: string;
declare const __TOWN_VITE_SERVER_URL__: string;

const apiBase = (): string => {
  const explicit = __TOWN_VITE_API_BASE__.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const server = __TOWN_VITE_SERVER_URL__.trim();
  if (server) {
    try {
      const url = new URL(server);
      const protocol = url.protocol === 'wss:' ? 'https:' : url.protocol === 'ws:' ? 'http:' : url.protocol;
      return `${protocol}//${url.host}`;
    } catch {
      return '';
    }
  }
  return '';
};

export const townApiFetch = (path: string, init?: RequestInit): Promise<Response> => fetch(`${apiBase()}${path}`, init);
