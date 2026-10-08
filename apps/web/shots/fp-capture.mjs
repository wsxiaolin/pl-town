import { chromium } from 'playwright';

/**
 * Standalone visual-capture script for the first-person toon restyle.
 * Boots the city (offline WebSocket), pins the town clock to a chosen game
 * hour, enters first person, and captures screenshots for VLM review.
 *
 * Usage: node shots/fp-capture.mjs <outDir> <gameHour>
 */
const outDir = process.argv[2] ?? '/home/z/my-project/pl-town-fps/shots';
const gameHour = Number(process.argv[3] ?? '12');
const base = Date.now();
// Each 60,000 real ms advances the town clock by one game hour.
const currentGameHour = ((base + 8 * 3600_000) / 60_000) % 24;
const shift = ((gameHour - currentGameHour + 24) % 24) * 60_000;
const pinned = base + shift;

const browser = await chromium.launch({
  // Headed under Xvfb, matching playwright.config.ts — headless Chromium
  // cannot reliably hold the WebGL context through heavy toon-frame renders.
  headless: false,
  dumpio: true,
  args: [
    '--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox',
    '--window-size=1280,800', '--disable-dev-shm-usage',
  ],
});
const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
await page.addInitScript(({ pinnedAt }) => {
  class OfflineWebSocket extends EventTarget {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    readyState = OfflineWebSocket.CONNECTING;
    constructor() {
      super();
      queueMicrotask(() => {
        this.readyState = OfflineWebSocket.OPEN;
        this.dispatchEvent(new Event('open'));
      });
    }
    send() {}
    close() {
      this.readyState = OfflineWebSocket.CLOSED;
      this.dispatchEvent(new Event('close'));
    }
  }
  Object.defineProperty(window, 'WebSocket', { value: OfflineWebSocket });
  localStorage.setItem('minicityCGSeenV3', 'true');
  localStorage.setItem('minicityUser', 'shot-capture');
  localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  // Pin the accelerated town clock to the requested game hour.
  Date.now = () => pinnedAt;
}, { pinnedAt: pinned });

await page.goto('http://localhost:46173/');
await page.waitForFunction(() => Boolean(window._mini?.player), null, { timeout: 30_000 });
await page.waitForFunction(() => document.querySelector('#bootScreen')?.classList.contains('is-ready'), null, { timeout: 30_000 });
await page.waitForTimeout(1_200);

// The FP controller is wired during city boot; on loaded hosts it can lag a
// beat behind the boot screen — poll it briefly instead of hard-failing.
await page.waitForFunction(() => Boolean(window._mini?.firstPerson?.enter), null, { timeout: 15_000 });
const bootInfo = await page.evaluate(() => ({
  bundle: performance.getEntriesByType('resource').filter(e => e.name.includes('main-')).map(e => e.name.split('/').pop())[0] ?? 'inline',
  hasFirstPerson: Boolean(window._mini?.firstPerson?.enter),
}));
console.log('BOOT', JSON.stringify(bootInfo));
await page.waitForTimeout(200);

// Single capture per browser launch (software-GL readback is memory-heavy and
// the browser tends to crash right after the first big screenshot).
const shot = process.argv[4] ?? 'street';
if (shot === 'sky') {
  // Aim at the sun (day) / moon (night) before entering: rotate the shared
  // cursor toward the body's horizontal bearing — the FP camera inherits it
  // on enter — then look up through drag-look synthetic pointer events.
  await page.evaluate(() => {
    // Sun direction mirrors toonSky's default: (0.45, 0.62, 0.3); moon is
    // opposite. cursor.rotation.y = atan2(dirX, dirZ).
    const day = !document.body.classList.contains('night');
    const dx = day ? 0.45 : -0.45;
    const dz = day ? 0.3 : -0.3;
    const player = window._mini.player;
    player.rotation.y = Math.atan2(dx, dz);
    window._mini.firstPerson.enter();
    // enter() requests pointer lock; when the automation environment
    // "grants" it the drag-look fallback stays disabled. Force it off so the
    // synthetic drag below is honored.
    if (document.pointerLockElement) document.exitPointerLock();
  });
  await page.waitForTimeout(1_600);
  // Elevation of the sun/moon is ≈49°; pitch up ~55° for margin.
  // drag-look applies movementY * LOOK_SENSITIVITY (0.0023 rad/px).
  const lookPixels = Math.round((55 * Math.PI / 180) / 0.0023); // ≈ 417 px
  // Real mouse events carry genuine movementX/Y (synthetic PointerEvent
  // movement fields are unreliable in Chromium).
  // Minimal event count: each input-driven hit-test is a crash opportunity
  // under software GL — one down, one big move, one up.
  await page.mouse.move(480, 300);
  await page.mouse.down();
  await page.mouse.move(480, 300 - lookPixels, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(700);
} else if (shot === 'street') {
  await page.evaluate(() => window._mini.firstPerson.enter());
  await page.waitForTimeout(1_600);
  await page.mouse.move(480, 300);
}
await page.screenshot({ path: `${outDir}/fp-${shot}-${gameHour}.jpg`, type: 'jpeg', quality: 82 });
const state = await page.evaluate(() => ({
  night: document.body.dataset.theme ?? 'unknown',
  skyDome: Boolean(window._mini.scene.getObjectByName('toon-sky-dome')),
  toon: window._mini.firstPerson?.worldStyle?.toonActive?.() ?? false,
}));
console.log('STATE', JSON.stringify(state));
await browser.close();
