import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: webRoot,
  base: process.env.BASE_PATH || '/', // GitHub Pages 部署在子路径时注入（如 /pl-town/）
  define: {
    __CF_PAGES__: JSON.stringify(process.env.CF_PAGES === '1'),
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: ['.monkeycode-ai.online'],
    proxy: {
      '/town-api': 'http://127.0.0.1:8787',
      '/admin/': 'http://127.0.0.1:8787',
      '/ws': {
        target: 'http://127.0.0.1:8787',
        ws: true,
      },
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
