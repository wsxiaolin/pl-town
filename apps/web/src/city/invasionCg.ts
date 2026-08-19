// INVASION CG — continuous cinematic「入侵」(issue #85)
// Unlike the opening CG (5 isolated acts), this is one uninterrupted arc:
// peace → rift → swarm → collapse → exodus → aftermath, all driven by a
// single continuous clock so there are no scene cuts.
//
// Depth is a first-class property of every drawable: each layer carries a
// depth factor d (0 = infinitely far, 1 = main plane, >1 = foreground).
//   parallax:  screen += cameraShake * d   (far planes barely move)
//   scale:     size   *= depthScale(d)     (0.3 + 0.72d)
//   haze:      color  →  mix toward the atmosphere color by hazeAmt(d)
// so the frame reads as stacked planes with aerial perspective, not a flat cutout.
//
// Console-only entry points: window.playInvasionCG() / window.stopInvasionCG().

import { destroyCG } from './cg';

type RGB = [number, number, number];

const TAU = Math.PI * 2;
const GY = 0.8; // main-plane ground line (normalized y)
const RIFT_AT = 5.2;
const WAR_AT = 12;
const TITLE_AT = 37;
const AUTO_CLOSE_AT = 46;

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
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smoothstep = (a: number, b: number, x: number) => {
  const k = clamp01((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeInQuad = (x: number) => clamp01(x) * clamp01(x);

// ─── depth + color helpers ───────────────────────────────────────────────────

const depthScale = (d: number) => 0.3 + 0.72 * d;
const hazeAmt = (d: number) => clamp01((1 - d) * 0.9);
const groundY = (d: number) => GY + (d - 1) * 0.12;

const mixc = (a: RGB, b: RGB, k: number): RGB => [
  lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k),
];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

interface Palette { top: RGB; mid: RGB; bot: RGB; atmos: RGB; fireGlow: number; alert: number; war: number }

function paletteAt(t: number): Palette {
  const inv = smoothstep(6, 13, t);
  const aft = smoothstep(33, 42, t);
  const mix3 = (p: RGB, w: RGB, a: RGB) => mixc(mixc(p, w, inv), a, aft);
  return {
    top: mix3([16, 22, 48], [14, 6, 12], [8, 6, 8]),
    mid: mix3([58, 63, 102], [56, 12, 24], [34, 14, 16]),
    bot: mix3([138, 95, 82], [110, 30, 18], [46, 18, 14]),
    atmos: mixc([84, 76, 110], [92, 30, 34], inv),
    fireGlow: smoothstep(11, 17, t) * (1 - aft * 0.5),
    alert: smoothstep(6, 10, t) * (1 - smoothstep(34, 40, t)),
    war: smoothstep(11, 15, t),
  };
}

// ─── world entities ──────────────────────────────────────────────────────────

interface Tower {
  x: number; w: number; h: number; seed: number;
  destroyAt: number; fired: boolean;
}

function genTowers(): Tower[] {
  const rnd = mulberry32(20260819);
  const towers: Tower[] = [];
  let x = -0.02;
  while (x < 1.04) {
    const bw = 0.045 + rnd() * 0.05;
    towers.push({ x, w: bw, h: 0.15 + rnd() * 0.34, seed: rnd() * 1000, destroyAt: Infinity, fired: false });
    x += bw + 0.008 + rnd() * 0.016;
  }
  // collapse one by one in a seeded order; the last two towers survive
  const order = towers.map((tw, i) => ({ tw, i }))
    .sort((a, b) => hash3(a.tw.seed, 7, 3) - hash3(b.tw.seed, 7, 3));
  order.slice(0, Math.max(0, order.length - 2)).forEach(({ tw, i }, k) => {
    tw.destroyAt = 13.5 + k * 1.5 + hash3(i, 1, 9) * 0.4;
  });
  return towers;
}

interface FarTower { x: number; w: number; h: number; seed: number }

function genFarSkyline(): FarTower[] {
  const rnd = mulberry32(424242);
  const out: FarTower[] = [];
  let x = -0.05;
  while (x < 1.1) {
    const bw = 0.03 + rnd() * 0.045;
    out.push({ x, w: bw, h: 0.06 + rnd() * 0.16, seed: rnd() * 1000 });
    x += bw + 0.004 + rnd() * 0.01;
  }
  return out;
}

interface Drone {
  spawnAt: number; seed: number; ox: number; oy: number;
  d0: number; orbitR: number; wobble: number;
}

function genDrones(): Drone[] {
  const rnd = mulberry32(555777);
  const drones: Drone[] = [];
  for (let i = 0; i < 22; i++) {
    drones.push({
      spawnAt: 5.6 + i * 0.38 + rnd() * 0.25,
      seed: rnd() * 1000,
      ox: 0.08 + rnd() * 0.84,
      oy: 0.10 + rnd() * 0.26,
      d0: 0.5 + rnd() * 0.75,
      orbitR: 0.008 + rnd() * 0.02,
      wobble: 0.6 + rnd() * 1.4,
    });
  }
  return drones;
}

/** Pure function of time: a drone rides out of the rift (deep, small) toward its hover orbit (near, large). */
function droneState(dr: Drone, t: number): { x: number; y: number; d: number; k: number } {
  const k = easeOutCubic(clamp01((t - dr.spawnAt) / 3.4));
  const x = lerp(0.5, dr.ox, k) + Math.cos(t * dr.wobble + dr.seed) * dr.orbitR * k;
  const y = lerp(0.24, dr.oy, k) + Math.sin(t * dr.wobble * 1.3 + dr.seed * 2) * dr.orbitR * 0.6 * k;
  return { x, y, d: lerp(0.16, dr.d0, k), k };
}

interface Person { x: number; dir: 1 | -1; d: number; speed: number; seed: number; calm: boolean }
interface Debris { x: number; y: number; vx: number; vy: number; s: number; rot: number; vr: number; life: number }
interface Smoke { x: number; y: number; r: number; life: number; maxLife: number; seed: number }
interface Shock { x: number; y: number; t0: number }
interface Ember { x0: number; y0: number; d: number; sp: number; ph: number; sz: number }

// ─── module state ────────────────────────────────────────────────────────────

let active = false;
let rafId: number | null = null;
let resizeHandler: (() => void) | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let clickHandler: (() => void) | null = null;
let closeTimer: number | null = null;
let shakeEnergy = 0;
let camX = 0;
let camY = 0;

export function invasionCGActive(): boolean {
  return active;
}

// ─── captions ────────────────────────────────────────────────────────────────

const CAPTIONS: ReadonlyArray<readonly [number, string]> = [
  [1.2, '曾经，这里只是一座安静的小城。'],
  [6.2, '直到天空，被撕开了一道口子。'],
  [12.5, '它们从天而降，带着压倒性的力量。'],
  [19.5, '楼宇在光束中一栋接一栋地熄灭。'],
  [27, '人们四散奔逃，没有人回头。'],
];

// ─── public API ──────────────────────────────────────────────────────────────

export function startInvasionCG(): boolean {
  const overlay = document.getElementById('cgOverlay');
  const wrap = document.getElementById('cgSceneWrap');
  if (!overlay || !wrap) return false;
  if (active) stopInvasionCG(true);
  // take over the shared overlay; stop the intro CG loop if it is mid-flight
  destroyCG();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  active = true;
  shakeEnergy = 0;
  camX = 0;
  camY = 0;

  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));

  wrap.innerHTML = `
    <div class="cg-bg cgm-bg"></div>
    <canvas class="cg-canvas"></canvas>
    <div class="cg-cut"></div>
    <div class="cgm-caption" id="cgmCaption"></div>
    <div class="cgm-title-block" id="cgmTitle">
      <span class="cg-kicker">INVASION · PROTOCOL ZERO</span>
      <h1 class="cgm-title">入 侵</h1>
      <p class="cgm-title-en">T H E Y&ensp;C A M E&ensp;F R O M&ensp;T H E&ensp;S K Y</p>
      <p class="cgm-hint">点击任意处或按 Esc 退出</p>
    </div>`;

  const progress = document.getElementById('cgProgress');
  if (progress) progress.innerHTML = '<div class="cgm-bar"><i id="cgmBarFill"></i></div>';

  const cv = wrap.querySelector<HTMLCanvasElement>('canvas.cg-canvas');
  const cx = cv?.getContext('2d');
  const captionEl = wrap.querySelector<HTMLElement>('#cgmCaption');
  const titleEl = wrap.querySelector<HTMLElement>('#cgmTitle');
  const barFill = document.getElementById('cgmBarFill');
  if (!cv || !cx || !captionEl || !titleEl) { stopInvasionCG(); return false; }

  let w = 0, h = 0;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = wrap.getBoundingClientRect();
    w = rect.width; h = rect.height;
    cv.width = Math.max(1, Math.round(rect.width * dpr));
    cv.height = Math.max(1, Math.round(rect.height * dpr));
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  resizeHandler = resize;
  window.addEventListener('resize', resize);

  // world state
  const towers = genTowers();
  const farSkyline = genFarSkyline();
  const drones = genDrones();
  const people: Person[] = [];
  const debris: Debris[] = [];
  const smoke: Smoke[] = [];
  const shocks: Shock[] = [];
  const rnd = mulberry32(9090);
  const EMBER_BANDS = [0.5, 1, 1.8] as const;
  const embers: Ember[] = [];
  for (let i = 0; i < 90; i++) {
    embers.push({
      x0: rnd(), y0: rnd() * 1.2, d: EMBER_BANDS[i % 3] ?? 1,
      sp: 0.02 + rnd() * 0.05, ph: rnd() * TAU, sz: 0.7 + rnd() * 1.9,
    });
  }
  // a handful of calm strollers before the attack (mid plane + foreground)
  for (let i = 0; i < 4; i++) {
    people.push({ x: 0.2 + rnd() * 0.6, dir: rnd() < 0.5 ? -1 : 1, d: 1, speed: 0.008 + rnd() * 0.006, seed: rnd() * 10, calm: true });
  }
  for (let i = 0; i < 6; i++) {
    people.push({ x: 0.1 + rnd() * 0.8, dir: rnd() < 0.5 ? -1 : 1, d: 1.9, speed: 0.02 + rnd() * 0.03, seed: rnd() * 10, calm: true });
  }

  const t0 = reduced ? TITLE_AT : 0;
  let startStamp: number | null = null;
  let last = 0;
  let lastT = t0;
  let captionIdx = -1;
  let titleShown = false;
  const fgWaves = [20, 26]; // later foreground exodus waves

  const PX = (x: number, d: number) => (x + camX * d) * w;
  const PY = (y: number, d: number) => (y + camY * d) * h;

  const spawnRefugees = (x: number, count: number, d = 0.95) => {
    for (let i = 0; i < count; i++) {
      people.push({
        x: x + (rnd() - 0.5) * 0.04, dir: rnd() < 0.5 ? -1 : 1, d: d + rnd() * 0.2,
        speed: 0.05 + rnd() * 0.05, seed: rnd() * 10, calm: false,
      });
    }
  };

  const spawnDebris = (tw: Tower) => {
    const topY = groundY(1) - tw.h;
    for (let i = 0; i < 12; i++) {
      debris.push({
        x: tw.x + rnd() * tw.w, y: topY + rnd() * tw.h * 0.4,
        vx: (rnd() - 0.5) * 0.24, vy: -(0.02 + rnd() * 0.1),
        s: 3 + rnd() * 7, rot: rnd() * TAU, vr: (rnd() - 0.5) * 12, life: 1,
      });
    }
  };

  // ── per-frame render ───────────────────────────────────────────────────────

  const frame = (now: number) => {
    if (!active) return;
    if (startStamp === null) { startStamp = now; last = now; }
    const t = t0 + (now - startStamp) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const pal = paletteAt(t);
    const fog = (c: RGB, d: number) => mixc(c, pal.atmos, hazeAmt(d));

    // camera shake (reduced-motion runs still)
    if (!reduced) {
      shakeEnergy *= Math.exp(-dt * 2.4);
      camX = (Math.sin(t * 12.9) * 0.55 + Math.sin(t * 7.3 + 1.7) * 0.3 + Math.sin(t * 3.1 + 0.4) * 0.15) * shakeEnergy * 0.011;
      camY = (Math.sin(t * 11.1 + 4.2) * 0.55 + Math.sin(t * 6.7 + 2.9) * 0.3 + Math.sin(t * 2.7 + 1.1) * 0.15) * shakeEnergy * 0.008;
    }

    // collapse edge events
    for (const tw of towers) {
      if (!tw.fired && lastT < tw.destroyAt && t >= tw.destroyAt) {
        tw.fired = true;
        shakeEnergy = Math.min(1, shakeEnergy + 0.55);
        shocks.push({ x: tw.x + tw.w / 2, y: groundY(1) - tw.h * 0.5, t0: t });
        spawnDebris(tw);
        spawnRefugees(tw.x + tw.w / 2, 2 + Math.floor(rnd() * 3));
      }
    }
    // fleeing begins as soon as the assault starts
    if (lastT < WAR_AT && t >= WAR_AT) {
      for (const p of people) p.calm = false;
      spawnRefugees(0.5, 6);
    }
    // later foreground exodus waves cross close to the camera
    for (const waveAt of fgWaves) {
      if (lastT < waveAt && t >= waveAt) spawnRefugees(0.3 + rnd() * 0.4, 4, 1.7);
    }
    lastT = t;

    drawSky(cx, w, h, t, pal);
    drawRift(cx, PX, PY, w, h, t, smoothstep(RIFT_AT, RIFT_AT + 2.2, t));
    drawFarSkyline(cx, PX, PY, w, h, t, pal, farSkyline, fog);
    drawEmbers(cx, PX, PY, w, h, t, pal, embers, 0.5);
    for (const dr of drones) { const s = droneState(dr, t); if (s.d <= 1) drawDrone(cx, PX, PY, w, h, t, dr, s, pal, fog); }
    for (const tw of towers) drawTower(cx, PX, PY, w, h, t, pal, tw);
    for (const dr of drones) { const s = droneState(dr, t); if (s.d > 1) drawDrone(cx, PX, PY, w, h, t, dr, s, pal, fog); }
    drawBeams(cx, PX, PY, w, h, t, towers, drones);
    updateSmoke(smoke, towers, t, dt, rnd);
    drawSmoke(cx, PX, PY, smoke, pal);
    updateDebris(debris, dt);
    drawDebris(cx, PX, PY, debris, pal);
    drawShocks(cx, PX, PY, w, h, t, shocks);
    updatePeople(people, t, dt);
    drawPeople(cx, PX, PY, h, t, people, false);
    drawEmbers(cx, PX, PY, w, h, t, pal, embers, 1);
    drawPeople(cx, PX, PY, h, t, people, true);
    drawEmbers(cx, PX, PY, w, h, t, pal, embers, 1.8);
    drawAlert(cx, w, h, t, pal);
    if (!reduced) applyGlitch(cx, cv, w, h, t, towers);

    // captions / title / progress
    for (let next = CAPTIONS[captionIdx + 1]; next && t >= next[0]; next = CAPTIONS[captionIdx + 1]) {
      captionIdx += 1;
      captionEl.classList.remove('in');
      void captionEl.offsetWidth;
      captionEl.textContent = next[1];
      captionEl.classList.add('in');
    }
    if (!titleShown && t >= TITLE_AT) {
      titleShown = true;
      captionEl.classList.add('hide');
      titleEl.classList.add('show');
    }
    if (barFill) barFill.style.width = `${Math.min(100, (t / AUTO_CLOSE_AT) * 100)}%`;

    if (t >= AUTO_CLOSE_AT) { stopInvasionCG(); return; }
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);

  // exit affordances (console CG: no login flow involved)
  keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') stopInvasionCG(); };
  clickHandler = () => {
    if (startStamp !== null && performance.now() - startStamp > 1500) stopInvasionCG();
  };
  window.addEventListener('keydown', keyHandler);
  overlay.addEventListener('click', clickHandler);
  return true;
}

