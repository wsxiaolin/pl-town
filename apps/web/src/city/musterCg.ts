// MUSTER CG — continuous cinematic「集结」(issue #86)
// Sequel to the invasion CG (「入侵」). The siege is broken; what remains is a
// scarred city whose residents refuse to leave. One uninterrupted arc:
// embers → civic petition (众议院/参议院/社区中心) → technical diagnosis
// (各学院/技术半区) → volunteer patrols → lights re-ignite.
//
// Shares the structural trick of invasionCg: a single continuous clock, no
// scene cuts, and every drawable carrying a depth factor d for parallax,
// depth-scale, and aerial haze. The palette here drifts cold-ash → dawn-gold.
//
// Console-only entry points are exposed through window._mini:
//   _mini.musterCG()      start playback (returns success)
//   _mini.stopMusterCG()  stop and fade out

import { destroyCG } from './cg';

type RGB = [number, number, number];

const TAU = Math.PI * 2;
const GY = 0.8; // main-plane ground line (normalized y)
const PETITION_AT = 4.0;   // residents gather at the civic halls
const DIAGNOSIS_AT = 12.0; // technicians parse the damage
const PATROL_AT = 18.0;    // volunteers begin watch
const RELIGHT_AT = 24.0;   // first block relights
const TITLE_AT = 33.0;
const AUTO_CLOSE_AT = 44;

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
const easeInOut = (x: number) => { const t2 = clamp01(x); return t2 * t2 * (3 - 2 * t2); };

// ─── depth + color helpers ───────────────────────────────────────────────────

const depthScale = (d: number) => 0.3 + 0.72 * d;
const hazeAmt = (d: number) => clamp01((1 - d) * 0.8);
const groundY = (d: number) => GY + (d - 1) * 0.12;

const mixc = (a: RGB, b: RGB, k: number): RGB => [
  lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k),
];
const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

interface Palette {
  top: RGB; mid: RGB; bot: RGB; atmos: RGB;
  dawn: number;      // warms toward the relight
  petition: number;  // civic lantern glow
  tech: number;      // electric-blue scan lines
  relight: number;   // relight master gain
}

function paletteAt(t: number): Palette {
  const petition = smoothstep(PETITION_AT, PETITION_AT + 6, t);
  const tech = smoothstep(DIAGNOSIS_AT, DIAGNOSIS_AT + 5, t);
  const relight = smoothstep(RELIGHT_AT, RELIGHT_AT + 6, t);
  const dawn = smoothstep(RELIGHT_AT + 2, TITLE_AT + 6, t);
  const mix4 = (ash: RGB, dawn4: RGB) => mixc(ash, dawn4, dawn);
  return {
    top: mix4([10, 11, 16], [16, 26, 52]),
    mid: mix4([22, 20, 26], [84, 96, 128]),
    bot: mix4([40, 26, 20], [196, 148, 92]),
    atmos: mixc(mixc([60, 58, 62], [120, 130, 160], dawn), [200, 170, 130], relight * 0.4),
    dawn,
    petition,
    tech,
    relight,
  };
}

// ─── world entities ──────────────────────────────────────────────────────────

interface Tower {
  x: number; w: number; h: number; seed: number;
  litAt: number;   // relight order (Infinity = still dark)
  ruined: number;  // 0 intact … 1 heavily damaged (invasion aftermath)
  civic: 0 | 1 | 2 | 3; // 0 none, 1 众议院, 2 参议院, 3 社区中心
  sparkSeed: number;
}

interface FarTower { x: number; w: number; h: number; seed: number; litAt: number }

interface Person {
  x: number; dir: 1 | -1; d: number; speed: number; seed: number;
  kind: 'walker' | 'speaker' | 'listener' | 'patrol' | 'guard' | 'tech' | 'comforter';
  group?: { cx: number; cy: number; ring: number; label: string };
  targetX?: number;
}

type TechnicianGroup = { cx: number; cy: number; ring: number; label: string };

interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; sz: number; warm: boolean; d: number }
interface Dust { x: number; y: number; v: number; drift: number; r: number; d: number }

// ─── module state ────────────────────────────────────────────────────────────

