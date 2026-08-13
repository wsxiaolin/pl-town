import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: webRoot,
  base: process.env.BASE_PATH || '/', // GitHub Pages 部署在子路径时注入（如 /pl-town/）
  define: {
    __CF_PAGES__: process.env.CF_PAGES === '1',
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/town-api': 'http://127.0.0.1:8787',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          animation: ['gsap'],
        },
      },
    },
  },
});
