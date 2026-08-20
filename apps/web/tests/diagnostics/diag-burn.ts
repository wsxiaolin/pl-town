// Diagnostic: visually verify the burn-city effect spreads east -> west and
// consumes the whole map. Run inside the test Docker image (Xvfb + SwiftShader)
// against the dev/preview server on 127.0.0.1:4173.
//
//   node apps/web/tests/diagnostics/diag-burn.ts
//
// Captures a baseline frame, triggers the burn via the debug API, then samples
// frames through the burn and writes them to diagnostics-output/burn-*.png.
// Also prints a per-column brightness map so the east->west fire front is
// visible even without looking at the PNGs.
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';

const BASE = 'http://127.0.0.1:4173/';

function waitForPort(port: number, host = '127.0.0.1', timeout = 30_000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const sock = createConnection({ port, host }, () => { sock.end(); resolve(); });
      sock.on('error', () => {
        if (Date.now() - start > timeout) reject(new Error(`port ${port} not up in ${timeout}ms`));
        else setTimeout(probe, 400);
      });
    };
    probe();
  });
}

async function shot(page): Promise<PNG> {
  return PNG.sync.read(await page.screenshot({ animations: 'disabled' }));
}

// Average brightness per horizontal third (east = right third, west = left).
function regionBrightness(png: PNG) {
  const W = png.width, H = png.height;
  const sums = { west: 0, mid: 0, east: 0, westN: 0, midN: 0, eastN: 0 };
  for (let y = 0; y < H; y += 8) {
    for (let x = 0; x < W; x += 8) {
      const i = (y * W + x) * 4;
      const br = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      if (x > (W * 2) / 3) { sums.east += br; sums.eastN++; }
      else if (x > W / 3) { sums.mid += br; sums.midN++; }
      else { sums.west += br; sums.westN++; }
    }
  }
  return {
    west: Math.round(sums.west / Math.max(1, sums.westN)),
    mid: Math.round(sums.mid / Math.max(1, sums.midN)),
    east: Math.round(sums.east / Math.max(1, sums.eastN)),
  };
}

async function main() {
  const preview = spawn('npm', ['run', 'preview', '-w', '@minicity/web', '--', '--port', '4173', '--host', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe'], cwd: '/work',
  });
  preview.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
  preview.stderr.on('data', (d) => process.stderr.write(`[preview] ${d}`));
  try {
    await waitForPort(4173);
    console.log('preview up');

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Mock the game WebSocket as offline so the city boots without a server, and
  // seed localStorage so the CG intro is skipped and a resident exists.
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    class OfflineGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      send() {}
      close() { this.readyState = NativeWebSocket.CLOSED; }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new OfflineGameWebSocket() : Reflect.construct(Target, args); },
    }) });
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'diag-burn');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (m.type() === 'error' || t.startsWith('[burn]')) console.log(`[${m.type()}]`, t);
  });

  await page.goto(BASE);
  // Wait for the debug API + player cursor, then the boot screen to be ready.
  await page.waitForFunction(() => Boolean((window as any)._mini?.player), undefined, { timeout: 30_000 });
  await page.waitForFunction(() => document.getElementById('bootScreen')?.classList.contains('is-ready'), undefined, { timeout: 30_000 });
  await page.waitForTimeout(1500);

  // Hide the building-label overlay so it does not occlude the map, and zoom
  // out to the whole-map far view so the east->west spread is visible.
  await page.evaluate(() => { const lw = document.getElementById('labelsWrap'); if (lw) lw.style.display = 'none'; });
  await page.mouse.move(640, 400);
  for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(80); }
  await page.waitForTimeout(700);

  const base = await shot(page);
  fs.mkdirSync('diagnostics-output', { recursive: true });
  fs.writeFileSync('diagnostics-output/burn-00-baseline.png', PNG.sync.write(base));
  console.log('baseline brightness:', regionBrightness(base));

  // Trigger the burn via the debug API (same path as clicking 文训社·外环).
  const started = await page.evaluate(() => (window as any)._mini?.burnCity());
  console.log('burn triggered:', started);

  // Sample frames across the burn duration.
  const samples = [400, 900, 1400, 1900, 2400, 3000, 3600, 4200, 5000, 6000, 7000];
  for (let k = 0; k < samples.length; k++) {
    const t = samples[k];
    await page.waitForTimeout(k === 0 ? t : t - samples[k - 1]);
    const png = await shot(page);
    const name = `burn-${String(k + 1).padStart(2, '0')}.png`;
    fs.writeFileSync(`diagnostics-output/${name}`, PNG.sync.write(png));
    const st = await page.evaluate(() => { const m = (window as any)._mini; return { p: m?.burnCityProgress?.(), a: m?.burnCityActive?.() }; });
    console.log(`t=${t}ms`, name, regionBrightness(png), 'progress', st.p, 'active', st.a);
  }

  // Final: confirm the burn effect ended (no longer active).
  const leftover = await page.evaluate(() => {
    const m = (window as any)._mini;
    return { active: m ? m.burnCityActive?.() : 'no-mini' };
  });
  console.log('overlay after burn:', leftover);

  await browser.close();
  } finally {
    preview.kill('SIGTERM');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