export function stopInvasionCG(silent = false): void {
  if (!active) return;
  active = false;
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  const overlay = document.getElementById('cgOverlay');
  const wrap = document.getElementById('cgSceneWrap');
  if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
  if (overlay && clickHandler) { overlay.removeEventListener('click', clickHandler); }
  clickHandler = null;
  const clearDom = () => {
    if (overlay) overlay.style.display = 'none';
    if (wrap) wrap.innerHTML = '';
    const progress = document.getElementById('cgProgress');
    if (progress) progress.innerHTML = '';
  };
  if (silent) { overlay?.classList.remove('active'); clearDom(); return; }
  overlay?.classList.remove('active');
  if (closeTimer !== null) clearTimeout(closeTimer);
  closeTimer = window.setTimeout(() => { clearDom(); closeTimer = null; }, 600);
}

// ─── drawing: sky / rift / skylines ──────────────────────────────────────────

type Proj = (v: number, d: number) => number;

function drawSky(cx: CanvasRenderingContext2D, w: number, h: number, t: number, pal: Palette): void {
  const g = cx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, css(pal.top));
  g.addColorStop(0.55, css(pal.mid));
  g.addColorStop(0.76, css(pal.bot));
  g.addColorStop(0.8, css(pal.top));
  g.addColorStop(1, css(pal.top));
  cx.fillStyle = g;
  cx.fillRect(0, 0, w, h);
  // stars fade as the invasion tint takes over
  const starA = 1 - smoothstep(4, 9, t);
  if (starA > 0.02) {
    for (let i = 0; i < 110; i++) {
      const x = hash3(i, 1, 5), y = hash3(i, 2, 9) * 0.6;
      cx.globalAlpha = starA * (0.2 + 0.5 * (0.5 + 0.5 * Math.sin(t * (0.6 + hash3(i, 3, 1) * 1.6) + i)));
      cx.fillStyle = '#cfe2ff';
      cx.fillRect(x * w, y * h, 1.4, 1.4);
    }
    cx.globalAlpha = 1;
  }
}

