// CG ANIMATION SYSTEM — cinematic opening "城之诞生"
// 5 acts: 星尘 → 蓝图 → 生长 → 烟火 → 题名
// Canvas2D particle/procedural engine + CSS typography, sequenced by GSAP.
import { gsap } from 'gsap';

type CGOptions = {
  onFinish: () => void;
  reduced?: boolean;
};

const SEEN_KEY = 'minicityCGSeenV3';
// Keep each act 20% shorter so scene transitions happen sooner.
const SCENE_SEC = 4.6 * 0.8;
const TAU = Math.PI * 2;

let cgTimeline: gsap.core.Timeline | null = null;
let cgAutoEnterTimer: number | null = null;
let cgScene5Shown = false;
let options: CGOptions = { onFinish: () => {} };

let rafId: number | null = null;
let resizeHandler: (() => void) | null = null;

export function initCG(opts: CGOptions): void {
  options = opts;
}

export function destroyCG(): void {
  if (cgTimeline) { cgTimeline.kill(); cgTimeline = null; }
  stopLoop();
  clearAutoEnter();
  options = { onFinish: () => {} };
}

export function shouldShowCG(): boolean {
  return !localStorage.getItem(SEEN_KEY);
}

// ─── deterministic randomness ────────────────────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(a: number, b: number, c: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInOut = (x: number) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// ─── canvas stage ────────────────────────────────────────────────────────────

interface Stage {
  cx: CanvasRenderingContext2D;
  w: number;
  h: number;
}

function stopLoop(): void {
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
}

function runLoop(draw: (t: number, dt: number) => void): void {
  let start: number | null = null;
  let last = 0;
  const tick = (now: number) => {
    if (start === null) { start = now; last = now; }
    const t = (now - start) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    draw(t, dt);
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
}

/** Rebuilds the scene DOM and attaches a DPR-aware canvas. */
function sceneShell(wrap: HTMLElement, bgClass: string, inner: string): Stage | null {
  stopLoop();
  wrap.innerHTML = `
    <div class="cg-bg ${bgClass}"></div>
    <canvas class="cg-canvas"></canvas>
    <div class="cg-cut"></div>
    ${inner}`;
  const cv = wrap.querySelector<HTMLCanvasElement>('canvas.cg-canvas');
  if (!cv) return null;
  const cx = cv.getContext('2d');
  if (!cx) return null;
  const stage: Stage = { cx, w: 0, h: 0 };
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = wrap.getBoundingClientRect();
    stage.w = rect.width;
    stage.h = rect.height;
    cv.width = Math.max(1, Math.round(rect.width * dpr));
    cv.height = Math.max(1, Math.round(rect.height * dpr));
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  resizeHandler = resize;
  window.addEventListener('resize', resize);
  return stage;
}

// ─── progress indicator ──────────────────────────────────────────────────────

function renderProgress(): void {
  const el = document.getElementById('cgProgress');
  if (el) el.innerHTML = '<span class="cg-dot"></span>'.repeat(5);
}

function setProgress(index: number): void {
  const el = document.getElementById('cgProgress');
  if (!el) return;
  Array.from(el.children).forEach((child, i) => {
    child.classList.toggle('done', i < index);
    child.classList.toggle('now', i === index);
  });
}

// ─── timeline ────────────────────────────────────────────────────────────────

export function startCG(): void {
  const overlay = document.getElementById('cgOverlay')!;
  const wrap = document.getElementById('cgSceneWrap')!;
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));
  cgScene5Shown = false;
  renderProgress();

  if (options.reduced) { endCG(); return; }

  const S = SCENE_SEC;
  cgTimeline = gsap.timeline();
  cgTimeline.call(() => scene1(wrap), [], 0).to({}, { duration: S }, 0);
  cgTimeline.call(() => scene2(wrap), [], S).to({}, { duration: S }, S);
  cgTimeline.call(() => scene3(wrap), [], S * 2).to({}, { duration: S }, S * 2);
  cgTimeline.call(() => scene4(wrap), [], S * 3).to({}, { duration: S }, S * 3);
  cgTimeline.call(() => scene5(wrap), [], S * 4);
}

// ─── ACT Ⅰ · 星尘 ── deep field, first pixel ────────────────────────────────

