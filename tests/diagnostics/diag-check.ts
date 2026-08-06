import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

async function shot(page) {
  return PNG.sync.read(await page.screenshot({ animations: 'disabled' }));
}

// Per-cell change map between two frames; W x H grid, symbols: # >15% + >3% . >0.3%
function cellMap(a, b, W, H) {
  const rows = [];
  for (let cy = 0; cy < H; cy++) {
    let row = '';
    for (let cx = 0; cx < W; cx++) {
      let changed = 0, total = 0;
      for (let yy = cy * a.height / H; yy < (cy + 1) * a.height / H; yy += 3) {
        for (let xx = cx * a.width / W; xx < (cx + 1) * a.width / W; xx += 3) {
          const ai = ((yy | 0) * a.width + (xx | 0)) * 4, bi = ((yy | 0) * b.width + (xx | 0)) * 4;
          total++;
          if (Math.abs(a.data[ai] - b.data[bi]) + Math.abs(a.data[ai + 1] - b.data[bi + 1]) + Math.abs(a.data[ai + 2] - b.data[bi + 2]) > 24) changed++;
        }
      }
      const pct = (changed / total) * 100;
      row += (pct > 15 ? '#' : pct > 3 ? '+' : pct > 0.3 ? '.' : ' ').padStart(3);
    }
    rows.push(row);
  }
  return rows.join('\n');
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV2', 'true');
    localStorage.setItem('minicityUser', 'tester');
  });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(7000);

  await page.evaluate(() => {
    const lw = document.getElementById('labelsWrap');
    if (lw) lw.style.display = 'none';
  });

  // ---- A: FAR view (whole map) ----
  await page.mouse.move(640, 400);
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(80); }
  await page.waitForTimeout(600);
  const a = await shot(page);
  await page.waitForTimeout(350);
  const b = await shot(page);
  console.log('=== FAR whole-map idle change (16x12) ===');
  console.log(cellMap(a, b, 16, 12));

  // ---- B: zoom in to ~9 (see campus/screen buildings NE) ----
  for (let i = 0; i < 12; i++) { await page.mouse.wheel(0, -350); await page.waitForTimeout(60); }
  await page.waitForTimeout(500);
  const c = await shot(page);
  await page.waitForTimeout(350);
  const d = await shot(page);
  console.log('=== NEAR center idle change (16x12) ===');
  console.log(cellMap(c, d, 16, 12));

  // save reference images
  const fs = await import('node:fs');
  fs.mkdirSync('diagnostics-output', { recursive: true });
  fs.writeFileSync('diagnostics-output/snap-near.png', PNG.sync.write(c));
  fs.writeFileSync('diagnostics-output/snap-far.png', PNG.sync.write(a));
  await browser.close();
}

main();