function drawRift(cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number, t: number, open: number): void {
  if (open <= 0.01) return;
  const cxp = PX(0.5, 0.3), cyp = PY(0.24, 0.3);
  const H = h * 0.36 * open;
  const W2 = w * 0.014 * open * (0.7 + 0.3 * Math.sin(t * 7));
  const tick = Math.floor(t * 14);
  const edge = (i: number, side: 1 | -1) => {
    const k = i / 12;
    const jag = (hash3(i, tick, 3) - 0.5) * W2 * 2.4 + Math.sin(k * Math.PI) * W2;
    return [cxp + side * jag, cyp - H / 2 + H * k] as const;
  };
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  cx.shadowColor = 'rgba(255,70,60,0.9)';
  cx.shadowBlur = 26 * open;
  cx.beginPath();
  for (let i = 0; i <= 12; i++) { const [x, y] = edge(i, 1); if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y); }
  for (let i = 12; i >= 0; i--) { const [x, y] = edge(i, -1); cx.lineTo(x, y); }
  cx.closePath();
  const core = cx.createLinearGradient(cxp, cyp - H / 2, cxp, cyp + H / 2);
  core.addColorStop(0, `rgba(120,40,160,${0.85 * open})`);
  core.addColorStop(0.5, `rgba(255,90,70,${0.95 * open})`);
  core.addColorStop(1, `rgba(120,40,160,${0.85 * open})`);
  cx.fillStyle = core;
  cx.fill();
  cx.shadowBlur = 0;
  // chromatic ghost edges
  cx.globalAlpha = 0.35 * open;
  cx.strokeStyle = 'rgba(255,60,60,0.8)';
  cx.lineWidth = 1.4;
  cx.beginPath();
  for (let i = 0; i <= 12; i++) { const [x, y] = edge(i, 1); if (i === 0) cx.moveTo(x + 3, y); else cx.lineTo(x + 3, y); }
  cx.stroke();
  cx.strokeStyle = 'rgba(80,180,255,0.8)';
  cx.beginPath();
  for (let i = 0; i <= 12; i++) { const [x, y] = edge(i, -1); if (i === 0) cx.moveTo(x - 3, y); else cx.lineTo(x - 3, y); }
  cx.stroke();
  cx.restore();
}

