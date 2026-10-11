// 烟花设计契约与形状算法（纯模块：不依赖 DOM / Three.js / 网络）。
// 本文件镜像服务端 `apps/server/src/fireworks.ts` 的数据契约——两侧的
// 字段、区间、编码必须同步修改；形状→粒子分布的数学同时供 3D 引擎
// （rendering/fireworksEngine.ts）与设计器 2D 预览共用。
import { CAMERA_OFFSET_BILLBOARD_NORMAL } from './fireworksConstants';

export const FIREWORK_SAVE_PRICE = 30;
export const FIREWORK_DESIGN_MAX_PER_USER = 24;
export const FIREWORK_NAME_MAX = 20;

export const FIREWORK_SHAPES = [
  'peony', 'chrysanthemum', 'willow', 'ring', 'palm',
  'crossette', 'crackle', 'heart', 'star', 'pattern',
] as const;
export type FireworkShape = (typeof FIREWORK_SHAPES)[number];

export const FIREWORK_SHAPE_LABELS: Readonly<Record<FireworkShape, string>> = Object.freeze({
  peony: '牡丹', chrysanthemum: '菊花', willow: '垂柳', ring: '光环', palm: '棕榈',
  crossette: '十字蕊', crackle: '碎星', heart: '心形', star: '星形', pattern: '拼字',
});

/** 点阵拼字位图：cells 为 base64 打包位（行优先，每字节低 bit 在前）。 */
export type FireworkPattern = { cols: number; rows: number; cells: string };

export type FireworkDesign = {
  v: 1;
  /** 爆炸高度（世界 y，整数 24..90）。 */
  height: number;
  shape: FireworkShape;
  colors: { primary: string; secondary: string; trail: string };
  /** 爆炸半径百分比（60..160，100 = 基准）。 */
  size: number;
  /** 闪烁强度 0..100。 */
  sparkle: number;
  pattern?: FireworkPattern;
};

export const PATTERN_COLS = 21;
export const PATTERN_ROWS = 21;

const HEX = /^#[0-9a-f]{6}$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && HEX.test(value);

/** 编码点阵：行优先位打包 → base64（与服务端 sanitizePattern 互逆）。 */
export function encodePatternCells(cells: ReadonlyArray<boolean>): string {
  const byteLength = Math.ceil(cells.length / 8);
  const bytes = new Uint8Array(byteLength);
  cells.forEach((on, index) => {
    if (on) bytes[index >> 3]! |= 1 << (index & 7);
  });
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function decodePatternCells(pattern: FireworkPattern): boolean[] {
  if (!BASE64.test(pattern.cells)) return [];
  let binary: string;
  try {
    binary = atob(pattern.cells);
  } catch {
    return [];
  }
  const total = pattern.cols * pattern.rows;
  const out: boolean[] = new Array(total).fill(false);
  for (let i = 0; i < total && i < binary.length * 8; i += 1) {
    out[i] = (binary.charCodeAt(i >> 3)! & (1 << (i & 7))) !== 0;
  }
  return out;
}

export function emptyGrid(): boolean[] {
  return new Array(PATTERN_COLS * PATTERN_ROWS).fill(false);
}

export const defaultFireworkDesign = (): FireworkDesign => ({
  v: 1,
  height: 52,
  shape: 'peony',
  colors: { primary: '#ffd76e', secondary: '#ff5f8a', trail: '#ffe9b0' },
  size: 100,
  sparkle: 35,
});

/** 客户端保存前的本地校验（与服务端 sanitizeFireworkDesign 同规则）。 */
export function validateFireworkDesign(design: FireworkDesign): string | null {
  if (!Number.isInteger(design.height) || design.height < 24 || design.height > 90) return '高度需在 24–90 之间';
  if (!FIREWORK_SHAPES.includes(design.shape)) return '花形不合法';
  if (!isHexColor(design.colors.primary) || !isHexColor(design.colors.secondary) || !isHexColor(design.colors.trail)) return '颜色格式不合法';
  if (!Number.isInteger(design.size) || design.size < 60 || design.size > 160) return '大小需在 60%–160% 之间';
  if (!Number.isInteger(design.sparkle) || design.sparkle < 0 || design.sparkle > 100) return '闪烁需在 0–100 之间';
  if (design.shape === 'pattern') {
    if (!design.pattern) return '拼字烟花需要点阵图案';
    const { cols, rows, cells } = design.pattern;
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 10 || cols > 26 || rows < 10 || rows > 26) return '点阵尺寸不合法';
    if (!BASE64.test(cells)) return '点阵数据不合法';
    const bits = decodePatternCells(design.pattern);
    // 解码后应为空位图数组（长度 = cols×rows），且点数受上下文约束。
    if (bits.length !== cols * rows) return '点阵数据不合法';
    const on = bits.filter(Boolean).length;
    if (on < 4) return '拼字至少要画 4 个点';
    if (on > Math.floor(cols * rows * 0.55)) return '拼字太密了，留一点夜空呼吸';
  }
  return null;
}