let active = false;
let rafId: number | null = null;
let resizeHandler: (() => void) | null = null;
let keyHandler: ((e: KeyboardEvent) => void) | null = null;
let clickHandler: (() => void) | null = null;
let closeTimer: number | null = null;

export function musterCGActive(): boolean {
  return active;
}

// ─── captions ────────────────────────────────────────────────────────────────

const CAPTIONS: ReadonlyArray<readonly [number, string]> = [
  [1.0, '炮火熄灭之后，城市并没有入睡。'],
  [5.0, '寻常居民聚拢在众议院、参议院与社区中心，参报每一个问题。'],
  [13.0, '技术人员在各学院与技术半区，拆解、测量、求证。'],
  [19.0, '志愿者们巡逻与安抚，一寸一寸守住夜色。'],
  [26.0, '城市依然破旧，但下一条街，已经有灯重新点亮。'],
];

// ─── public API ──────────────────────────────────────────────────────────────

export function startMusterCG(): boolean {
  const overlay = document.getElementById('cgOverlay');
  const wrap = document.getElementById('cgSceneWrap');
  if (!overlay || !wrap) return false;
  if (active) stopMusterCG(true);
  // take over the shared overlay; stop the intro CG loop if it is mid-flight
  destroyCG();

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  active = true;

  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));

  wrap.innerHTML = `
    <canvas class="cg-canvas"></canvas>
    <div class="cg-cut"></div>
    <div class="cgm2-caption" id="cgm2Caption"></div>
    <div class="cgm2-title-block" id="cgm2Title">
      <span class="cg-kicker">REKINDLE · PROTOCOL HOPE</span>
      <h1 class="cgm2-title">集 结</h1>
      <p class="cgm2-title-en">W E&ensp;R E B U I L D&ensp;T O G E T H E R</p>
      <p class="cgm2-hint">点击任意处或按 Esc 退出</p>
    </div>`;

  const progress = document.getElementById('cgProgress');
  if (progress) progress.innerHTML = '<div class="cgm2-bar"><i id="cgm2BarFill"></i></div>';

  const cv = wrap.querySelector<HTMLCanvasElement>('canvas.cg-canvas');
  const cx = cv?.getContext('2d');
  const captionEl = wrap.querySelector<HTMLElement>('#cgm2Caption');
  const titleEl = wrap.querySelector<HTMLElement>('#cgm2Title');
  const barFill = document.getElementById('cgm2BarFill');
  if (!cv || !cx || !captionEl || !titleEl) { stopMusterCG(); return false; }

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

  // ── world state ────────────────────────────────────────────────────────────
  const towers = genTowers();
  const farSkyline = genFarSkyline();
  const rnd = mulberry32(60401);
  const people: Person[] = [];
  const dust: Dust[] = [];
  const repair: Particle[] = [];
  const sparks: Particle[] = [];
  // technician groups stationed at the academies / tech half-district
  const techGroups: TechnicianGroup[] = [
    { cx: 0.30, cy: 0.55, ring: 0.055, label: '学院·东' },
    { cx: 0.47, cy: 0.50, ring: 0.048, label: '技术半区' },
    { cx: 0.62, cy: 0.57, ring: 0.052, label: '学院·西' },
  ];

  for (let i = 0; i < 60; i++) {
    dust.push({
      x: rnd(), y: 0.35 + rnd() * 0.6, v: 0.005 + rnd() * 0.014,
      drift: rnd() * TAU, r: 0.5 + rnd() * 1.7, d: 0.9 + rnd() * 0.3,
    });
  }

  // pre-assign relight order to survivors (deterministic); damaged ones get relit later or never
  const relightQueue = towers.filter((tw) => tw.ruined < 0.6);
  for (const tw of relightQueue) tw.litAt = RELIGHT_AT + 1 + hash3(tw.seed, 1, 4) * 10;
  for (const tw of towers) {
    if (tw.ruined >= 0.6) tw.litAt = Infinity;
    // civic halls are the first to be relit no matter their damage
    if (tw.civic !== 0) tw.litAt = RELIGHT_AT - 3 + tw.civic * 1.6;
  }
  for (const ft of farSkyline) ft.litAt = RELIGHT_AT + 3 + hash3(ft.seed, 3, 9) * 11;

  // helper: spawn a walker drifting toward the civic plaza
  const spawnWalker = (targetX: number, d = 0.95, kind: Person['kind'] = 'walker') => {
    const startX = targetX + (rnd() - 0.5) * 0.5;
    people.push({
      x: startX, dir: (targetX > startX ? 1 : -1) as 1 | -1, d: d + rnd() * 0.2,
      speed: 0.012 + rnd() * 0.012, seed: rnd() * 10, kind, targetX,
    });
  };

  const spawnPetPerson = () => {
    // residents answer the call after the petition opens
    const halls = towers.filter((tw) => tw.civic === 1 || tw.civic === 2 || tw.civic === 3);
    const hall = halls[Math.floor(rnd() * halls.length)]!;
    spawnWalker(hall.x + hall.w / 2, 0.9 + rnd() * 0.4, 'walker');
  };

  const spawnPatrol = (count: number) => {
    for (let i = 0; i < count; i++) {
      const d = 1.6 + rnd() * 0.5;
      people.push({
        x: rnd(), dir: rnd() < 0.5 ? -1 : 1, d, speed: 0.02 + rnd() * 0.03,
        seed: rnd() * 10, kind: 'patrol',
      });
    }
  };

  const spawnRepairSparks = (tw: Tower, count = 2) => {
    const gy = groundY(1);
    for (let i = 0; i < count; i++) {
      const bx = tw.x + rnd() * tw.w;
      const by = gy - tw.h * (0.2 + rnd() * 0.65);
      repair.push({
        x: bx, y: by, vx: (rnd() - 0.5) * 0.02, vy: -(0.008 + rnd() * 0.016),
        life: 0, maxLife: 2.6 + rnd() * 1.6, sz: 0.8 + rnd() * 1.7, warm: rnd() < 0.4, d: 1,
      });
    }
  };

  // ── per-frame render ───────────────────────────────────────────────────────

  const t0 = reduced ? TITLE_AT : 0;
  let startStamp: number | null = null;
  let last = 0;
  let lastT = t0;
  let captionIdx = -1;
  let titleShown = false;

  const PX = (x: number, d: number) => x * w;
  const PY = (y: number, d: number) => y * h;

  const frame = (now: number) => {
    if (!active) return;
    if (startStamp === null) { startStamp = now; last = now; }
    const t = t0 + (now - startStamp) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const pal = paletteAt(t);
    const fog = (c: RGB, d: number) => mixc(c, pal.atmos, hazeAmt(d));

    // edge-triggered spawners
    if (lastT < PETITION_AT && t >= PETITION_AT) {
      for (let i = 0; i < 9; i++) spawnPetPerson();
    }
    if (lastT < DIAGNOSIS_AT && t >= DIAGNOSIS_AT) {
      for (const g of techGroups) {
        for (let i = 0; i < 4; i++) {
          people.push({
            x: g.cx + (rnd() - 0.5) * g.ring * 2, dir: 1, d: 0.9,
            speed: 0.004 + rnd() * 0.004, seed: rnd() * 10, kind: 'tech', group: g,
          });
        }
      }
    }
    if (lastT < PATROL_AT && t >= PATROL_AT) spawnPatrol(5);
    lastT = t;

    // slow ambient walker spawning until the petition phase settles
    if (t < DIAGNOSIS_AT && people.length < 16 && hash3(Math.floor(t * 2), 1, 1) < 0.5) {
      spawnPetPerson();
    }

    drawSky(cx, w, h, t, pal);
    drawFarSkyline(cx, PX, PY, w, h, t, pal, farSkyline, fog);
    drawEmbersUp(cx, PX, PY, w, h, t, pal, dust);
    for (const tw of towers) drawTower(cx, PX, PY, w, h, t, pal, tw, fog);
    updateAndDrawTech(cx, PX, PY, w, h, t, pal, people, techGroups, fog);
    drawPeople(cx, PX, PY, h, t, people, false, pal);
    drawEmbersUp(cx, PX, PY, w, h, t, pal, dust, 1);
    drawPeople(cx, PX, PY, h, t, people, true, pal);
    updateRepairSparks(repair, dt);
    drawRepairSparks(cx, PX, PY, repair, pal);
    updateSparks(sparks, dt);
    drawSparks(cx, PX, PY, sparks);
    drawVignette(cx, w, h, pal);

    // repair crew particles seeded off relit towers
    if (pal.relight > 0) {
      for (const tw of towers) {
        if (tw.litAt < t - 4 && tw.civic === 0 && hash3(tw.seed, Math.floor(t * 1.5), 7) < 0.35) {
          spawnRepairSparks(tw);
        }
      }
    }

    // captions / title / linear-progress
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

    if (t >= AUTO_CLOSE_AT) { stopMusterCG(); return; }
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);

  // exit affordances
  keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') stopMusterCG(); };
  clickHandler = () => {
    if (startStamp !== null && performance.now() - startStamp > 1500) stopMusterCG();
  };
  window.addEventListener('keydown', keyHandler);
  overlay.addEventListener('click', clickHandler);
  return true;
}

