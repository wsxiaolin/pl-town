// Resolve HTTP API requests for static hosting and local development.
const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};

const apiBase = (): string => {
  const explicit = env.VITE_API_BASE?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const server = env.VITE_SERVER_URL?.trim();
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