export type Vec3 = { x: number; y: number; z: number };

/** 单颗烟花粒子的发射参数（引擎与预览共用的中间表示）。 */
export type BurstSeed = {
  /** 初始速度（世界单位/秒）。 */
  vx: number;
  vy: number;
  vz: number;
  /** 生命（秒）。 */
  life: number;
  /** 线性阻力系数（越大越快停下）。 */
  drag: number;
  /** 重力倍率（1 = 正常下坠）。 */
  gravity: number;
  /** 尺寸倍率。 */
  size: number;
  /** 0 = 主色，1 = 次色（中间插值）。 */
  colorMix: number;
  /** 参与闪烁。 */
  flicker: boolean;
  /** 生命比例到达时四分裂（十字蕊）。 */
  splitAt?: number;
};

// 形状都在一个「面向相机的广告牌平面」上展开，保证正交相机下拼字/图形
// 不被视角投影歪曲；法线取常量相机偏移方向（与 rendering 侧一致）。
const NORMAL = CAMERA_OFFSET_BILLBOARD_NORMAL;
const RIGHT: Vec3 = normalize(cross({ x: 0, y: 1, z: 0 }, NORMAL));
const UP: Vec3 = normalize(cross(NORMAL, RIGHT));

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - b.x * a.y };
}
function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}
/** 平面坐标（u 右 / v 上）→ 世界速度向量。 */
function plane(u: number, v: number, w = 0): Vec3 {
  return {
    x: RIGHT.x * u + UP.x * v + NORMAL.x * w,
    y: RIGHT.y * u + UP.y * v + NORMAL.y * w,
    z: RIGHT.z * u + UP.z * v + NORMAL.z * w,
  };
}