export function stopMusterCG(silent = false): void {
  if (!active) return;
  active = false;
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  if (resizeHandler) { window.removeEventListener('resize', resizeHandler); resizeHandler = null; }
  if (keyHandler) { window.removeEventListener('keydown', keyHandler); keyHandler = null; }
  const overlay = document.getElementById('cgOverlay');
  const wrap = document.getElementById('cgSceneWrap');
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

// ─── skyline generators ──────────────────────────────────────────────────────

/** Coalition of civic halls and residential blocks; the invasion carved gaps. */
function genTowers(): Tower[] {
  const rnd = mulberry32(20260819);
  const towers: Tower[] = [];
  let x = -0.02;
  while (x < 1.04) {
    const bw = 0.045 + rnd() * 0.052;
    const th = 0.16 + rnd() * 0.34;
    const ruined = hash3(rnd() * 1000, 3, 1) < 0.32 ? 0.3 + rnd() * 0.65 : 0;
    towers.push({ x, w: bw, h: th, seed: rnd() * 1000, litAt: Infinity, ruined, civic: 0, sparkSeed: rnd() * 1000 });
    x += bw + 0.007 + rnd() * 0.015;
  }
  // seed the three civic halls in deterministic positions (mid-band)
  const pick = (civic: 1 | 2 | 3, targetX: number) => {
    let best: Tower | null = null;
    let bestD = Infinity;
    for (const tw of towers) {
      const d = Math.abs(tw.x + tw.w / 2 - targetX);
      if (d < bestD && tw.civic === 0) { bestD = d; best = tw; }
    }
    if (best) {
      best.civic = civic;
      best.ruined *= 0.2; // civic halls took less damage thanks to shielded vaults
    }
  };
  pick(1, 0.24); // 众议院
  pick(2, 0.62); // 参议院
  pick(3, 0.82); // 社区中心
  return towers;
}

function genFarSkyline(): FarTower[] {
  const rnd = mulberry32(424242);
  const out: FarTower[] = [];
  let x = -0.05;
  while (x < 1.1) {
    const bw = 0.03 + rnd() * 0.045;
    out.push({ x, w: bw, h: 0.05 + rnd() * 0.15, seed: rnd() * 1000, litAt: Infinity });
    x += bw + 0.004 + rnd() * 0.01;
  }
  return out;
}

// ─── drawing: sky / far skyline / towers ─────────────────────────────────────

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
  // a cold wash keeps the ash phase from torching the frame; the dawn is earned later
  const cool = 1 - pal.dawn;
  if (cool > 0.02) {
    const v = cx.createRadialGradient(w / 2, h * 0.48, h * 0.34, w / 2, h * 0.48, h * 0.86);
    v.addColorStop(0, `rgba(20,24,38,${cool * 0.18})`);
    v.addColorStop(1, 'rgba(20,24,38,0)');
    cx.fillStyle = v;
    cx.fillRect(0, 0, w, h);
  }
  // before the dawn breaks, faint stars survive the soot
  const starA = (1 - pal.dawn * 0.7) * (1 - pal.relight * 0.4);
  if (starA > 0.02) {
    for (let i = 0; i < 120; i++) {
      const x = hash3(i, 1, 5), y = hash3(i, 2, 9) * 0.55;
      cx.globalAlpha = starA * (0.18 + 0.42 * (0.5 + 0.5 * Math.sin(t * (0.5 + hash3(i, 3, 1) * 1.4) + i)));
      cx.fillStyle = '#cfd8ee';
      cx.fillRect(x * w, y * h, 1.3, 1.3);
    }
    cx.globalAlpha = 1;
  }
}