function drawFarSkyline(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number,
  t: number, pal: Palette, towers: FarTower[], fog: (c: RGB, d: number) => RGB,
): void {
  const D = 0.42;
  const gy = PY(groundY(D), D);
  // the whole far plane sinks into haze as the war escalates
  const planeAlpha = 1 - pal.war * 0.55;
  const body = fog([18, 22, 38], D);
  cx.save();
  cx.globalAlpha = planeAlpha;
  for (const tw of towers) {
    const x = PX(tw.x, D), bw = tw.w * w, bh = tw.h * h;
    cx.fillStyle = css(body);
    cx.fillRect(x, gy - bh, bw, bh);
    // distant fires once the war reaches the background plane
    const burn = pal.fireGlow * clamp01(hash3(tw.seed, 5, 2) * 1.4 - 0.3);
    if (burn > 0.03) {
      const fy = gy - bh * (0.2 + hash3(tw.seed, 6, 1) * 0.6);
      const g = cx.createRadialGradient(PX(tw.x + tw.w / 2, D), fy, 0, PX(tw.x + tw.w / 2, D), fy, bw * 1.6);
      g.addColorStop(0, `rgba(255,140,60,${0.35 * burn * (0.6 + 0.4 * Math.sin(t * 6 + tw.seed))})`);
      g.addColorStop(1, 'rgba(255,140,60,0)');
      cx.fillStyle = g;
      cx.fillRect(PX(tw.x, D) - bw, fy - bw * 1.6, bw * 3, bw * 3.2);
    }
  }
  cx.restore();
  // atmospheric floor haze pushes the far plane back
  const hz = cx.createLinearGradient(0, gy - h * 0.2, 0, gy);
  hz.addColorStop(0, css(pal.atmos, 0));
  hz.addColorStop(1, css(pal.atmos, 0.16));
  cx.fillStyle = hz;
  cx.fillRect(0, gy - h * 0.2, w, h * 0.2);
}

