#!/usr/bin/env node
// diag-terrain-visuals.mjs — 可信地形改造 R4 视觉验收 + 性能采样（按需诊断，不进 CI 套件）。
//
// 用法（仓库根目录执行）：
//   node apps/web/tests/diagnostics/diag-terrain-visuals.mjs
// 可选 env：
//   R4_PORT        vite 端口（默认 4273，占用时自动 +1 重试；若已有 vite 监听
//                  该端口则直接复用——自产子进程因 strictPort 退出属预期）
//   R4_DISPLAY     Xvfb display 号（默认 98）
//   R4_OUT         输出目录（默认 diagnostics-output/terrain-visuals）
//   R4_SKIP        逗号分隔的镜头 key 跳过名单（复用历史镜头时省时）
//   R4_BUDGET_MIN  全程墙钟预算（分钟，默认 55；超时后跳过剩余组并落盘）
//
// 自管链路：Xvfb → vite dev（strictPort）→ headed Chromium（SwiftShader/Vulkan，
// 参数与 playwright.config.ts 完全一致）→ 轻启动（CG 跳过 + 常驻身份 + town-api
// 路由 stub + 游戏 WS stub，复刻 tests/landscape-rendering.spec.ts 的隔离方式）→
// 写实档渲染设置（HD 纹理 + 动画水面 + anisotropy 8）→ 固定时钟（晨光）→
// 广角建立镜头候选 ×3 + zoom 15 俯视 ×3 区域（各 3 帧序列，供 ABA z-fighting
// 帧差分析）→ FPS/draw calls/三角面采样 + 地形 mesh 清点 + _mini.terrain 探针。
//
// 容错设计（R4 首跑教训 2026-10-11：zoom15 组 waitFrames 帧差 -30/8 超时——
// renderer.info.render.frame 单调递减只可能是渲染器实例被换/重置，判定为会话级
// 重建而非脚本 bug；本轮以取证 + 存活为目标）：
//   ① waitFrames 帧计数倒退时重基线（frame < f0 ⇒ f0 = frame），墙钟上限不变，
//      每次 tick 重新解析 window._mini（跟随实例替换），并统计 regressions；
//   ② 每个镜头组独立 try/catch：单组失败记入 report.errors 后继续下一组；
//      组内检测到渲染器身份变化（rid 戳）时，等城市重新就绪→重新对焦→重试
//      （最多 3 次尝试；zoom15 组最后一次自动降 canvas 分辨率 0.8× 重试，
//      保留 zoom=15 取景语义）；
//   ③ report.json 每阶段增量落盘（部分数据也保底），SIGTERM/崩溃后仍有现场。
// 取证：页面内 5s 一次的渲染器时间线（rid/frame/canvas/player）+ 浏览器全量
// console（含 [vite] HMR 消息）+ pageerror + 页面导航事件 + 组边界的渲染器
// 交换记录，用于定位「谁换了渲染器」。
//
// 产出（OUT 目录）：shot-*.png / aba-diff-*.png / report.json / 控制台摘要。
// 所有子进程在 finally 中清理；SIGTERM/SIGINT 同样走清理路径。

import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PORT = Number(process.env.R4_PORT || 4273);
const DISPLAY = `:${Number(process.env.R4_DISPLAY || 98)}`;
const OUT = path.resolve(REPO_ROOT, process.env.R4_OUT || 'diagnostics-output/terrain-visuals');
const SKIP = new Set(String(process.env.R4_SKIP || '').split(',').map((s) => s.trim()).filter(Boolean));
const BUDGET_MS = Number(process.env.R4_BUDGET_MIN || 55) * 60_000;
const RUN_STARTED = Date.now();

// R4_DSF（v3，R5 终审 2026-10-11）：设备像素比环境变量化。默认 1.6（写实档原值）；
// SwiftShader 下 2560×1440 canvas 的连续 page.screenshot 大回读两次实证触发
// CONTEXT_LOST_WEBGL 且上下文不恢复（v1 establish-c / v2 establish-a 起白镜），
// 降载 DSF=1.0（canvas 1600×900，面积 -60%）规避。分辨率不构成写实档语义
// （档位=HD 纹理+动画水面+anisotropy），报告中注明。
const DSF = Number(process.env.R4_DSF || 1.6);
// 写实档（app「高清」档语义）：HD 纹理 + 动画水面 + anisotropy 8；antialias 关
// （SwiftShader 上 MSAA 代价过高，靠设备分辨率兜底清晰度；报告注明）。
const RENDER_SETTINGS = {
  resolution: DSF,
  antialias: false,
  anisotropy: 8,
  shadows: false,
  exposure: 1.18,
  textureRendering: true,
  waterRendering: true,
};
const VIEWPORT = { width: 1600, height: 900 };
// 与 landscape-rendering.spec.ts 相同的固定时钟（北京 08:12 晨光，可复现）。
const FIXED_TIME = new Date('2026-10-07T00:12:00Z');

