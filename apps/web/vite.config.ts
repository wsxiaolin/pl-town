import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

// Cloudflare Pages injects CF_PAGES=1 at build time, and keeps Production and
// Preview environments on separate variable sets. A preview branch can therefore
// build without VITE_SERVER_URL and silently point its API and WebSocket at its
// own hostname. Fall back to the shared Render backend on Pages so every branch
// preview reaches the backend.
const cloudflarePages = process.env.CF_PAGES === '1';
const fallbackServerUrl = 'wss://pl-town.onrender.com';
const serverUrl = process.env.VITE_SERVER_URL ?? (cloudflarePages ? fallbackServerUrl : '');

export default defineConfig({
  root: webRoot,
  base: process.env.BASE_PATH || '/', // GitHub Pages 部署在子路径时注入（如 /pl-town/）
  define: {
    __CF_PAGES__: JSON.stringify(cloudflarePages),
    __TOWN_VITE_API_BASE__: JSON.stringify(process.env.VITE_API_BASE ?? ''),
    __TOWN_VITE_SERVER_URL__: JSON.stringify(serverUrl),
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