// ─── drawing: main towers (collapse one by one) ──────────────────────────────

function drawTower(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number,
  t: number, pal: Palette, tw: Tower,
): void {
  const cp = clamp01((t - tw.destroyAt) / 2.4);
  const gy = PY(groundY(1), 1);
  const x0 = PX(tw.x, 1);
  const bw = tw.w * w;
  const th = tw.h * h;
  const SL = 7;
  const rem = 1 - easeInQuad(cp) * 0.9;
  const body = mixc([24, 30, 52], [34, 16, 18], pal.war);
  const litRatio = lerp(0.5, 0.05, pal.war);

  for (let i = 0; i < SL; i++) {
    const sBot = i / SL;
    if (sBot >= rem) break;
    const sTop = Math.min((i + 1) / SL, rem);
    const jit = Math.sin(tw.seed + i * 3.1 + t * 26) * 4 * cp * sBot;
    const y = gy - sTop * th;
    const sh = (sTop - sBot) * th + 0.6;
    cx.fillStyle = css(mixc(body, [12, 8, 10], cp * 0.7));
    cx.fillRect(x0 + jit, y, bw, sh);
    // windows: die with the war, die above the crumble front
    const cols = Math.max(2, Math.floor(bw / 13));
    const rows = Math.max(2, Math.floor((sTop - sBot) * th / 15));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const on = hash3(tw.seed + i * 17, c, r) < litRatio
          && hash3(tw.seed, c * 3 + r, Math.floor(t * 6)) > 0.06;
        if (!on) continue;
        cx.fillStyle = `rgba(255,214,150,${0.65 * (1 - cp)})`;
        cx.fillRect(x0 + jit + (c + 0.28) * (bw / cols), y + (r + 0.3) * (sh / rows), bw / cols * 0.42, sh / rows * 0.4);
      }
    }
  }
  if (rem > 0.01) {
    cx.fillStyle = `rgba(150,190,255,${0.14 * (1 - pal.war * 0.6)})`;
    cx.fillRect(x0, gy - rem * th, bw, 1.2);
  }

  // targeting reticle shortly before the strike
  const lockK = clamp01((t - (tw.destroyAt - 1.15)) / 0.9) * (cp <= 0 ? 1 : 0);
  if (lockK > 0 && lockK < 1) {
    const cxm = x0 + bw / 2, topY = gy - th;
    const a = lockK * (0.55 + 0.45 * Math.sin(t * 12));
    cx.strokeStyle = `rgba(255,80,70,${a})`;
    cx.lineWidth = 1.4;
    const m = 6 + 4 * (1 - lockK);
    const corners = [
      [x0 - m, topY - m, 1, 1],
      [x0 + bw + m, topY - m, -1, 1],
      [x0 - m, gy + m, 1, -1],
      [x0 + bw + m, gy + m, -1, -1],
    ] as const;
    for (const [bx, by, dx, dy] of corners) {
      cx.beginPath();
      cx.moveTo(bx + dx * 9, by);
      cx.lineTo(bx, by);
      cx.lineTo(bx, by + dy * 9);
      cx.stroke();
    }
    cx.beginPath();
    cx.arc(cxm, topY - 14, 5 + 2 * Math.sin(t * 12), 0, TAU);
    cx.stroke();
  }

  // ground fire glow after ruin
  if (cp > 0.25) {
    const a = pal.fireGlow * (0.4 + 0.3 * Math.sin(t * 9 + tw.seed));
    const g = cx.createRadialGradient(x0 + bw / 2, gy - rem * th * 0.4, 0, x0 + bw / 2, gy - rem * th * 0.4, bw * 1.5);
    g.addColorStop(0, `rgba(255,120,50,${0.4 * a})`);
    g.addColorStop(1, 'rgba(255,120,50,0)');
    cx.fillStyle = g;
    cx.fillRect(x0 - bw, gy - rem * th - bw, bw * 3, rem * th + bw);
  }
}