// 镜头清单：广角建立镜头候选（取景城+山/河/海）与 zoom 15 俯视（DoD 指定值；
// 三区域覆盖 SURFACE_Y 层叠 / 河口湾衔接 / 步道-草甸衔接）。
// establish-c 原 (5,-75,40) 首跑实证为大面积天空空镜（像素方差 132 vs a/b
// 968/1402，均值 246.9）——目标压到北缘使城市跌出画框；改为西北象限取景
// （岚屏岭山脊 + 河口 + 城市西翼同框），zoom 收到 38。
const ESTABLISHING_SHOTS = [
  { key: 'establish-a', x: -15, z: -55, zoom: 34 },
  { key: 'establish-b', x: -5, z: -35, zoom: 26 },
  { key: 'establish-c', x: -30, z: -58, zoom: 38 },
];
const ZOOM15_SHOTS = [
  { key: 'zoom15-core', x: 0, z: -8, zoom: 15 },
  { key: 'zoom15-river', x: -30, z: -85, zoom: 15 },
  { key: 'zoom15-south', x: 20, z: 75, zoom: 15 },
];
const FPS_VIEWS = [
  { key: 'zoom10-boot', zoom: 10 },
  { key: 'zoom15-core', zoom: 15 },
  { key: 'zoom21-whole', zoom: 21 },
];

const log = (...args) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...args);
const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

function waitForPort(port, host = '127.0.0.1', timeout = 30_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const probe = () => {
      const socket = createConnection({ port, host });
      socket.once('connect', () => { socket.destroy(); resolve(); });
      socket.once('error', () => {
        if (Date.now() - start > timeout) reject(new Error(`port ${port} not up in ${timeout}ms`));
        else setTimeout(probe, 300);
      });
    };
    probe();
  });
}

/** farGround 网格签名：x 77 段 × z 66 段 → 5,226 顶点（worldGroundMesh.ts）。 */
const FARGROUND_VERTS = 5226;

/** 页内渲染器身份戳安装（幂等）：每个 renderer 实例分配单调 rid（R1、R2…）。 */
async function ensureRidStamps(page) {
  await page.evaluate(() => {
    if (typeof window.__diagRid === 'function') return;
    window.__diagSeq = 0;
    window.__diagRid = (r) => (r.__diagId ||= `R${++window.__diagSeq}`);
  });
}

/** 当前渲染器快照：{rid, frame, canvas}（实例被换则 rid 变化）。 */
async function rendererSnapshot(page) {
  return page.evaluate(() => {
    const r = window._mini?.renderer;
    if (!r) return { rid: null, frame: null, canvas: null };
    if (typeof window.__diagRid !== 'function') {
      window.__diagSeq = window.__diagSeq || 0;
      window.__diagRid = (rr) => (rr.__diagId ||= `R${++window.__diagSeq}`);
    }
    return { rid: window.__diagRid(r), frame: r.info?.render?.frame ?? null, canvas: [r.domElement.width, r.domElement.height] };
  });
}

/**
 * 等待渲染帧数前进 count。容错 ①：帧计数倒退（渲染器实例被换 / info 重置）
 * 时重基线 f0 = frame，墙钟上限保持——只放弃「本组内的前进量」语义，不放弃
 * 存活。返回值永不 reject（组逻辑按 ok 分支处理），携带 regressions/swapped。
 */
async function waitFrames(page, count, timeoutMs = 180_000) {
  return page.evaluate(({ count: n, timeoutMs: t }) => new Promise((resolve) => {
    let f0 = window._mini?.renderer?.info?.render?.frame ?? -1;
    const started = performance.now();
    let regressions = 0;
    let swapped = false;
    const tick = () => {
      const frame = window._mini?.renderer?.info?.render?.frame ?? -1;
      if (frame < f0) {
        regressions += 1;
        swapped = true;
        f0 = frame;
      }
      if (frame - f0 >= n) resolve({ ok: true, regressions, swapped, f0, frame });
      else if (performance.now() - started > t) resolve({ ok: false, timeout: true, regressions, swapped, f0, frame, waitedMs: Math.round(performance.now() - started) });
      else setTimeout(tick, 150);
    };
    tick();
  }), { count, timeoutMs });
}

/** 城市就绪门（重试路径 / 首跑通用）：player 存在 + splash 揭幕 + 帧 8 帧前进。 */
async function waitForCityReady(page, timeoutMs = 300_000) {
  try {
    await page.waitForFunction(() => Boolean(window._mini?.player), undefined, { timeout: Math.min(timeoutMs, 120_000) });
  } catch { return false; }
  try {
    await page.waitForFunction(() => (document.getElementById('bootScreen')?.className ?? '').includes('is-ready'), undefined, { timeout: Math.min(timeoutMs, 180_000) });
  } catch { /* 揭幕类可能在重试前已消费，非致命 */ }
  const w = await waitFrames(page, 8, 180_000);
  return Boolean(w.ok);
}

