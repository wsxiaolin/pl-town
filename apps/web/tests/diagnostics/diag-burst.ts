import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

async function shot(page) {
  return PNG.sync.read(await page.screenshot({ animations: 'disabled' }));
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV2', 'true');
    localStorage.setItem('minicityUser', 'tester');
  });
  await page.goto('http://127.0.0.1:4173/');
  await page.waitForTimeout(7000);
  await page.evaluate(() => {
    const lw = document.getElementById('labelsWrap');
    if (lw) lw.style.display = 'none';
  });

  await page.mouse.move(640, 400);
  // zoom in to ~7 (buildings larger), center on origin
  for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(60); }
  await page.waitForTimeout(700);

  // burst: 10 frames, ~120ms apart
  const frames = [];
  for (let i = 0; i < 10; i++) {
    frames.push(await shot(page));
    await page.waitForTimeout(120);
  }

  // For each pixel region (whole screen), count color-state changes across the burst.
  // z-fighting => pixel alternates (>=3 changes). NPC pass => 1 change.
  const W = frames[0].width, H = frames[0].height;
  const flicker = new Map(); // "x,y" -> changes
  const cells = new Map();   // aggregate per 8x8 cell
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      let prev = -1, changes = 0;
      for (let f = 0; f < frames.length; f++) {
        const idx = (y * W + x) * 4;
        const key = (frames[f].data[idx] << 16) | (frames[f].data[idx + 1] << 8) | frames[f].data[idx + 2];
        if (prev >= 0 && Math.abs(((key >> 16) & 255) - ((prev >> 16) & 255)) + Math.abs(((key >> 8) & 255) - ((prev >> 8) & 255)) + Math.abs((key & 255) - (prev & 255)) > 24) changes++;
        prev = key;
      }
      if (changes >= 3) {
        flicker.set(`${x},${y}`, changes);
        const cy = (y / 64) | 0, cx = (x / 80) | 0;
        const k = `${cx},${cy}`;
        cells.set(k, (cells.get(k) || 0) + 1);
      }
    }
  }
  console.log('total flicker sample points:', flicker.size);
  const rows = [];
  for (let cy = 0; cy < 13; cy++) {
    let row = '';
    for (let cx = 0; cx < 16; cx++) {
      const n = cells.get(`${cx},${cy}`) || 0;
      row += (n > 40 ? '#' : n > 10 ? '+' : n > 0 ? '.' : ' ').padStart(3);
    }
    rows.push(row);
  }
  console.log('FLICKER MAP (z-fight alternation), 16x13 cells:');
  console.log(rows.join('\n'));

  await browser.close();
}

main();
