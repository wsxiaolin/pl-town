import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';

async function shot(page) {
  return PNG.sync.read(await page.screenshot({ animations: 'disabled' }));
}

async function burstAlternation(page, frames, region) {
  const W = frames[0].width;
  const found = [];
  for (let y = region.y; y < region.y + region.h; y += 2) {
    for (let x = region.x; x < region.x + region.w; x += 2) {
      let prev = -1, changes = 0;
      for (let f = 0; f < frames.length; f++) {
        const idx = (y * W + x) * 4;
        const r = frames[f].data[idx], g = frames[f].data[idx + 1], b = frames[f].data[idx + 2];
        if (prev >= 0 && Math.abs(r - ((prev >> 16) & 255)) + Math.abs(g - ((prev >> 8) & 255)) + Math.abs(b - (prev & 255)) > 24) changes++;
        prev = (r << 16) | (g << 8) | b;
      }
      if (changes >= 3) found.push({ x, y });
    }
  }
  return found;
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

  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -250); await page.waitForTimeout(60); }
  await page.waitForTimeout(700);

  const frames = [];
  console.log('capturing...');
  for (let i = 0; i < 6; i++) { frames.push(await shot(page)); await page.waitForTimeout(100); }
  console.log('captured');

  const found = await burstAlternation(page, frames, { x: 500, y: 0, w: 780, h: 400 });
  console.log('flicker points:', found.length);
  if (!found.length) { await browser.close(); process.exit(0); }
  const xs = found.map(p => p.x), ys = found.map(p => p.y);
  const bbox = { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
  console.log('bbox', JSON.stringify(bbox));

  console.log('evaluating...');
  const result = await page.evaluate(({ bbox, VW, VH }) => {
    const { scene, camera } = window._mini;
    const T = window._mini.THREE;
    const list = [];
    let count = 0;
    scene.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      count++;
      const box = new T.Box3().setFromObject(o);
      if (box.isEmpty()) return;
      const pts = [];
      for (let i = 0; i < 8; i++) {
        const v = new T.Vector3();
        v.copy(box.min); if (i & 1) v.x = box.max.x; if (i & 2) v.y = box.max.y; if (i & 4) v.z = box.max.z;
        pts.push(v);
      }
      let sxMin = Infinity, sxMax = -Infinity, syMin = Infinity, syMax = -Infinity;
      for (const w of pts) {
        const q = w.clone().project(camera);
        if (q.z < -1 || q.z > 1) continue;
        sxMin = Math.min(sxMin, (q.x * 0.5 + 0.5) * VW); sxMax = Math.max(sxMax, (q.x * 0.5 + 0.5) * VW);
        syMin = Math.min(syMin, (-q.y * 0.5 + 0.5) * VH); syMax = Math.max(syMax, (-q.y * 0.5 + 0.5) * VH);
      }
      if (!isFinite(sxMin)) return;
      if (sxMin > bbox.x2 + 5 || sxMax < bbox.x1 - 5 || syMin > bbox.y2 + 5 || syMax < bbox.y1 - 5) return;
      list.push({ name: o.name || (o.material && o.material.name) || 'unnamed', type: o.geometry.type, box: [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].map(v => +v.toFixed(2)), parent: (o.parent && o.parent.name) || '' });
    });
    return { list: list.slice(0, 60), total: list.length, meshCount: count };
  }, { bbox, VW: 1280, VH: 800 });
  console.log('evaluate done. meshCount:', result.meshCount);
  console.log('total meshes overlapping band:', result.total);
  for (const m of result.list) console.log(JSON.stringify(m));

  await browser.close();
  process.exit(0);
}

main().catch(e => { console.error('ERR', e); process.exit(1); });