function drawFarSkyline(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number,
  t: number, pal: Palette, towers: FarTower[], fog: (c: RGB, d: number) => RGB,
): void {
  const D = 0.42;
  const gy = PY(groundY(D), D);
  // haze lifts as relight reaches the horizon
  const planeAlpha = clamp01(0.45 + pal.dawn * 0.5);
  const body = fog([16, 18, 28], D);
  cx.save();
  cx.globalAlpha = planeAlpha;
  for (const tw of towers) {
    const x = PX(tw.x, D), bw = tw.w * w, bh = tw.h * h;
    cx.fillStyle = css(body);
    cx.fillRect(x, gy - bh, bw, bh);
    const lit = t > tw.litAt;
    if (lit) {
      // far blocks come back one by one — sparse warm pinpricks
      const rows = Math.max(1, Math.floor(bh / 18));
      const cols = Math.max(1, Math.floor(bw / 14));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (hash3(tw.seed + r * 13, c, 4) < 0.22) {
            cx.fillStyle = `rgba(255,214,150,${0.5 * pal.relight})`;
            cx.fillRect(x + (c + 0.28) * (bw / cols), gy - bh + (r + 0.3) * (bh / rows), bw / cols * 0.4, bh / rows * 0.36);
          }
        }
      }
    }
  }
  cx.restore();
  // atmospheric floor haze pushes the far plane back
  const hz = cx.createLinearGradient(0, gy - h * 0.2, 0, gy);
  hz.addColorStop(0, css(pal.atmos, 0));
  hz.addColorStop(1, css(pal.atmos, 0.15 * (1 - pal.dawn * 0.6)));
  cx.fillStyle = hz;
  cx.fillRect(0, gy - h * 0.2, w, h * 0.2);
}