/** rAF 帧吞吐（真实墙钟，performance.now 不受 clock mock 影响）。
 * 容错：渲染器被换时重基线并标记 swapped（fps 跨代不可信，由调用方重试）；
 * 墙钟 150s 硬上限防死等。 */
async function measureFps(page, frames = 24) {
  return page.evaluate(({ frames: n }) => new Promise((resolve) => {
    let f0 = window._mini?.renderer?.info?.render?.frame ?? -1;
    const started = performance.now();
    let swapped = false;
    const tick = () => {
      const frame = window._mini?.renderer?.info?.render?.frame ?? -1;
      if (frame < f0) { swapped = true; f0 = frame; }
      const done = frame - f0;
      if (done >= n) resolve({ frames: done, ms: Math.round(performance.now() - started), fps: done / ((performance.now() - started) / 1000), swapped });
      else if (performance.now() - started > 150_000) resolve({ frames: done, ms: Math.round(performance.now() - started), fps: done / ((performance.now() - started) / 1000), swapped, timedOut: true });
      else setTimeout(tick, 200);
    };
    tick();
  }), { frames });
}

/** 一次渲染帧的 draw calls / 三角面（autoReset 关闭 + 手动 reset，跨同一显示帧
 * 的全部 render() 调用累计——含水面等多 pass）。
 * 容错：每 tick 重新解析当前渲染器（实例被换即中止标记 swapped）；墙钟 90s
 * 硬上限；finally 恢复 autoReset。 */
async function sampleFrameStats(page) {
  return page.evaluate(() => new Promise((resolve) => {
    const started = performance.now();
    let r = window._mini?.renderer;
    let rid0 = null;
    if (typeof window.__diagRid !== 'function') { window.__diagSeq = window.__diagSeq || 0; window.__diagRid = (rr) => (rr.__diagId ||= `R${++window.__diagSeq}`); }
    rid0 = window.__diagRid(r);
    r.info.autoReset = false;
    r.info.reset();
    const f0 = r.info.render.frame;
    const tick = () => {
      const cur = window._mini?.renderer;
      if (!cur) { finish({ failed: 'renderer gone' }); return; }
      if (window.__diagRid(cur) !== rid0) { finish({ swapped: true }); return; }
      r = cur;
      if (r.info.render.frame > f0) {
        finish({
          frame: r.info.render.frame,
          calls: r.info.render.calls,
          triangles: r.info.render.triangles,
          lines: r.info.render.lines,
          points: r.info.render.points,
          geometries: r.info.memory.geometries,
          textures: r.info.memory.textures,
        });
      } else if (performance.now() - started > 90_000) finish({ timedOut: true });
      else requestAnimationFrame(tick);
    };
    function finish(out) {
      try { window._mini.renderer.info.autoReset = true; } catch { /* 渲染器已不在 */ }
      resolve(out);
    }
    requestAnimationFrame(tick);
  }));
}

/** HD 纹理就位判定：场景材质贴图 image/canvas 枚举稳定且无未完成加载。 */
async function textureCensus(page) {
  return page.evaluate(() => {
    const seen = new Set();
    let image = 0, canvas = 0, loading = 0, compressed = 0;
    window._mini.scene.traverse((o) => {
      const mats = Array.isArray(o.material) ? o.material : (o.material ? [o.material] : []);
      for (const m of mats) {
        for (const tex of [m.map, m.normalMap, m.roughnessMap, m.emissiveMap].filter(Boolean)) {
          if (seen.has(tex)) continue;
          seen.add(tex);
          const img = tex.image;
          if (img instanceof HTMLImageElement) { image += 1; if (!img.complete || img.naturalWidth === 0) loading += 1; }
          else if (img && img.constructor?.name === 'ImageBitmap') compressed += 1;
          else if (img) canvas += 1;
        }
      }
    });
    const webp = performance.getEntriesByType('resource').filter((e) => e.name.includes('.webp')).length;
    return { uniqueTextures: seen.size, image, canvas, compressed, loading, webpRequests: webp };
  });
}

async function waitForTextures(page, tries = 20) {
  let prev = null;
  for (let i = 0; i < tries; i += 1) {
    const census = await textureCensus(page);
    if (census.loading === 0 && prev && census.uniqueTextures === prev.uniqueTextures) return { ...census, settled: true };
    prev = census;
    await page.waitForTimeout(2000);
  }
  return { ...prev, settled: false };
}

/** ABA 帧差分析：S1/S2/S3，S1==S3≠S2 的像素为「交替闪烁」（z-fighting 特征）。
 * 阈值 12/255 每通道容忍水面/树摆的缓变；聚类以 64px 网格计数。 */
