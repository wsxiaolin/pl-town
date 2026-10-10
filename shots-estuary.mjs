// 河流入海口多机位截图 —— 修改前后对比用。
// 用法: node shots-estuary.mjs <tag>   (输出 /home/z/my-project/output/estuary-<tag>-*.png)
import { chromium } from 'playwright';

const url = 'http://localhost:5199/?dev';
const tag = process.argv[2] ?? 'base';
const OUT = (name) => `/home/z/my-project/output/estuary-${tag}-${name}.png`;

const browser = await chromium.launch({
  executablePath: '/home/z/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on('pageerror', (e) => console.error('PAGE_ERROR:', e.message));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window._mini && window._mini.scene && window._mini.player, null, { timeout: 120000 });
await page.waitForFunction(() => {
  const s = document.getElementById('bootScreen');
  return s && /is-ready/.test(s.className);
}, null, { timeout: 120000 });
console.log('boot ready');

// 相机飞行后等位置稳定（focus 是 gsap 0.8s 动画）
async function shot(name, x, z, zoom, waitMs = 2600) {
  await page.evaluate((a) => window._mini.focus(a.x, a.z, a.zoom), { x, z, zoom });
  await page.waitForTimeout(waitMs);
  await page.screenshot({ path: OUT(name) });
  console.log('saved:', OUT(name));
}

// 机位1：河口正俯视（看湾形与水舌衔接）
await shot('overhead', -40, -96, 10);
// 机位2：海侧低角度看河口（用户截图视角近似：从东南向西北看入海口）
await shot('seaview', -36, -88, 8);
// 机位3：河口贴近水面（看水位衔接/边界）
await shot('graze', -38, -93, 5);
// 机位4：远景全景（山河海关系）
await shot('wide', -20, -80, 22);

await browser.close();
console.log('done');