function scene1(wrap: HTMLElement): void {
  setProgress(0);
  const stage = sceneShell(wrap, 'cg-bg-space', `
    <div class="cg-text-block">
      <span class="cg-kicker">DEEP FIELD · SIGNAL 0000</span>
      <p class="cg-line cg-line-large">一切，始于一粒光。</p>
      <p class="cg-line" style="animation-delay:2s">文案是AI写的qwq</p>
    </div>`);
  if (!stage) return;

  const rnd = mulberry32(1013);
  interface Star { x: number; y: number; r: number; ph: number; sp: number }
  const stars: Star[] = [];
  for (let i = 0; i < 280; i++) {
    stars.push({ x: rnd(), y: rnd(), r: 0.4 + rnd() * 1.3, ph: rnd() * TAU, sp: 0.5 + rnd() * 1.6 });
  }
  interface Comet { x: number; y: number; vx: number; vy: number; life: number }
  let comets: Comet[] = [];
  let nextComet = 1.1;

  runLoop((t, dt) => {
    const { cx, w, h } = stage;
    cx.clearRect(0, 0, w, h);

    for (const s of stars) {
      cx.globalAlpha = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(s.ph + t * s.sp));
      cx.fillStyle = '#cfe2ff';
      cx.beginPath();
      cx.arc(s.x * w, s.y * h, s.r, 0, TAU);
      cx.fill();
    }

    if (t > nextComet) {
      nextComet = t + 1.8 + rnd() * 2.4;
      comets.push({ x: rnd() * 0.7, y: rnd() * 0.32, vx: 0.35 + rnd() * 0.3, vy: 0.1 + rnd() * 0.1, life: 1 });
    }
    comets = comets.filter((c) => c.life > 0);
    for (const c of comets) {
      c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt * 0.75;
      const px = c.x * w, py = c.y * h;
      const tail = cx.createLinearGradient(px, py, px - c.vx * w * 0.14, py - c.vy * h * 0.14);
      tail.addColorStop(0, 'rgba(215,232,255,0.95)');
      tail.addColorStop(1, 'rgba(215,232,255,0)');
      cx.globalAlpha = clamp01(c.life);
      cx.strokeStyle = tail;
      cx.lineWidth = 1.6;
      cx.beginPath();
      cx.moveTo(px, py);
      cx.lineTo(px - c.vx * w * 0.14, py - c.vy * h * 0.14);
      cx.stroke();
    }

    // the seed — breathing core + expanding shockwave rings
    const px = w / 2, py = h * 0.46;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
    const glow = cx.createRadialGradient(px, py, 0, px, py, 150);
    glow.addColorStop(0, `rgba(196,220,255,${0.75 + 0.2 * pulse})`);
    glow.addColorStop(0.22, 'rgba(140,180,250,0.30)');
    glow.addColorStop(1, 'rgba(140,180,250,0)');
    cx.globalAlpha = 1;
    cx.fillStyle = glow;
    cx.beginPath();
    cx.arc(px, py, 150, 0, TAU);
    cx.fill();

    for (let k = 0; k < 2; k++) {
      const cyc = ((t + k * 1.2) % 2.4) / 2.4;
      cx.globalAlpha = (1 - cyc) * 0.45;
      cx.strokeStyle = '#9cc2ff';
      cx.lineWidth = 1.2;
      cx.beginPath();
      cx.arc(px, py, 22 + cyc * 170, 0, TAU);
      cx.stroke();
    }
    cx.globalAlpha = 1;
  });
}

// ─── ACT Ⅱ · 蓝图 ── the grid comes online ──────────────────────────────────