function abaAnalyze(a, b, c) {
  const W = a.width, H = a.height;
  const changed = new Uint8Array(W * H);
  let abaCount = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const s1s3 = Math.abs(a.data[i] - c.data[i]) <= 12 && Math.abs(a.data[i + 1] - c.data[i + 1]) <= 12 && Math.abs(a.data[i + 2] - c.data[i + 2]) <= 12;
      const s1s2 = Math.abs(a.data[i] - b.data[i]) > 12 || Math.abs(a.data[i + 1] - b.data[i + 1]) > 12 || Math.abs(a.data[i + 2] - b.data[i + 2]) > 12;
      if (s1s3 && s1s2) { changed[y * W + x] = 1; abaCount += 1; }
    }
  }
  const clusters = [];
  const buckets = new Map();
  for (let y = 0; y < H; y += 8) {
    for (let x = 0; x < W; x += 8) {
      let count = 0;
      for (let dy = 0; dy < 8 && y + dy < H; dy++) for (let dx = 0; dx < 8 && x + dx < W; dx++) count += changed[(y + dy) * W + x + dx];
      if (count > 0) {
        const key = `${Math.floor(x / 64)},${Math.floor(y / 64)}`;
        buckets.set(key, (buckets.get(key) || 0) + count);
      }
    }
  }
  for (const [key, count] of buckets) if (count >= 6) clusters.push({ cell: key, count });
  clusters.sort((p, q) => q.count - p.count);
  // 可视化：S1 与 S2 的差值（红）+ ABA 像素（亮黄）。
  // v3 修复（R5 终审 2026-10-11）：原 `PNG.sync.write(a)` 返回编码后的 PNG Buffer
  // 而非 PNG 结构，vis.data 为 undefined，首个 d>48 像素即抛
  // "Cannot read properties of undefined"。v1 崩于更早 waitFrames、v2 为
  // CONTEXT_LOST 白镜（三帧全同，差异分支永不进入）故均未显形——白镜 ABA
  // 「通过」实为假阴性，佐证 v2 产出无效。改为浅拷贝 a 的 PNG 结构。
  const vis = { width: a.width, height: a.height, data: Buffer.from(a.data) };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const d = Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]);
      if (changed[y * W + x]) { vis.data[i] = 255; vis.data[i + 1] = 240; vis.data[i + 2] = 0; }
      else if (d > 48) { vis.data[i] = Math.min(255, vis.data[i] + 120); vis.data[i + 1] = Math.max(0, vis.data[i + 1] - 40); vis.data[i + 2] = Math.max(0, vis.data[i + 2] - 40); }
    }
  }
  return { abaCount, abaRatio: abaCount / (W * H), clusters: clusters.slice(0, 12), visualization: vis };
}

/** 单组镜头执行：对焦 → 稳帧 → 单帧或 ABA 三帧采集。
 * 组内每步校验渲染器身份（rid），被换即抛错交由上层重试。 */
async function captureGroup(page, shot, aba, opts = {}) {
  const before = await rendererSnapshot(page);
  await page.evaluate(({ x, z, zoom }) => { window._mini.focus(x, z, zoom); }, shot);
  const settle = await waitFrames(page, 8);
  if (!settle.ok) throw new Error(`settle wait failed: ${JSON.stringify(settle)}`);
  const afterSettle = await rendererSnapshot(page);
  if (before.rid !== afterSettle.rid) throw new Error(`renderer swapped during focus (${before.rid} → ${afterSettle.rid})`);

  if (!aba) {
    const buf = await page.screenshot({ timeout: 120_000 });
    const file = path.join(OUT, `shot-${shot.key}.png`);
    fs.writeFileSync(file, buf);
    log(`shot ${shot.key} -> ${path.basename(file)}${opts.reducedCanvas ? ' (reduced canvas 0.8x)' : ''}`);
    return { key: shot.key, x: shot.x, z: shot.z, zoom: shot.zoom, file: path.basename(file), reducedCanvas: Boolean(opts.reducedCanvas) };
  }

  // ABA 序列：3 张，帧间隔 ≥3（跳过截图瞬间的同帧）。
  const seq = [];
  for (let i = 0; i < 3; i += 1) {
    await waitFrames(page, 3);
    const file = path.join(OUT, `shot-${shot.key}-${i}.png`);
    const buf = await page.screenshot({ timeout: 120_000 });
    fs.writeFileSync(file, buf);
    seq.push(file);
    log(`shot ${shot.key}#${i} captured`);
    const snap = await rendererSnapshot(page);
    if (before.rid !== snap.rid) throw new Error(`renderer swapped mid-ABA (${before.rid} → ${snap.rid})`);
  }
  const [pa, pb, pc] = seq.map((f) => PNG.sync.read(fs.readFileSync(f)));
  const analysis = abaAnalyze(pa, pb, pc);
  const visFile = path.join(OUT, `aba-diff-${shot.key}.png`);
  fs.writeFileSync(visFile, PNG.sync.write(analysis.visualization));
  log(`ABA ${shot.key}: ${analysis.abaCount} px (${(analysis.abaRatio * 100).toFixed(4)}%) clusters=${analysis.clusters.length}`);
  return {
    key: shot.key, x: shot.x, z: shot.z, zoom: shot.zoom,
    files: seq.map((f) => path.basename(f)),
    aba: { abaCount: analysis.abaCount, abaRatio: analysis.abaRatio, clusters: analysis.clusters },
    diff: path.basename(visFile),
    reducedCanvas: Boolean(opts.reducedCanvas),
  };
}