// ─── drawing: drones / beams / particles ─────────────────────────────────────

function drawDrone(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number,
  t: number, dr: Drone, s: { x: number; y: number; d: number; k: number },
  pal: Palette, fog: (c: RGB, d: number) => RGB,
): void {
  if (s.k <= 0) return;
  const px = PX(s.x, s.d), py = PY(s.y, s.d);
  // hull units are px at d=1 & 800px viewport; war phase swells them slightly
  const sc = depthScale(s.d) * (h / 800) * (1 + pal.war * 0.15);
  const hull = fog([10, 8, 14], s.d);
  const flick = 0.6 + 0.4 * Math.sin(t * 16 + dr.seed * 9);
  cx.save();
  cx.translate(px, py);
  cx.rotate(Math.sin(t * dr.wobble + dr.seed) * 0.12);
  cx.scale(sc, sc);
  // engine trail points back toward the rift while approaching
  if (s.k < 0.98) {
    cx.globalAlpha = (1 - s.k) * 0.7;
    cx.fillStyle = 'rgba(255,120,80,0.5)';
    cx.beginPath();
    cx.moveTo(0, 0);
    cx.lineTo((0.5 - s.x) * w / sc, (0.24 - s.y) * h / sc);
    cx.lineTo(6, 4);
    cx.closePath();
    cx.fill();
    cx.globalAlpha = 1;
  }
  // angular hull: twin chevrons
  cx.fillStyle = css(hull);
  cx.beginPath();
  cx.moveTo(-26, 2); cx.lineTo(-4, -8); cx.lineTo(0, -2); cx.lineTo(-8, 6); cx.closePath();
  cx.moveTo(26, 2); cx.lineTo(4, -8); cx.lineTo(0, -2); cx.lineTo(8, 6); cx.closePath();
  cx.fill();
  // red eye
  cx.shadowColor = 'rgba(255,60,50,0.95)';
  cx.shadowBlur = 14;
  cx.fillStyle = `rgba(255,${60 + 60 * flick | 0},50,${0.85 * (1 - hazeAmt(s.d) * 0.6)})`;
  cx.beginPath();
  cx.arc(0, 0, 3.4, 0, TAU);
  cx.fill();
  cx.shadowBlur = 0;
  // blinking nav light
  if (Math.sin(t * 5 + dr.seed * 20) > 0.7) {
    cx.fillStyle = 'rgba(255,200,120,0.9)';
    cx.fillRect(-26, 1, 2, 2);
    cx.fillRect(24, 1, 2, 2);
  }
  cx.restore();
}

function drawBeams(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number,
  t: number, towers: Tower[], drones: Drone[],
): void {
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  for (const tw of towers) {
    const local = t - tw.destroyAt;
    if (local < -0.22 || local > 0.4) continue;
    const gy = PY(groundY(1), 1);
    const tx = PX(tw.x + tw.w / 2, 1), ty = gy - tw.h * h;
    // beam origin: the drone currently nearest to the tower
    let bx = PX(0.5, 0.3), by = PY(0.24, 0.3), best = Infinity;
    for (const dr of drones) {
      const s = droneState(dr, t);
      if (s.k < 0.9) continue;
      const dx = Math.abs(s.x - (tw.x + tw.w / 2));
      if (dx < best) { best = dx; bx = PX(s.x, s.d); by = PY(s.y, s.d); }
    }
    const charge = clamp01((local + 0.22) / 0.22);
    const fade = local > 0 ? clamp01(1 - local / 0.4) : charge;
    const a = fade * (0.7 + 0.3 * Math.sin(t * 40));
    const g = cx.createLinearGradient(bx, by, tx, ty);
    g.addColorStop(0, `rgba(255,90,70,${0.85 * a})`);
    g.addColorStop(1, `rgba(255,220,190,${0.95 * a})`);
    cx.strokeStyle = g;
    cx.lineWidth = 5 * a + 1;
    cx.shadowColor = 'rgba(255,80,60,0.9)';
    cx.shadowBlur = 18;
    cx.beginPath();
    cx.moveTo(bx, by);
    cx.lineTo(tx, ty);
    cx.stroke();
    cx.shadowBlur = 0;
    // impact flash
    if (local > -0.05) {
      const fr = (0.4 + local * 2.2) * tw.w * w * 2.4;
      const fg = cx.createRadialGradient(tx, ty, 0, tx, ty, Math.max(1, fr));
      fg.addColorStop(0, `rgba(255,240,220,${0.85 * fade})`);
      fg.addColorStop(0.4, `rgba(255,120,60,${0.5 * fade})`);
      fg.addColorStop(1, 'rgba(255,120,60,0)');
      cx.fillStyle = fg;
      cx.beginPath();
      cx.arc(tx, ty, Math.max(1, fr), 0, TAU);
      cx.fill();
    }
  }
  cx.restore();
}

