import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

// The HTTP API base mirrors the WebSocket endpoint: static hosts point
// VITE_SERVER_URL at the backend and the browser calls /town-api on that
// origin directly (CORS). Injected as a compile-time constant because the
// unit-test emit config targets CommonJS, where import.meta is unavailable.
const townApiBase = (): string => {
  const explicit = process.env.VITE_API_BASE?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  const server = process.env.VITE_SERVER_URL?.trim();
  if (server) {
    try {
      const url = new URL(server);
      const protocol = url.protocol === 'wss:' ? 'https:' : url.protocol === 'ws:' ? 'http:' : url.protocol;
      return `${protocol}//${url.host}`.replace(/\/+$/, '');
    } catch { /* fall back to same-origin */ }
  }
  return '';
};

export default defineConfig({
  root: webRoot,
  base: process.env.BASE_PATH || '/', // GitHub Pages 部署在子路径时注入（如 /pl-town/）
  define: {
    __CF_PAGES__: JSON.stringify(process.env.CF_PAGES === '1'),
    __TOWN_API_BASE__: JSON.stringify(townApiBase()),
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.monkeycode-ai.online'],
    proxy: {
      '/town-api': 'http://127.0.0.1:8787',
    },
  },
  build: {
    rollupOptions: {
      // Multi-page application: the city game shell and the standalone NPC
      // edit-request page are built as separate HTML entries from one source.
      input: {
        main: resolve(webRoot, 'index.html'),
        'npc-edit-request': resolve(webRoot, 'npc-edit-request.html'),
      },
      output: {
        manualChunks: {
          three: ['three'],
          animation: ['gsap'],
        },
      },
    },
  },
});