/** 组运行器（容错 ②）：独立 try/catch + 重试预算 + 城市复活门 + 渲染器交换检测。
 * attemptsLeft 递减；zoom15 组最后一次自动降 canvas 分辨率（保留取景语义）。 */
async function runGroup(page, shot, aba, errors, forensics, writeReport) {
  if (SKIP.has(shot.key)) return { key: shot.key, skipped: true };
  const maxAttempts = aba ? 3 : 2;
  const attempts = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (Date.now() - RUN_STARTED > BUDGET_MS) { attempts.push('skipped: time budget'); break; }
    const reducedCanvas = aba && attempt === maxAttempts;
    try {
      if (attempt > 1) {
        // 上次尝试失败：先确认城市活着（渲染器被换后应用会自行轻启动重建）。
        const alive = await waitForCityReady(page, 300_000);
        if (!alive) throw new Error('city not ready after wait (player missing or frames frozen)');
      }
      if (reducedCanvas) {
        await page.evaluate(() => { const r = window._mini.renderer; r.setPixelRatio(0.8); r.setSize(window.innerWidth, window.innerHeight, false); });
        log(`  ${shot.key}: retrying with reduced canvas (0.8x)`);
      }
      const result = await captureGroup(page, shot, aba, { reducedCanvas });
      if (reducedCanvas) {
        // 恢复运行档分辨率（R5 修复：原硬编码 1.6，DSF≠1.6 时会把 canvas 拉回
        // 2560×1440 重新进入 SwiftShader CONTEXT_LOST 风险域，污染后续组与 FPS 段）。
        await page.evaluate((ratio) => { const r = window._mini.renderer; r.setPixelRatio(ratio); r.setSize(window.innerWidth, window.innerHeight, false); }, DSF);
      }
      result.attempts = attempts.length + 1;
      return result;
    } catch (e) {
      attempts.push(String(e?.message || e));
      log(`  ${shot.key} attempt ${attempt} failed: ${String(e?.message || e).slice(0, 200)}`);
      // 渲染器交换取证：记录组边界快照。
      try {
        const snap = await rendererSnapshot(page);
        forensics.rendererSwaps.push({ t: Date.now(), at: `${shot.key}#attempt${attempt}`, snapshot: snap });
      } catch { /* 页面不可用 */ }
      if (reducedCanvas) {
        try { await page.evaluate((ratio) => { const r = window._mini.renderer; r.setPixelRatio(ratio); r.setSize(window.innerWidth, window.innerHeight, false); }, DSF); } catch { /* ignore */ }
      }
      writeReport();
    }
  }
  errors.push(`${shot.key}: ${attempts.length} attempt(s) failed — ${attempts.join(' | ').slice(0, 400)}`);
  return { key: shot.key, failed: true, attempts };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = {
    startedAt: new Date().toISOString(),
    renderSettings: RENDER_SETTINGS,
    viewport: VIEWPORT,
    dsf: DSF,
    fixedTime: FIXED_TIME.toISOString(),
    skippedKeys: [...SKIP],
    budgetMin: BUDGET_MS / 60_000,
  };
  const errors = [];
  const forensics = { console: [], consoleDropped: 0, pageErrors: [], navigations: [], rendererSwaps: [] };
  let xvfb = null, vite = null, browser = null;
  const writeReport = () => {
    try {
      report.errors = errors;
      report.forensics = {
        consoleDropped: forensics.consoleDropped,
        pageErrors: forensics.pageErrors,
        navigations: forensics.navigations,
        rendererSwaps: forensics.rendererSwaps,
        console: forensics.console,
      };
      report.elapsedMs = Date.now() - RUN_STARTED;
      report.finishedAt = new Date().toISOString();
      fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
    } catch (e) { log('report write failed:', String(e)); }
  };

  try {
    // ── 1. Xvfb（无 DISPLAY 时）─────────────────────────────────────────
    if (!process.env.DISPLAY) {
      log(`starting Xvfb on ${DISPLAY}`);
      xvfb = spawn('Xvfb', [DISPLAY, '-screen', '0', '1920x1200x24'], { stdio: ['ignore', 'pipe', 'pipe'] });
      let xvfbDead = false;
      xvfb.on('exit', () => { xvfbDead = true; });
      await sleep(1500);
      if (xvfbDead) throw new Error('Xvfb failed to start (display already in use?)');
      process.env.DISPLAY = DISPLAY;
    }
    process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1';

    // ── 2. vite dev（strictPort；端口已被外部 vite 占用时自动复用）────────
    let port = PORT;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      vite = spawn('npm', ['run', 'dev', '-w', '@minicity/web', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
      let dead = false;
      const onViteOut = (chunk) => { for (const line of String(chunk).split('\n')) if (line.trim()) log('[vite]', line.trim().slice(0, 200)); };
      vite.stdout.on('data', onViteOut);
      vite.stderr.on('data', onViteOut);
      vite.on('exit', (code) => { dead = true; if (code !== 0) log(`[vite] child exited code=${code} (port already served by an external vite — reusing)`); });
      try {
        await waitForPort(port, '127.0.0.1', 30_000);
        log(`vite dev up on ${port}`);
        break;
      } catch {
        vite.kill('SIGKILL');
        vite = null;
        if (dead || attempt === 2) throw new Error(`vite dev failed to start on ${port}`);
        log(`port ${port} busy, retrying on ${port + 1}`);
        port += 1;
      }
    }
    report.vitePort = port;

    // ── 3. Chromium（与 playwright.config.ts 同参 + DSF 1.6）────────────
    browser = await chromium.launch({
      headless: false,
      args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
    });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: DSF });
    const page = await context.newPage();

    // 取证：全量 console（含 [vite] HMR/reload 消息）+ pageerror + 导航。
    page.on('console', (m) => {
      const text = m.text();
      if (forensics.console.length >= 500) { forensics.consoleDropped += 1; return; }
      forensics.console.push({ t: Date.now(), type: m.type(), text: text.slice(0, 300) });
    });
    page.on('pageerror', (e) => { errors.push(`pageerror: ${e.message}`); forensics.pageErrors.push({ t: Date.now(), msg: String(e).slice(0, 500) }); });
    page.on('framenavigated', (f) => forensics.navigations.push({ t: Date.now(), url: String(f.url()).slice(0, 200) }));

    // town-api 路由 stub（复刻 landscape-rendering.spec.ts）。
    await page.route('**/town-api/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p.endsWith('/city/config')) return route.fulfill({ json: { schemaVersion: 1, version: 'terrain-r4', projects: [], personalPlots: [], decorations: [], initialBuiltBuildingIds: [] } });
      if (p.endsWith('/city/state')) return route.fulfill({ json: { epoch: 'terrain-r4', revision: 0, configVersion: 'terrain-r4', projects: [], decorations: [] } });
      if (p.endsWith('/city/votes')) return route.fulfill({ json: { epoch: 'terrain-r4', projectIds: [] } });
      if (p.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });

    // localStorage 种子（轻启动 + CG 跳过 + 常驻身份 + 写实档渲染设置）+ WS stub。
    await page.addInitScript(({ settings }) => {
      localStorage.setItem('minicityForceBoot', 'light');
      localStorage.setItem('minicityCGSeenV3', 'true');
      localStorage.setItem('minicityUser', 'tester');
      localStorage.setItem('minicityRenderSettings', JSON.stringify(settings));
      const NativeWebSocket = window.WebSocket;
      class StubGameWebSocket extends EventTarget {
        constructor() {
          super();
          this.readyState = NativeWebSocket.CONNECTING;
          queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); });
        }
        send(raw) {
          const request = JSON.parse(raw);
          let response = null;
          if (request.type === 'hello') {
            response = {
              type: 'hello', token: 'stub-token',
              user: { id: 'stub-user', nickname: 'tester', email: null, position: { x: 0, y: 0, z: -6 } },
              players: [], houses: [], requests: [],
              progress: { currency: 0, inventory: {}, achievements: ['citizen'], unlockedBuildings: ['newsstand'], visitedBuildings: ['activity', 'library', 'newsstand'] },
              catalog: { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} },
              weather: 'clear',
            };
          } else if (request.type === 'progress.building.visit') {
            response = { type: 'progress.updated', progress: { currency: 0, inventory: {}, achievements: ['citizen'], unlockedBuildings: ['newsstand'], visitedBuildings: ['activity', 'library', 'newsstand'] }, event: { type: 'building.visited', buildingId: request.buildingId ?? null } };
          }
          if (response) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
        }
        close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
      }
      Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, { construct(Target, args) { return String(args[0]).includes(':8787') ? new StubGameWebSocket() : Reflect.construct(Target, args); } }) });
    }, { settings: RENDER_SETTINGS });

    await page.clock.setFixedTime(FIXED_TIME);
    log('navigating + waiting for city boot');
    await page.goto(`http://127.0.0.1:${port}/`, { timeout: 90_000 });
    // 心跳：软渲染 + 冷 dev server 下揭幕帧可达秒级/帧，300s 预算 + 周期性帧数汇报。
    const bootHeartbeat = setInterval(() => {
      page.evaluate(() => {
        const r = window._mini?.renderer;
        if (r && typeof window.__diagRid !== 'function') { window.__diagSeq = 0; window.__diagRid = (rr) => (rr.__diagId ||= `R${++window.__diagSeq}`); }
        return { mini: Boolean(window._mini?.player), frame: r?.info?.render?.frame ?? -1, rid: r ? window.__diagRid(r) : null, ready: document.getElementById('bootScreen')?.className ?? 'none' };
      })
        .then((s) => log('  boot heartbeat:', JSON.stringify(s)))
        .catch(() => { /* 页面忙时 evaluate 可能排队，忽略 */ });
    }, 15_000);
    try {
      await page.waitForFunction(() => Boolean(window._mini?.player), undefined, { timeout: 300_000 });
      await page.waitForFunction(() => document.getElementById('bootScreen')?.classList.contains('is-ready'), undefined, { timeout: 300_000 });
    } catch (error) {
      // 失败转储：页面状态 + 控制台 + 截图，供诊断（boot-fail.png）。
      log('BOOT FAILED — dumping page state');
      try {
        const state = await page.evaluate(() => ({
          readyState: document.readyState,
          mini: Boolean(window._mini),
          player: Boolean(window._mini?.player),
          bootScreen: document.getElementById('bootScreen')?.className ?? null,
          frame: window._mini?.renderer?.info?.render?.frame ?? null,
          clockNow: Date.now(),
        }));
        log('  page state:', JSON.stringify(state));
        await page.screenshot({ path: path.join(OUT, 'boot-fail.png'), timeout: 60_000 });
        log('  console errors:', JSON.stringify(errors));
        log('  forensics console tail:', JSON.stringify(forensics.console.slice(-30)));
      } catch (dumpError) { log('  dump failed:', String(dumpError)); }
      throw error;
    } finally {
      clearInterval(bootHeartbeat);
    }
    await page.waitForTimeout(1000);
    log('city booted; waiting for HD textures');
    report.textures = await waitForTextures(page);
    log('texture census:', JSON.stringify(report.textures));
    await waitFrames(page, 4);
    writeReport();

    // 页内时间线取证：每 5s 记录渲染器身份/帧号/画布尺寸/player 存在性。
    await ensureRidStamps(page);
    await page.evaluate(() => {
      if (window.__diagPollInstalled) return;
      window.__diagPollInstalled = true;
      window.__diagTimeline = [];
      setInterval(() => {
        const r = window._mini?.renderer;
        if (window.__diagTimeline.length < 900) {
          window.__diagTimeline.push({
            t: Math.round(performance.now()),
            rid: r ? window.__diagRid(r) : null,
            frame: r?.info?.render?.frame ?? null,
            canvas: r ? [r.domElement.width, r.domElement.height] : null,
            player: Boolean(window._mini?.player),
          });
        }
      }, 5000);
    });

    // GPU / 渲染环境证据。
    report.environment = await page.evaluate(() => {
      const gl = window._mini.renderer.getContext();
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      const rid = window.__diagRid(window._mini.renderer);
      return {
        rendererId: rid,
        webglVersion: gl.getParameter(gl.VERSION),
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        devicePixelRatio: window.devicePixelRatio,
        canvasBacking: [window._mini.renderer.domElement.width, window._mini.renderer.domElement.height],
      };
    });
    log('environment:', JSON.stringify(report.environment));
    writeReport();

    // ── 4. 镜头序列（每组独立 try/catch，容错 ②）────────────────────────
    report.establishing = [];
    for (const shot of ESTABLISHING_SHOTS) {
      if (SKIP.has(shot.key)) { report.establishing.push({ key: shot.key, skipped: true }); log(`skip ${shot.key} (R4_SKIP)`); continue; }
      if (Date.now() - RUN_STARTED > BUDGET_MS) { report.establishing.push({ key: shot.key, skipped: 'time-budget' }); continue; }
      const result = await runGroup(page, shot, false, errors, forensics, writeReport);
      report.establishing.push(result);
      writeReport();
    }

    report.zoom15 = [];
    for (const shot of ZOOM15_SHOTS) {
      if (SKIP.has(shot.key)) { report.zoom15.push({ key: shot.key, skipped: true }); log(`skip ${shot.key} (R4_SKIP)`); continue; }
      if (Date.now() - RUN_STARTED > BUDGET_MS) { report.zoom15.push({ key: shot.key, skipped: 'time-budget' }); continue; }
      const result = await runGroup(page, shot, true, errors, forensics, writeReport);
      report.zoom15.push(result);
      writeReport();
    }

    // ── 5. 性能采样（每视角独立容错 + 交换重试一次）──────────────────────
    report.perf = { fpsViews: [], frameStats: [] };
    for (const view of FPS_VIEWS) {
      if (Date.now() - RUN_STARTED > BUDGET_MS) { report.perf.fpsViews.push({ view: view.key, skipped: 'time-budget' }); continue; }
      try {
        await page.evaluate((zoom) => window._mini.focus(0, -8, zoom), view.zoom);
        let settle = await waitFrames(page, 8);
        if (!settle.ok) {
          await waitForCityReady(page, 300_000);
          await page.evaluate((zoom) => window._mini.focus(0, -8, zoom), view.zoom);
          settle = await waitFrames(page, 8);
        }
        let fps = await measureFps(page, 24);
        let stats = await sampleFrameStats(page);
        if (fps.swapped || fps.timedOut || stats.swapped || stats.timedOut || stats.failed) {
          // 渲染器被换或采样超时：等城市稳定后重采一次。
          await waitForCityReady(page, 300_000);
          await page.evaluate((zoom) => window._mini.focus(0, -8, zoom), view.zoom);
          await waitFrames(page, 8);
          const fps2 = await measureFps(page, 24);
          const stats2 = await sampleFrameStats(page);
          fps = fps2.swapped ? fps : fps2;
          stats = stats2.swapped || stats2.failed ? stats : stats2;
          fps.retried = true;
        }
        report.perf.fpsViews.push({ view: view.key, zoom: view.zoom, ...fps });
        report.perf.frameStats.push({ view: view.key, zoom: view.zoom, ...stats });
        log(`perf ${view.key}: fps=${(fps.fps ?? 0).toFixed(2)} calls=${stats.calls ?? '?'} tris=${stats.triangles ?? '?'}`);
      } catch (e) {
        errors.push(`perf ${view.key}: ${String(e?.message || e).slice(0, 200)}`);
        report.perf.fpsViews.push({ view: view.key, failed: true });
      }
      writeReport();
    }

    // ── 6. 地形 mesh 清点（容错）────────────────────────────────────────
    try {
      report.inventory = await page.evaluate((farGroundVerts) => {
        let meshes = 0, tris = 0;
        const buckets = {};
        const largest = [];
        window._mini.scene.traverse((o) => {
          if (!o.isMesh) return;
          meshes += 1;
          const g = o.geometry;
          const t = g.index ? g.index.count / 3 : (g.attributes.position?.count || 0) / 3;
          tris += t;
          function classify(name, verts) {
            if (verts === farGroundVerts) return 'farGround';
            if (!name) return 'other';
            if (name === 'river-chenxi' || name.startsWith('river-')) return 'river';
            if (name.startsWith('lanping-mountain') || name.startsWith('peak:') || name.startsWith('forest:') || name.endsWith(':massif') || name.endsWith(':piedmont') || name.startsWith('apron:') || name.startsWith('crag:') || name.includes(':talus-')) return 'mountain/forest';
            return 'other';
          }
          const cls = classify(o.name, g.attributes.position?.count || 0);
          buckets[cls] = buckets[cls] || { meshes: 0, tris: 0 };
          buckets[cls].meshes += 1; buckets[cls].tris += Math.round(t);
          if (t > 0) largest.push({ name: o.name || '(unnamed)', tris: Math.round(t), cls });
        });
        largest.sort((a, b) => b.tris - a.tris);
        return { meshes, tris: Math.round(tris), buckets, largest: largest.slice(0, 12) };
      }, FARGROUND_VERTS);
      log('inventory buckets:', JSON.stringify(report.inventory.buckets));
    } catch (e) {
      errors.push(`inventory: ${String(e?.message || e).slice(0, 200)}`);
    }
    writeReport();

    // ── 7. _mini.terrain 探针（容错）────────────────────────────────────
    try {
      report.probes = await page.evaluate(() => {
        const pts = [[0, 0], [34, 96], [-20, -97], [-46, -99], [-100, -50], [0, 95], [-40, 105], [60, 30], [-80, -20], [80, -40]];
        return pts.map(([x, z]) => ({ x, z, ...window._mini.terrain.sample(x, z) }));
      });
      log('probes:', JSON.stringify(report.probes));
    } catch (e) {
      errors.push(`probes: ${String(e?.message || e).slice(0, 200)}`);
    }

    // ── 8. 页内时间线取证落盘 + 收尾 ────────────────────────────────────
    try {
      report.timeline = await page.evaluate(() => window.__diagTimeline ?? []);
    } catch { report.timeline = null; }
    report.errors = errors;
    log('DONE. errors =', errors.length);
    for (const e of errors.slice(0, 10)) log('  ', e);
  } finally {
    writeReport();
    try { await browser?.close(); } catch { /* ignore */ }
    for (const proc of [vite, xvfb]) {
      if (!proc || proc.exitCode !== null) continue;
      proc.kill('SIGTERM');
    }
    await sleep(600);
    for (const proc of [vite, xvfb]) {
      if (!proc || proc.exitCode !== null) continue;
      proc.kill('SIGKILL');
    }
  }
}

const shutdown = () => process.exit(0);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

main().catch((e) => { console.error('FAIL', e); process.exit(1); });