function scene2(wrap: HTMLElement): void {
  setProgress(1);
  const stage = sceneShell(wrap, 'cg-bg-blueprint', `
    <div class="cg-text-block">
      <span class="cg-kicker">BLUEPRINT · GRID ONLINE</span>
      <p class="cg-line cg-line-large">代码，开始丈量土地。</p>
      <p class="cg-line" style="animation-delay:2s">经线为路，纬线为街。</p>
    </div>`);
  if (!stage) return;

  const rnd = mulberry32(77);
  interface Mark { u: number; v: number; t0: number; label: string | null }
  const marks: Mark[] = [];
  for (let i = 0; i < 12; i++) {
    marks.push({
      u: Math.floor(rnd() * 9) - 4,
      v: 1 + Math.floor(rnd() * 7),
      t0: 0.7 + rnd() * 2.6,
      label: rnd() < 0.4 ? `X:${String(Math.floor(rnd() * 40)).padStart(2, '0')} Z:${String(Math.floor(rnd() * 40) - 20).padStart(3, '0')}` : null,
    });
  }

  runLoop((t) => {
    const { cx, w, h } = stage;
    cx.clearRect(0, 0, w, h);
    const horizon = h * 0.6;
    const vpx = w / 2;
    const reveal = easeOutCubic(t / 2.8);
    const spread = w * 1.05 * (0.15 + 0.85 * reveal);
    const floorH = h - horizon + 60;

    // horizon glow
    const hg = cx.createLinearGradient(vpx - spread, horizon, vpx + spread, horizon);
    hg.addColorStop(0, 'rgba(120,170,255,0)');
    hg.addColorStop(0.5, `rgba(150,195,255,${0.85 * reveal})`);
    hg.addColorStop(1, 'rgba(120,170,255,0)');
    cx.strokeStyle = hg;
    cx.lineWidth = 1.4;
    cx.beginPath();
    cx.moveTo(vpx - spread, horizon);
    cx.lineTo(vpx + spread, horizon);
    cx.stroke();

    // radial avenues from the vanishing point
    cx.lineWidth = 1;
    for (let i = -8; i <= 8; i++) {
      const x2 = vpx + (i / 8) * spread;
      cx.strokeStyle = `rgba(96,150,230,${0.08 + 0.15 * reveal})`;
      cx.beginPath();
      cx.moveTo(vpx, horizon);
      cx.lineTo(x2, h + 60);
      cx.stroke();
    }

    // perspective cross streets
    const rowY = (j: number) => horizon + floorH * Math.pow(j / 10, 2.3) * reveal;
    for (let j = 1; j <= 10; j++) {
      const p = j / 10;
      if (p > reveal + 0.001) break;
      const y = rowY(j);
      cx.strokeStyle = `rgba(96,150,230,${0.1 + 0.2 * p * reveal})`;
      cx.lineWidth = 0.8 + p;
      cx.beginPath();
      cx.moveTo(vpx - spread, y);
      cx.lineTo(vpx + spread, y);
      cx.stroke();
    }

    // survey markers + coordinate labels
    for (const m of marks) {
      const local = t - m.t0;
      if (local < 0) continue;
      const y = rowY(m.v + 2);
      const x2 = vpx + (m.u / 8) * spread;
      const x = vpx + (x2 - vpx) * ((y - horizon) / (h + 60 - horizon));
      const a = clamp01(local / 0.4) * (0.55 + 0.25 * Math.sin(t * 3 + m.t0 * 7));
      cx.globalAlpha = a;
      cx.strokeStyle = '#a9ccff';
      cx.lineWidth = 1.2;
      cx.beginPath();
      cx.moveTo(x - 7, y); cx.lineTo(x + 7, y);
      cx.moveTo(x, y - 7); cx.lineTo(x, y + 7);
      cx.stroke();
      const ping = (local % 1.6) / 1.6;
      cx.globalAlpha = (1 - ping) * 0.35 * clamp01(local / 0.4);
      cx.beginPath();
      cx.arc(x, y, 4 + ping * 26, 0, TAU);
      cx.stroke();
      if (m.label) {
        cx.globalAlpha = a * (0.6 + 0.4 * Math.sin(t * 5 + m.t0 * 11));
        cx.fillStyle = '#8fb6ef';
        cx.font = '10px ui-monospace, SFMono-Regular, Consolas, monospace';
        cx.fillText(m.label, x + 11, y - 8);
      }
      cx.globalAlpha = 1;
    }

    // scan sweep
    const sx = ((t % 2.8) / 2.8) * (w + 300) - 150;
    const sg = cx.createLinearGradient(sx - 90, 0, sx + 90, 0);
    sg.addColorStop(0, 'rgba(140,185,255,0)');
    sg.addColorStop(0.5, 'rgba(140,185,255,0.14)');
    sg.addColorStop(1, 'rgba(140,185,255,0)');
    cx.fillStyle = sg;
    cx.fillRect(sx - 90, 0, 180, h);
  });
}

// ─── skyline generator (shared by ACT Ⅲ & Ⅳ) ────────────────────────────────