function updateSmoke(smoke: Smoke[], towers: Tower[], t: number, dt: number, rnd: () => number): void {
  for (const tw of towers) {
    const cp = clamp01((t - tw.destroyAt) / 2.4);
    if (cp <= 0 || cp >= 1) continue;
    if (hash3(tw.seed, Math.floor(t * 3), 4) < 0.5 && smoke.length < 160) {
      smoke.push({
        x: tw.x + rnd() * tw.w, y: groundY(1) - tw.h * (1 - cp) * rnd(),
        r: 6 + rnd() * 10, life: 0, maxLife: 2.6 + rnd() * 1.6, seed: rnd() * 10,
      });
    }
  }
  for (let i = smoke.length - 1; i >= 0; i--) {
    const s = smoke[i]!;
    s.life += dt;
    s.y -= dt * 0.03;
    s.r += dt * 9;
    if (s.life > s.maxLife) smoke.splice(i, 1);
  }
}

function drawSmoke(cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, smoke: Smoke[], pal: Palette): void {
  for (const s of smoke) {
    const k = s.life / s.maxLife;
    const px = PX(s.x + Math.sin(s.life + s.seed) * 0.01, 0.95), py = PY(s.y, 0.95);
    const g = cx.createRadialGradient(px, py, 0, px, py, s.r);
    g.addColorStop(0, css(mixc([40, 30, 30], pal.atmos, 0.4), 0.28 * (1 - k)));
    g.addColorStop(1, css(pal.atmos, 0));
    cx.fillStyle = g;
    cx.beginPath();
    cx.arc(px, py, s.r, 0, TAU);
    cx.fill();
  }
}

function updateDebris(debris: Debris[], dt: number): void {
  for (let i = debris.length - 1; i >= 0; i--) {
    const d = debris[i]!;
    d.vy += dt * 0.85;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    d.rot += d.vr * dt;
    if (d.y > groundY(1) + 0.01) d.life -= dt * 2.4;
    if (d.life <= 0) debris.splice(i, 1);
  }
}

function drawDebris(cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, debris: Debris[], pal: Palette): void {
  for (const d of debris) {
    cx.save();
    cx.translate(PX(d.x, 1), PY(d.y, 1));
    cx.rotate(d.rot);
    cx.globalAlpha = clamp01(d.life);
    cx.fillStyle = css(mixc([30, 22, 22], pal.atmos, 0.2));
    cx.fillRect(-d.s / 2, -d.s / 2, d.s, d.s * 0.7);
    cx.fillStyle = `rgba(255,130,60,${0.5 * clamp01(d.life)})`;
    cx.fillRect(-d.s / 2, -d.s / 2, d.s, 1.4);
    cx.restore();
  }
  cx.globalAlpha = 1;
}

function drawShocks(cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number, t: number, shocks: Shock[]): void {
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  for (let i = shocks.length - 1; i >= 0; i--) {
    const s = shocks[i]!;
    const k = (t - s.t0) / 0.9;
    if (k >= 1) { shocks.splice(i, 1); continue; }
    cx.globalAlpha = (1 - k) * 0.5;
    cx.strokeStyle = '#ffb080';
    cx.lineWidth = 2.4 * (1 - k) + 0.6;
    cx.beginPath();
    cx.ellipse(PX(s.x, 1), PY(s.y, 1), k * w * 0.16, k * h * 0.1, 0, 0, TAU);
    cx.stroke();
  }
  cx.restore();
}

// ─── drawing: people / embers / overlays ─────────────────────────────────────

function updatePeople(people: Person[], t: number, dt: number): void {
  for (let i = people.length - 1; i >= 0; i--) {
    const p = people[i]!;
    if (p.calm && t >= WAR_AT) p.calm = false;
    const panic = p.calm ? 1 : 1 + 0.35 * Math.sin(t * 5 + p.seed);
    p.x += p.dir * p.speed * panic * dt * (p.calm ? 1 : 1.9);
    if (p.x < -0.08 || p.x > 1.08) people.splice(i, 1);
  }
}

