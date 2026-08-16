import { defineConfig, devices } from '@playwright/test';

// The city renders with Three.js / WebGL. Headless Chromium (including the
// new headless shell and full Chromium in --headless=new) cannot acquire a
// WebGL context, so the app never boots and every smoke/movement test fails.
// Running headed Chromium under Xvfb with a software GL driver (Vulkan via
// ANGLE) is the only reliable way to exercise WebGL in CI / containers. The
// launch flags below are harmless on machines with a real GPU.
const webglChromiumArgs = [
  // Vulkan via ANGLE is the fastest software-GL backend available in Chromium
  // and keeps requestAnimationFrame firing often enough for frame-based tests
  // (player movement) to stay deterministic on CPU-only CI runners.
  '--use-gl=angle',
  '--use-angle=vulkan',
  '--enable-features=Vulkan',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--no-sandbox',
];

export default defineConfig({
  testDir: './tests',
  // Tests are page-scoped: each one boots its own city via addInitScript and a
  // mocked WebSocket, so they can run in parallel against the shared dev server.
  fullyParallel: true,
  // Default to a single worker for interactive `npm run test:web`; CI raises
  // this via PLAYWRIGHT_WORKERS / matrix sharding for throughput.
  workers: Number(process.env.PLAYWRIGHT_WORKERS) || 1,
  timeout: 60_000,
  // Surface shard env vars set by `playwright test --shard=x/y` / CI matrix.
  shard: process.env.PLAYWRIGHT_SHARD
    ? {
        current: Number(process.env.PLAYWRIGHT_SHARD.split('/')[0]),
        total: Number(process.env.PLAYWRIGHT_SHARD.split('/')[1]),
      }
    : undefined,
  // Keep retries modest: WebGL-on-swiftshader is deterministic, but boot timing
  // under load can occasionally flake on shared CI runners.
  retries: process.env.CI ? 2 : 0,
  reportSlowTests: null,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    browserName: 'chromium',
    // Headed is required for WebGL (see note above). Run via the
    // scripts/run-web-tests.sh Xvfb wrapper in headless environments.
    headless: false,
    launchOptions: {
      args: webglChromiumArgs,
    },
  },
  webServer: {
    command: 'npm run dev -w @minicity/web -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