function drawTower(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number,
  t: number, pal: Palette, tw: Tower, fog: (c: RGB, d: number) => RGB,
): void {
  const gy = PY(groundY(1), 1);
  const x0 = PX(tw.x, 1);
  const bw = tw.w * w;
  const th = tw.h * h;
  const ruin = tw.ruined;
  const cp = clamp01(ruin); // crumble front
  const lit = t > tw.litAt;
  const litRatio = lit ? 1 : lerp(0.5, 0.04, pal.relight === 0 ? 1 : pal.relight);
  const SL = 7;
  const rem = 1 - cp * 0.9;
  const bodyBase = fog(mixc(mixc([16, 18, 30], [26, 15, 16], ruin * 0.7), [22, 24, 34], lit ? 0.5 : 0), 1);

  for (let i = 0; i < SL; i++) {
    const sBot = i / SL;
    if (sBot >= rem) break;
    const sTop = Math.min((i + 1) / SL, rem);
    const jit = Math.sin(tw.seed + i * 3.1 + t * 22) * 2 * cp * sBot;
    const y = gy - sTop * th;
    const sh = (sTop - sBot) * th + 0.6;
    cx.fillStyle = css(bodyBase);
    cx.fillRect(x0 + jit, y, bw, sh);
    const cols = Math.max(2, Math.floor(bw / 13));
    const rows = Math.max(2, Math.floor((sTop - sBot) * th / 15));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const seedHash = hash3(tw.seed + i * 17, c, r);
        const on = lit
          ? seedHash < 0.62 && hash3(tw.seed, c * 3 + r, Math.floor(t * 2)) > 0.05
          : seedHash < litRatio * 0.5 && hash3(tw.seed, c * 3 + r, Math.floor(t * 5)) > 0.06;
        if (!on) continue;
        const tone = lit
          ? (hash3(tw.seed + c, r, 2) < 0.6 ? '255,220,160' : '186,214,255')
          : '220,180,130';
        cx.fillStyle = `rgba(${tone},${(lit ? 0.85 : 0.5) * (1 - ruin * 0.4)})`;
        cx.fillRect(x0 + jit + (c + 0.28) * (bw / cols), y + (r + 0.3) * (sh / rows), bw / cols * 0.42, sh / rows * 0.4);
      }
    }
  }
  if (rem > 0.01 && !lit) {
    cx.fillStyle = `rgba(150,190,255,${0.1 * (1 - pal.relight * 0.4)})`;
    cx.fillRect(x0, gy - rem * th, bw, 1.2);
  }
  // civic halls burn a lantern that prefigures the relight
  if (tw.civic !== 0 && pal.petition > 0.02) {
    const cxm = x0 + bw / 2;
    const lantern = 0.35 + 0.3 * Math.sin(t * 1.4 + tw.civic * 2.3);
    const g = cx.createRadialGradient(cxm, gy - th * 0.5, 0, cxm, gy - th * 0.5, bw * 1.4);
    g.addColorStop(0, `rgba(255,214,140,${0.35 * lantern * pal.petition})`);
    g.addColorStop(1, 'rgba(255,214,140,0)');
    cx.fillStyle = g;
    cx.fillRect(x0 - bw, gy - th - bw, bw * 3, th + bw);
  }
}