let seedState = 0;
/** 可重置的伪随机（预览与 3D 用不同种子也能得到同分布）。 */
function rand(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
export function seedBurstMath(seed: number): void { seedState = seed >>> 0; }

const sphereDir = (): Vec3 => {
  // 均匀球面分布（Marsaglia）。
  let u = 0, v = 0, s = 2;
  while (s > 1 || s < 1e-6) { u = rand() * 2 - 1; v = rand() * 2 - 1; s = u * u + v * v; }
  const k = Math.sqrt(1 - s);
  return { x: 2 * u * k, y: 2 * v * k, z: 1 - 2 * s };
};

const HEART = (t: number): [number, number] => {
  const x = 16 * Math.pow(Math.sin(t), 3);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
  return [x / 17, y / 17];
};
const STAR = (t: number): [number, number] => {
  // 五角星半径函数：五个尖 + 内切圆角。
  const spikes = 5;
  const angle = ((t % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const sector = (Math.PI * 2) / spikes;
  const local = angle % sector;
  const tip = Math.cos(local * spikes / 2 - Math.PI / (2 * spikes) * (spikes - 2));
  const r = 0.45 + 0.55 * Math.max(0, tip);
  return [Math.cos(angle) * r, Math.sin(angle) * r];
};

/**
 * 生成一整朵烟花的粒子发射参数。`radius` 是目标爆炸半径（世界单位），
 * 由 size% 与 shape 基准半径共同决定；阻力模型下初速 ≈ 半径 × drag，
 * 这样粒子停下时恰好铺满目标轮廓。
 */
export function buildBurstSeeds(design: FireworkDesign, radius: number): BurstSeed[] {
  const seeds: BurstSeed[] = [];
  const push = (seed: BurstSeed) => seeds.push(seed);
  const mixColor = (depth: number) => Math.max(0, Math.min(1, depth));
  const shape = design.shape;
  const sparkleOn = design.sparkle >= 50;

  const sphereBurst = (count: number, opts: { speedVar?: number; life: [number, number]; drag: number; gravity: number; size: number; yBias?: number }) => {
    for (let i = 0; i < count; i += 1) {
      const d = sphereDir();
      const y = d.y + (opts.yBias ?? 0);
      const len = Math.hypot(d.x, y, d.z) || 1;
      const variance = opts.speedVar ?? 0.55;
      const speed = radius * opts.drag * (1 - variance / 2 + rand() * variance);
      push({
        vx: (d.x / len) * speed, vy: (y / len) * speed, vz: (d.z / len) * speed,
        life: opts.life[0] + rand() * (opts.life[1] - opts.life[0]),
        drag: opts.drag, gravity: opts.gravity,
        size: opts.size * (0.75 + rand() * 0.5),
        colorMix: mixColor(rand()),
        flicker: sparkleOn && rand() < design.sparkle / 100,
      });
    }
  };

  switch (shape) {
    case 'peony':
      sphereBurst(300, { life: [1.5, 2.1], drag: 1.15, gravity: 0.9, size: 1 });
      break;
    case 'chrysanthemum':
      // 长尾垂坠：低阻力 + 长生命 + 稍强重力。
      sphereBurst(280, { life: [2.6, 3.4], drag: 0.85, gravity: 1.15, size: 1.15 });
      break;
    case 'willow':
      sphereBurst(230, { speedVar: 0.4, life: [3.2, 4.2], drag: 0.4, gravity: 0.95, size: 1.25, yBias: 0.25 });
      break;
    case 'palm':
      sphereBurst(110, { speedVar: 0.35, life: [2.1, 2.7], drag: 0.75, gravity: 1.35, size: 1.8, yBias: 0.35 });
      break;
    case 'crackle':
      sphereBurst(220, { speedVar: 0.8, life: [0.9, 1.5], drag: 2.1, gravity: 0.5, size: 0.85 });
      break;
    case 'ring': {
      const count = 170;
      for (let i = 0; i < count; i += 1) {
        const t = (i / count) * Math.PI * 2;
        const wobble = (rand() - 0.5) * 0.08;
        const v = plane(Math.cos(t), Math.sin(t), wobble);
        const speed = radius * 1.1 * (0.96 + rand() * 0.08);
        push({
          vx: v.x * speed, vy: v.y * speed, vz: v.z * speed,
          life: 1.7 + rand() * 0.5, drag: 1.1, gravity: 0.55,
          size: 1 * (0.8 + rand() * 0.4),
          colorMix: mixColor(rand() * 0.6), flicker: sparkleOn && rand() < 0.3,
        });
      }
      // 环心补一小撮牡丹芯。
      sphereBurst(70, { speedVar: 0.9, life: [1.2, 1.7], drag: 1.4, gravity: 0.7, size: 0.8 });
      break;
    }
    case 'crossette': {
      const count = 90;
      for (let i = 0; i < count; i += 1) {
        const d = sphereDir();
        const speed = radius * 0.95 * (0.85 + rand() * 0.3);
        push({
          vx: d.x * speed, vy: d.y * speed, vz: d.z * speed,
          life: 1.9 + rand() * 0.4, drag: 1.0, gravity: 0.9,
          size: 1.25, colorMix: mixColor(rand() * 0.5),
          flicker: false, splitAt: 0.45 + rand() * 0.1,
        });
      }
      break;
    }
    case 'heart':
    case 'star': {
      const count = 230;
      const curve = shape === 'heart' ? HEART : STAR;
      for (let i = 0; i < count; i += 1) {
        const t = (i / count) * Math.PI * 2 + rand() * 0.02;
        const [cx, cy] = curve(t);
        const jitter = (rand() - 0.5) * 0.06;
        const v = plane(cx + jitter, cy + jitter * 0.7, (rand() - 0.5) * 0.05);
        const speed = radius * 1.05;
        push({
          vx: v.x * speed, vy: v.y * speed, vz: v.z * speed,
          life: 2.1 + rand() * 0.5, drag: 1.05, gravity: 0.45,
          size: 1.05 * (0.85 + rand() * 0.35),
          colorMix: mixColor(rand() * 0.75), flicker: sparkleOn && rand() < 0.25,
        });
      }
      break;
    }
    case 'pattern': {
      const pattern = design.pattern;
      if (!pattern) break;
      const bits = decodePatternCells(pattern);
      const { cols, rows } = pattern;
      // 点阵铺满约 1.15 倍半径的方形区域，格子中心即粒子目标位置。
      const step = (radius * 2.3) / cols;
      const cellRadius = (radius * 2.3) / Math.max(cols, rows);
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (!bits[row * cols + col]) continue;
          const u = (col - (cols - 1) / 2) * step;
          const v = ((rows - 1) / 2 - row) * step;
          const v3 = plane(u, v, (rand() - 0.5) * cellRadius * 0.5);
          const speed = 1; // 平面内位置由速度×时间≈半径关系不适用，这里直接给位移型速度。
          push({
            vx: v3.x * speed, vy: v3.y * speed, vz: v3.z * speed,
            life: 3.6 + rand() * 1.1, drag: 0.62, gravity: 0.03,
            size: 1.35 * (0.9 + rand() * 0.25),
            colorMix: rand() < 0.82 ? mixColor(rand() * 0.3) : mixColor(0.6 + rand() * 0.4),
            flicker: rand() < 0.5,
          });
        }
      }
      break;
    }
  }
  return seeds;
}

/** 拼字烟花的基准半径（世界单位）——比球形烟花更大以保证可读性。 */
export const PATTERN_RADIUS_SCALE = 1.25;