interface Tower { x: number; w: number; h: number; delay: number; seed: number }

function genSkyline(): Tower[] {
  const rnd = mulberry32(20260807);
  const towers: Tower[] = [];
  let x = -0.03;
  while (x < 1.05) {
    const bw = 0.035 + rnd() * 0.05;
    towers.push({ x, w: bw, h: 0.16 + rnd() * 0.4, delay: rnd() * 1.5, seed: rnd() * 1000 });
    x += bw + 0.006 + rnd() * 0.014;
  }
  return towers;
}

function drawTowerWindows(
  cx: CanvasRenderingContext2D, tw: Tower, w: number, h: number,
  gy: number, grow: number, t: number, brightness: number,
): void {
  const bx = tw.x * w, bw = tw.w * w, bh = tw.h * h * grow;
  const cols = Math.max(2, Math.floor(bw / 15));
  const rows = Math.max(3, Math.floor(bh / 19));
  const cw = bw / cols, ch = bh / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const lit = hash3(tw.seed, c, r);
      if (lit > 0.52) continue;
      const appear = clamp01((t - tw.delay - 1.1 - lit * 1.6) / 0.5);
      if (appear <= 0) continue;
      const twinkle = 0.7 + 0.3 * Math.sin(t * (1 + lit * 2) + lit * 40);
      const warm = lit < 0.2;
      cx.fillStyle = warm
        ? `rgba(255,206,140,${0.85 * appear * twinkle * brightness})`
        : `rgba(170,205,255,${0.8 * appear * twinkle * brightness})`;
      cx.fillRect(bx + c * cw + cw * 0.25, gy - bh + r * ch + ch * 0.25, cw * 0.5, ch * 0.45);
    }
  }
}

function drawSkyline(
  cx: CanvasRenderingContext2D, towers: Tower[], w: number, h: number,
  gy: number, t: number, growthScale: number, brightness: number,
): void {
  for (const tw of towers) {
    const grow = easeOutCubic((t - tw.delay) / 1.7) * growthScale;
    if (grow <= 0.005) continue;
    const bx = tw.x * w, bw = tw.w * w, bh = tw.h * h * grow;
    const body = cx.createLinearGradient(0, gy - bh, 0, gy);
    body.addColorStop(0, '#0b1224');
    body.addColorStop(1, '#05070f');
    cx.fillStyle = body;
    cx.fillRect(bx, gy - bh, bw, bh);
    cx.fillStyle = 'rgba(150,190,255,0.18)';
    cx.fillRect(bx, gy - bh, bw, 1.2);
    drawTowerWindows(cx, tw, w, h, gy, grow, t, brightness);
  }
}

// ─── ACT Ⅲ · 生长 ── skyline rises in milliseconds ──────────────────────────

function scene3(wrap: HTMLElement): void {
  setProgress(2);
  const stage = sceneShell(wrap, 'cg-bg-dusk', `
    <div class="cg-text-block">
      <span class="cg-kicker">CONSTRUCTION · SKYLINE RISING</span>
      <p class="cg-line cg-line-large">楼宇，在毫秒之间拔地而起。</p>
      <p class="cg-line" style="animation-delay:2s">每一扇亮起的窗后，都预存了一个故事。</p>
    </div>`);
  if (!stage) return;

  const towers = genSkyline();
  const rnd = mulberry32(555);
  interface Dust { x: number; y: number; v: number; drift: number; r: number }
  const dust: Dust[] = [];
  for (let i = 0; i < 46; i++) {
    dust.push({ x: rnd(), y: 0.55 + rnd() * 0.25, v: 0.02 + rnd() * 0.05, drift: rnd() * TAU, r: 0.6 + rnd() * 1.6 });
  }

  runLoop((t, dt) => {
    const { cx, w, h } = stage;
    cx.clearRect(0, 0, w, h);
    const gy = h * 0.78;

    // ground line ignition
    const gReveal = easeOutCubic(t / 1.2);
    const gg = cx.createLinearGradient(w * 0.5 - w * 0.55 * gReveal, gy, w * 0.5 + w * 0.55 * gReveal, gy);
    gg.addColorStop(0, 'rgba(255,190,130,0)');
    gg.addColorStop(0.5, 'rgba(255,205,150,0.75)');
    gg.addColorStop(1, 'rgba(255,190,130,0)');
    cx.strokeStyle = gg;
    cx.lineWidth = 1.6;
    cx.beginPath();
    cx.moveTo(w * 0.5 - w * 0.55 * gReveal, gy);
    cx.lineTo(w * 0.5 + w * 0.55 * gReveal, gy);
    cx.stroke();

    drawSkyline(cx, towers, w, h, gy, t, 1, 1);

    // reflection shimmer below ground line
    cx.save();
    cx.globalAlpha = 0.12;
    cx.translate(0, gy * 2);
    cx.scale(1, -1);
    drawSkyline(cx, towers, w, h, gy, t, 1, 0.6);
    cx.restore();

    // rising construction dust
    for (const d of dust) {
      d.y -= d.v * dt;
      if (d.y < 0.2) d.y = 0.8;
      const a = 0.35 * clamp01((d.y - 0.2) / 0.3);
      cx.globalAlpha = a * clamp01(t / 1.5);
      cx.fillStyle = '#ffd9a8';
      cx.beginPath();
      cx.arc(d.x * w + Math.sin(t + d.drift) * 8, d.y * h, d.r, 0, TAU);
      cx.fill();
    }
    cx.globalAlpha = 1;
  });
}