// ─── drawing: people ─────────────────────────────────────────────────────────

function updateAndDrawTech(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number,
  t: number, pal: Palette, people: Person[], groups: TechnicianGroup[],
  fog: (c: RGB, d: number) => RGB,
): void {
  if (pal.tech <= 0.01) return;
  const ringColor = fog(mixc([90, 170, 255], [140, 200, 255], pal.tech), 0.9);

  for (const g of groups) {
    const gx = PX(g.cx, 0.9), gy = PY(g.cy, 0.9);
    const R = g.ring * w * (0.92 + 0.08 * Math.sin(t * 0.9 + g.ring * 40));
    // hex-grid ring that breathes with the tech phase
    cx.save();
    cx.globalCompositeOperation = 'lighter';
    cx.strokeStyle = css(ringColor, 0.3 * pal.tech);
    cx.lineWidth = 1.1;
    cx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const a = (i / 6) * TAU + t * 0.12;
      const x = gx + Math.cos(a) * R;
      const y = gy + Math.sin(a) * R * 0.62;
      if (i === 0) cx.moveTo(x, y); else cx.lineTo(x, y);
    }
    cx.stroke();
    // scanline sweep over the ring
    const scan = ((t * 0.34 + g.ring * 90) % 1);
    const sx = gx - R + scan * R * 2;
    const grad = cx.createLinearGradient(sx - R * 0.4, gy, sx, gy);
    grad.addColorStop(0, css(ringColor, 0));
    grad.addColorStop(1, css(ringColor, 0.22 * pal.tech));
    cx.strokeStyle = grad;
    cx.lineWidth = 1.4;
    cx.beginPath();
    cx.moveTo(sx - R * 0.4, gy - R * 0.62);
    cx.lineTo(sx, gy - R * 0.62);
    cx.stroke();
    // binary tickers climbing the circumference
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + t * 0.2;
      const bit = hash3(i, Math.floor(t * 9), g.ring * 60) < 0.5 ? '0' : '1';
      cx.globalAlpha = 0.3 * pal.tech;
      cx.fillStyle = css(ringColor);
      cx.font = `${Math.round(w * 0.006)}px ui-monospace, Consolas, monospace`;
      cx.fillText(bit, gx + Math.cos(a) * R, gy + Math.sin(a) * R * 0.62);
    }
    cx.restore();
  }

  // technicians huddle around the ring, heads bobbing, arms cycling tools
  for (const p of people) {
    if (p.kind !== 'tech' || !p.group) continue;
    const g = p.group;
    const gx = PX(g.cx, 0.9), gy = PY(g.cy, 0.9);
    const a = p.seed * 3.1 + t * 0.3;
    const px = gx + Math.cos(a) * g.ring * w * 0.92;
    const py = gy + Math.sin(a) * g.ring * w * 0.55;
    const s = h * 0.022 * depthScale(p.d);
    const lean = Math.sin(t * 2.2 + p.seed) * 0.6;
    cx.strokeStyle = `rgba(10,10,14,${0.86})`;
    cx.fillStyle = `rgba(10,10,14,${0.86})`;
    cx.lineCap = 'round';
    cx.lineWidth = Math.max(1.2, s * 0.11);
    cx.beginPath();
    cx.arc(px + lean * 0.3, py - s * 0.92, s * 0.16, 0, TAU);
    cx.fill();
    cx.beginPath();
    cx.moveTo(px, py - s * 0.78);
    cx.lineTo(px + lean, py - s * 0.38);
    cx.moveTo(px + lean, py - s * 0.38);
    cx.lineTo(px + lean + Math.sin(t * 1.8 + p.seed) * s * 0.28, py);
    cx.moveTo(px + lean, py - s * 0.38);
    cx.lineTo(px + lean - Math.sin(t * 1.8 + p.seed) * s * 0.28, py);
    cx.stroke();
    // tool work: alternating blur
    if (Math.sin(t * 4.2 + p.seed) > 0.4) {
      cx.strokeStyle = `rgba(150,190,255,${0.5 * pal.tech})`;
      cx.lineWidth = 1.2;
      cx.beginPath();
      cx.moveTo(px, py - s * 0.68);
      cx.lineTo(px - s * 0.5, py - s * 0.4);
      cx.stroke();
    }
  }
}

