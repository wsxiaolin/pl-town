import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

async function shot(page) {
  return PNG.sync.read(await page.screenshot({ animations: 'disabled' }));
}

async function burstAlternation(page, frames, region) {
  const W = frames[0].width;
  const found = [];
  const colors = new Set();
  for (let y = region.y; y < region.y + region.h; y += 2) {
    for (let x = region.x; x < region.x + region.w; x += 2) {
      let prev = -1, changes = 0;
      for (let f = 0; f < frames.length; f++) {
        const idx = (y * W + x) * 4;
        const r = frames[f].data[idx], g = frames[f].data[idx + 1], b = frames[f].data[idx + 2];
        if (prev >= 0 && Math.abs(r - ((prev >> 16) & 255)) + Math.abs(g - ((prev >> 8) & 255)) + Math.abs(b - (prev & 255)) > 24) changes++;
        prev = (r << 16) | (g << 8) | b;
        colors.add(`${r},${g},${b}`);
      }
      if (changes >= 3) found.push({ x, y, changes });
    }
  }
  return { found, colors };
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

  // zoom to ~10
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -250); await page.waitForTimeout(60); }
  await page.waitForTimeout(700);

  const frames = [];
  for (let i = 0; i < 8; i++) { frames.push(await shot(page)); await page.waitForTimeout(120); }

  const res = await burstAlternation(page, frames, { x: 500, y: 0, w: 780, h: 400 });
  console.log('flicker points:', res.found.length);
  if (res.found.length) {
    const xs = res.found.map(p => p.x), ys = res.found.map(p => p.y);
    console.log('bbox x:', Math.min(...xs), '-', Math.max(...xs), ' y:', Math.min(...ys), '-', Math.max(...ys));
    const sample = res.found.slice(0, 6);
    for (const p of sample) {
      const colorsSeen = new Set();
      for (let f = 0; f < frames.length; f++) {
        const idx = (p.y * frames[0].width + p.x) * 4;
        colorsSeen.add(`#${frames[f].data[idx].toString(16).padStart(2, '0')}${frames[f].data[idx + 1].toString(16).padStart(2, '0')}${frames[f].data[idx + 2].toString(16).padStart(2, '0')}`);
      }
      console.log(`pixel(${p.x},${p.y}) alternates between:`, [...colorsSeen].join(' '));
    }
  }

  await browser.close();
  process.exit(0);
}

main();