// ─── ACT Ⅳ · 烟火 ── the city never sleeps ──────────────────────────────────

function scene4(wrap: HTMLElement): void {
  setProgress(3);
  const stage = sceneShell(wrap, 'cg-bg-night', `
    <div class="cg-text-block">
      <span class="cg-kicker">CITIZENS · CITY NEVER SLEEPS</span>
      <p class="cg-line">图书馆的灯彻夜不熄，猫咖的琴声准点响起。</p>
      <p class="cg-line cg-highlight" style="animation-delay:2s">城已就绪，只差一位居民。</p>
    </div>`);
  if (!stage) return;

  const towers = genSkyline();
  const rnd = mulberry32(909);
  interface Streak { y: number; x: number; v: number; len: number; warm: boolean }
  const streaks: Streak[] = [];
  for (let i = 0; i < 10; i++) {
    streaks.push({
      y: 0.8 + rnd() * 0.06,
      x: rnd(),
      v: (0.06 + rnd() * 0.1) * (i % 2 === 0 ? 1 : -1),
      len: 0.05 + rnd() * 0.08,
      warm: rnd() < 0.5,
    });
  }
  interface Ember { x: number; y: number; v: number; ph: number; r: number }
  const embers: Ember[] = [];
  for (let i = 0; i < 40; i++) {
    embers.push({ x: rnd(), y: rnd(), v: 0.015 + rnd() * 0.035, ph: rnd() * TAU, r: 0.7 + rnd() * 1.8 });
  }

  runLoop((t, dt) => {
    const { cx, w, h } = stage;
    cx.clearRect(0, 0, w, h);
    const gy = h * 0.78;
    const far = SCENE_SEC * 10; // skyline already fully grown

    drawSkyline(cx, towers, w, h, gy, far, 1, 1);

    cx.save();
    cx.globalAlpha = 0.1;
    cx.translate(0, gy * 2);
    cx.scale(1, -1);
    drawSkyline(cx, towers, w, h, gy, far, 1, 0.6);
    cx.restore();

    // traffic light trails
    cx.globalCompositeOperation = 'lighter';
    for (const s of streaks) {
      s.x += s.v * dt;
      if (s.x > 1.2) s.x = -0.2;
      if (s.x < -0.2) s.x = 1.2;
      const px = s.x * w, py = s.y * h;
      const dir = s.v > 0 ? -1 : 1;
      const g = cx.createLinearGradient(px, py, px + dir * s.len * w, py);
      const color = s.warm ? '255,190,120' : '150,200,255';
      g.addColorStop(0, `rgba(${color},0.8)`);
      g.addColorStop(1, `rgba(${color},0)`);
      cx.strokeStyle = g;
      cx.lineWidth = 1.6;
      cx.beginPath();
      cx.moveTo(px, py);
      cx.lineTo(px + dir * s.len * w, py);
      cx.stroke();
    }

    // floating embers / lanterns
    for (const e of embers) {
      e.y -= e.v * dt;
      if (e.y < -0.05) { e.y = 1.02; }
      const a = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.8 + e.ph));
      cx.globalAlpha = a;
      cx.fillStyle = '#ffd9a0';
      cx.beginPath();
      cx.arc(e.x * w + Math.sin(t * 0.7 + e.ph) * 12, e.y * h, e.r, 0, TAU);
      cx.fill();
    }
    cx.globalAlpha = 1;
    cx.globalCompositeOperation = 'source-over';
  });
}