function drawPeople(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, h: number,
  t: number, people: Person[], foreground: boolean, pal: Palette,
): void {
  for (const p of people) {
    if (p.kind === 'tech') continue;
    if (foreground !== p.d > 1.4) continue;
    const s = h * 0.026 * depthScale(p.d);
    const px = PX(p.x, p.d), py = PY(groundY(p.d), p.d);
    // guards / comforters / walkers all share the same silhouette; patrol gets a lantern
    const isPatrol = p.kind === 'patrol';
    const run = t * (isPatrol ? 5.5 : 5) + p.seed * 7;
    const sw = Math.sin(run) * (isPatrol ? 0.5 : 0.35);
    const lean = p.dir * (isPatrol ? 1.1 : 0.5);
    const a = foreground ? 0.92 : 0.8;
    cx.strokeStyle = `rgba(9,8,12,${a})`;
    cx.fillStyle = `rgba(9,8,12,${a})`;
    cx.lineCap = 'round';
    cx.lineWidth = Math.max(1.2, s * 0.11);
    cx.beginPath();
    cx.arc(px + lean * 0.4, py - s * 0.92, s * 0.17, 0, TAU);
    cx.fill();
    cx.beginPath();
    cx.moveTo(px, py - s * 0.78);
    cx.lineTo(px + lean, py - s * 0.38);
    cx.moveTo(px + lean, py - s * 0.38);
    cx.lineTo(px + lean + sw * s * 0.3, py);
    cx.moveTo(px + lean, py - s * 0.38);
    cx.lineTo(px + lean - sw * s * 0.3, py);
    cx.stroke();
    if (isPatrol) {
      // lantern swing lights the way toward the relight
      const swing = Math.sin(t * 1.6 + p.seed) * s * 0.5;
      const lx = px + swing, ly = py - s * 0.64;
      const lanternA = pal.relight * (0.55 + 0.2 * Math.sin(t * 2.4 + p.seed));
      cx.save();
      cx.globalCompositeOperation = 'lighter';
      const g = cx.createRadialGradient(lx, ly, 0, lx, ly, s * 2.2);
      g.addColorStop(0, `rgba(255,220,150,${0.55 * lanternA})`);
      g.addColorStop(1, 'rgba(255,220,150,0)');
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(lx, ly, s * 2.2, 0, TAU);
      cx.fill();
      cx.restore();
      cx.fillStyle = `rgba(255,220,150,${0.9 * lanternA})`;
      cx.fillRect(lx - s * 0.08, ly - s * 0.08, s * 0.16, s * 0.16);
    }
  }
}

