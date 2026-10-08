import { chromium } from 'playwright';
const base = Date.now();
const pinned = base + 12 * 60_000; // force day
const browser = await chromium.launch({
  headless: false, dumpio: true,
  args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox',
    '--window-size=1280,800', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
await page.addInitScript(({ pinnedAt }) => {
  class OfflineWebSocket extends EventTarget {
    static CONNECTING = 0; static OPEN = 1; static CLOSING = 2; static CLOSED = 3;
    readyState = 0;
    constructor() { super(); queueMicrotask(() => { this.readyState = 1; this.dispatchEvent(new Event('open')); }); }
    send() {} close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
  }
  Object.defineProperty(window, 'WebSocket', { value: OfflineWebSocket });
  localStorage.setItem('minicityCGSeenV3', 'true');
  localStorage.setItem('minicityUser', 'walk-tester');
  localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  Date.now = () => pinnedAt;
}, { pinnedAt: pinned });
await page.goto('http://localhost:46173/');
try {
  await page.waitForFunction(() => Boolean(window._mini?.player), null, { timeout: 30_000 });
} catch { console.log('DIAG: _mini.player never appeared'); }
try {
  await page.waitForFunction(() => document.querySelector('#bootScreen')?.classList.contains('is-ready'), null, { timeout: 30_000 });
} catch { console.log('DIAG: boot screen never became ready'); }
await page.waitForTimeout(2000);
const diag = await page.evaluate(() => {
  const mini = window._mini;
  return {
    hasMini: Boolean(mini),
    firstPerson: mini ? String(mini.firstPerson) : 'no-mini',
    fpType: mini && mini.firstPerson ? typeof mini.firstPerson : 'none',
    keys: mini ? Object.keys(mini).slice(0, 40) : [],
    webgl: (() => { try { const c = document.createElement('canvas'); return Boolean(c.getContext('webgl2') || c.getContext('webgl')); } catch { return 'err'; } })(),
  };
});
console.log('DIAG', JSON.stringify(diag, null, 1).slice(0, 900));
console.log('PAGE_ERRORS', JSON.stringify(errors.slice(0, 8), null, 1));
await browser.close();