// ─── ACT Ⅴ · 题名 ── particles converge, the city is named ──────────────────

function scene5(wrap: HTMLElement): void {
  if (cgScene5Shown) return;
  cgScene5Shown = true;
  setProgress(4);
  const stage = sceneShell(wrap, 'cg-bg-title', `
    <div class="cg-title-block">
      <span class="cg-kicker">A CITY LIVES IN YOUR BROWSER</span>
      <h1 class="cg-title">招募文案写手</h1>
      <p class="cg-title-en">M I N I C I T Y</p>
      <p class="cg-tagline">救救我救救我</p>
      <button class="cg-enter-btn" id="cgEnterBtn"><span>签署居民证，进入小城</span></button>
    </div>`);

  const btn = document.getElementById('cgEnterBtn');
  if (btn) btn.addEventListener('click', endCG);
  cgAutoEnterTimer = window.setTimeout(endCG, 12000);
  if (!stage) return;

  const rnd = mulberry32(41);
  interface Orb { a0: number; r0: number; sp: number; sz: number; warm: boolean }
  const orbs: Orb[] = [];
  for (let i = 0; i < 150; i++) {
    orbs.push({ a0: rnd() * TAU, r0: 0.25 + rnd() * 0.75, sp: 0.6 + rnd() * 1.6, sz: 0.8 + rnd() * 2.2, warm: rnd() < 0.3 });
  }

  runLoop((t) => {
    const { cx, w, h } = stage;
    cx.clearRect(0, 0, w, h);
    const cx0 = w / 2, cy0 = h * 0.47;
    const R = Math.min(w, h) * 0.62;
    const converge = easeInOut(t / 3.2);

    cx.globalCompositeOperation = 'lighter';
    for (const o of orbs) {
      const r = R * o.r0 * (1 - converge * 0.92) + 6;
      const ang = o.a0 + t * o.sp * (1.6 - converge);
      const x = cx0 + Math.cos(ang) * r;
      const y = cy0 + Math.sin(ang) * r * 0.62;
      cx.globalAlpha = 0.16 + 0.34 * converge;
      cx.fillStyle = o.warm ? '#ffd9a0' : '#a9ccff';
      cx.beginPath();
      cx.arc(x, y, o.sz * (0.7 + converge * 0.5), 0, TAU);
      cx.fill();
    }

    // core glow behind the title
    const core = cx.createRadialGradient(cx0, cy0, 0, cx0, cy0, R * 0.5);
    core.addColorStop(0, `rgba(170,205,255,${0.34 * converge})`);
    core.addColorStop(1, 'rgba(170,205,255,0)');
    cx.globalAlpha = 1;
    cx.fillStyle = core;
    cx.beginPath();
    cx.arc(cx0, cy0, R * 0.5, 0, TAU);
    cx.fill();
    cx.globalCompositeOperation = 'source-over';
  });
}

// ─── exit paths ──────────────────────────────────────────────────────────────

export function skipCG(): void {
  // Resources are still loading during the opening CG, so skipping is disabled.
  const hint = document.getElementById('cgSkipHint');
  if (!hint) return;
  hint.textContent = '后台在加载资源呢';
  hint.classList.remove('show');
  // Restart the transition so repeated clicks still provide feedback.
  void hint.offsetWidth;
  hint.classList.add('show');
  window.setTimeout(() => hint.classList.remove('show'), 2200);
}

export function endCG(): void {
  if (cgTimeline) { cgTimeline.kill(); cgTimeline = null; }
  stopLoop();
  clearAutoEnter();
  localStorage.setItem(SEEN_KEY, 'true');
  const overlay = document.getElementById('cgOverlay')!;
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.style.display = 'none';
    options.onFinish();
  }, 600);
}

function clearAutoEnter(): void {
  if (cgAutoEnterTimer !== null) { clearTimeout(cgAutoEnterTimer); cgAutoEnterTimer = null; }
}