// ─── drawing: particles / overlays ───────────────────────────────────────────

/** Ember-filtered dust rising through the ash, localized by depth. */
function drawEmbersUp(
  cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, w: number, h: number,
  t: number, pal: Palette, dust: Dust[], layer = -1,
): void {
  for (const e of dust) {
    if (layer >= 0 && (e.d < 1.4 || e.d > 1.9)) continue; // foreground embers pass
    if (layer < 0 && e.d > 1.4) continue;
    const y = ((e.y - t * e.v * depthScale(e.d)) % 1 + 1) % 1 - 0.02;
    const x = e.x + Math.sin(t * 0.6 + e.drift) * 0.02;
    const px = PX(x, e.d), py = PY(y, e.d);
    const cold = e.d < 1 ? 0.35 : 1;
    const a = (pal.relight * 0.3 + 0.15) * cold * (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.6 + e.drift)));
    const r = e.r * depthScale(e.d);
    if (e.d > 1.4) {
      const g = cx.createRadialGradient(px, py, 0, px, py, r * 4);
      g.addColorStop(0, `rgba(255,180,110,${a * 0.5})`);
      g.addColorStop(1, 'rgba(255,180,110,0)');
      cx.fillStyle = g;
      cx.beginPath();
      cx.arc(px, py, r * 4, 0, TAU);
      cx.fill();
    }
    cx.globalAlpha = a;
    cx.fillStyle = '#ffd9a8';
    cx.beginPath();
    cx.arc(px, py, r, 0, TAU);
    cx.fill();
    cx.globalAlpha = 1;
  }
}

function updateRepairSparks(list: Particle[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.life > p.maxLife) list.splice(i, 1);
  }
}

function drawRepairSparks(cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, list: Particle[], pal: Palette): void {
  if (list.length === 0) return;
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const k = 1 - p.life / p.maxLife;
    const px = PX(p.x, p.d), py = PY(p.y, p.d);
    const r = p.sz * depthScale(p.d);
    cx.globalAlpha = (pal.relight * 0.65 + 0.2) * k * (p.warm ? 0.9 : 0.55);
    cx.fillStyle = p.warm ? '#ffd9a8' : '#9cc2ff';
    cx.beginPath();
    cx.arc(px, py, r * (0.7 + 0.3 * k), 0, TAU);
    cx.fill();
  }
  cx.restore();
  cx.globalAlpha = 1;
}

function updateSparks(list: Particle[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += dt * 0.12;
    if (p.life > p.maxLife || p.y > groundY(p.d) + 0.02) list.splice(i, 1);
  }
}

function drawSparks(cx: CanvasRenderingContext2D, PX: Proj, PY: Proj, list: Particle[]): void {
  if (list.length === 0) return;
  cx.save();
  cx.globalCompositeOperation = 'lighter';
  for (const p of list) {
    const k = 1 - p.life / p.maxLife;
    cx.globalAlpha = k * 0.85;
    cx.fillStyle = p.warm ? '#ffd9a8' : '#9cc2ff';
    const px = PX(p.x, p.d), py = PY(p.y, p.d);
    cx.beginPath();
    cx.arc(px, py, p.sz * depthScale(p.d) * k, 0, TAU);
    cx.fill();
  }
  cx.restore();
  cx.globalAlpha = 1;
}

/** Cool vignette keeps the ash cold until dawn warms the corners. */
function drawVignette(cx: CanvasRenderingContext2D, w: number, h: number, pal: Palette): void {
  const cold = (1 - pal.dawn) * 0.16;
  const warm = pal.dawn * 0.1;
  if (cold < 0.01 && warm < 0.01) return;
  const g = cx.createRadialGradient(w / 2, h * 0.5, h * 0.32, w / 2, h * 0.5, h * 0.88);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, cold > 0.01 ? `rgba(10,12,20,${cold})` : `rgba(255,200,120,${warm})`);
  cx.fillStyle = g;
  cx.fillRect(0, 0, w, h);
}

// ─── module cleanup on teardown (called from destroyMiniCity) ────────────────

export function destroyMusterCG(): void {
  stopMusterCG(true);
}