function drawPeople(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, h: number,
  t: number, people: Person[], foreground: boolean,
): void {
  for (const p of people) {
    if (foreground !== p.d > 1.4) continue;
    const s = h * 0.026 * depthScale(p.d);
    const px = PX(p.x, p.d), py = PY(groundY(p.d), p.d);
    const run = t * (p.calm ? 5 : 12) + p.seed * 7;
    const sw = Math.sin(run) * (p.calm ? 0.35 : 0.95);
    const lean = p.dir * (p.calm ? 0.5 : 2.2);
    const a = foreground ? 0.92 : 0.8;
    cx.strokeStyle = `rgba(8,6,10,${a})`;
    cx.fillStyle = `rgba(8,6,10,${a})`;
    cx.lineCap = 'round';
    cx.lineWidth = Math.max(1.2, s * 0.11);
    cx.beginPath();
    cx.arc(px + lean * 0.4, py - s * 0.92, s * 0.17, 0, TAU);
    cx.fill();
    cx.beginPath();
    cx.moveTo(px, py - s * 0.78);
    cx.lineTo(px + lean, py - s * 0.38);
    // legs
    cx.moveTo(px + lean, py - s * 0.38);
    cx.lineTo(px + lean + sw * s * 0.3, py);
    cx.moveTo(px + lean, py - s * 0.38);
    cx.lineTo(px + lean - sw * s * 0.3, py);
    // arms pump opposite the legs while fleeing
    if (!p.calm) {
      cx.moveTo(px, py - s * 0.7);
      cx.lineTo(px - sw * s * 0.26, py - s * 0.44);
      cx.moveTo(px, py - s * 0.7);
      cx.lineTo(px + sw * s * 0.26, py - s * 0.44);
    }
    cx.stroke();
  }
}

function drawEmbers(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number,
  t: number, pal: Palette, embers: Ember[], layer: number,
): void {
  if (pal.war <= 0.02) return;
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  for (const e of embers) {
    if (Math.abs(e.d - layer) > 0.01) continue;
    const y = ((e.y0 - t * e.sp * depthScale(e.d)) % 1.2 + 1.2) % 1.2 - 0.1;
    const x = e.x0 + Math.sin(t * 0.7 + e.ph) * 0.02;
    const px = PX(x, e.d), py = PY(y, e.d);
    const a = pal.war * (0.2 + 0.4 * (0.5 + 0.5 * Math.sin(t * 2 + e.ph))) * (e.d < 1 ? 0.5 : 1);
    const r = e.sz * depthScale(e.d);
    if (e.d > 1.4) { // foreground embers glow soft & large
      const g = cx.createRadialGradient(px, py, 0, px, py, r * 4);
      g.addColorStop(0, `rgba(255,150,70,${a * 0.5})`);
      g.addColorStop(1, 'rgba(255,150,70,0)');
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(px, py, r * 4, 0, TAU);
      cx.fill();
    }
    cx.globalAlpha = a;
    cx.fillStyle = '#ffcf90';
    cx.beginPath();
    cx.arc(px, py, r, 0, TAU);
    cx.fill();
  }
  cx.restore();
  cx.globalAlpha = 1;
}

function drawAlert(cx: CanvasRenderingContext2D, w: number, h: number, t: number, pal: Palette): void {
  if (pal.alert > 0.01) {
    const a = pal.alert * (0.06 + 0.045 * (0.5 + 0.5 * Math.sin(t * 3.1)));
    const g = cx.createRadialGradient(w / 2, h * 0.5, h * 0.3, w / 2, h * 0.5, h * 0.85);
    g.addColorStop(0, 'rgba(255,40,30,0)');
    g.addColorStop(1, `rgba(255,40,30,${a})`);
    cx.fillStyle = g;
    cx.fillRect(0, 0, w, h);
  }
}

/** Horizontal-slice glitch: spikes with the rift and every impact. */
function applyGlitch(cx: CanvasRenderingContext2D, cv: HTMLCanvasElement, w: number, h: number, t: number, towers: Tower[]): void {
  let amt = clamp01(shakeEnergy * 0.9);
  for (const tw of towers) {
    const local = Math.abs(t - tw.destroyAt);
    if (local < 0.25) amt = Math.max(amt, (1 - local / 0.25) * 0.7);
  }
  if (amt < 0.04) return;
  const dpr = cx.getTransform().a;
  for (let i = 0; i < 5; i++) {
    const sy = hash3(i, Math.floor(t * 30), 8) * h;
    const sh = 4 + hash3(i, Math.floor(t * 30), 9) * 18;
    const dx = (hash3(i, Math.floor(t * 30), 10) - 0.5) * 46 * amt;
    cx.drawImage(cv, 0, sy * dpr, cv.width, sh * dpr, dx, sy, w, sh);
  }
  cx.globalAlpha = 0.12 * amt;
  cx.fillStyle = '#ff3b30';
  cx.fillRect(0, hash3(1, Math.floor(t * 30), 11) * h, w, 2);
  cx.fillStyle = '#3bb0ff';
  cx.fillRect(0, hash3(2, Math.floor(t * 30), 12) * h, w, 2);
  cx.globalAlpha = 1;
}
