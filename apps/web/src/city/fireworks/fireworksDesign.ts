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

/** 星体尾迹：无 / 彗尾 / 碎金。 */
export const FIREWORK_TRAILS = ['none', 'comet', 'glitter'] as const;
export type FireworkTrail = (typeof FIREWORK_TRAILS)[number];
export const FIREWORK_TRAIL_LABELS: Readonly<Record<FireworkTrail, string>> = Object.freeze({
  none: '无尾', comet: '彗尾', glitter: '碎金',
});

/** 点阵拼字位图：cells 为 base64 打包位（行优先，每字节低 bit 在前）。 */
export type FireworkPattern = { cols: number; rows: number; cells: string };

/**
 * v2 设计参数全部参与物理推导：
 * - caliber / liftCharge 决定升空速度；
 * - breakCharge 决定开爆半径；
 * - starCount / starSize / burnTime / trail 决定星体密度、尺寸、寿命与尾迹；
 * - height 是目标开爆高度，实际高度由装药与发射角推导。
 */
export type FireworkDesign = {
  v: 2;
  /** 目标开爆高度（世界 y，整数 24..90）。 */
  height: number;
  shape: FireworkShape;
  colors: { primary: string; secondary: string; trail: string };
  /** 开爆药质量（克，5..200）。 */
  breakCharge: number;
  /** 闪烁强度 0..100。 */
  sparkle: number;
  /** 弹体直径（毫米，50..300）。 */
  caliber: number;
  /** 发射药质量（克，10..300）。 */
  liftCharge: number;
  /** 偏离竖直方向的发射角（度，0..18）。 */
  launchAngle: number;
  /** 星体数量（40..600）。 */
  starCount: number;
  /** 星体直径（毫米，4..18）。 */
  starSize: number;
  /** 星体燃烧时间（秒，1..6）。 */
  burnTime: number;
  /** 星体尾迹类型。 */
  trail: FireworkTrail;
  pattern?: FireworkPattern;
};

export const PATTERN_COLS = 21;
export const PATTERN_ROWS = 21;

/** 弹径对应的推荐发射药（克）——150mm 约 68g。 */
export function recommendedLiftCharge(caliber: number): number {
  return Math.max(10, Math.round(caliber * caliber * 0.003));
}

/** 弹径对应的推荐开爆药（克）——150mm 约 29g。 */
export function recommendedBreakCharge(caliber: number): number {
  return Math.max(5, Math.round(caliber * caliber * 0.0013));
}

const HEX = /^#[0-9a-f]{6}$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

const isIntIn = (value: unknown, min: number, max: number): value is number =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

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
  v: 2,
  height: 52,
  shape: 'peony',
  colors: { primary: '#ffd76e', secondary: '#ff5f8a', trail: '#ffe9b0' },
  breakCharge: 29,
  sparkle: 35,
  caliber: 150,
  liftCharge: 68,
  launchAngle: 3,
  starCount: 300,
  starSize: 9,
  burnTime: 3,
  trail: 'comet',
});

function parsePattern(input: unknown): FireworkPattern | null {
  if (!input || typeof input !== 'object') return null;
  const { cols, rows, cells } = input as Partial<FireworkPattern>;
  if (!isIntIn(cols, 10, 26) || !isIntIn(rows, 10, 26) || typeof cells !== 'string') return null;
  if (!BASE64.test(cells)) return null;
  const total = cols * rows;
  let binary: string;
  try {
    binary = atob(cells);
  } catch {
    return null;
  }
  if (binary.length !== Math.ceil(total / 8)) return null;
  const bits: boolean[] = new Array(total).fill(false);
  for (let i = 0; i < total; i += 1) bits[i] = (binary.charCodeAt(i >> 3)! & (1 << (i & 7))) !== 0;
  const on = bits.filter(Boolean).length;
  if (on < 4 || on > Math.floor(total * 0.55)) return null;
  return { cols, rows, cells };
}

/** v1 旧设计 → v2：保留外观字段，把 size 百分比换算为开爆药。 */
function upgradeLegacyDesign(raw: Record<string, unknown>): FireworkDesign | null {
  if (!isIntIn(raw.size, 60, 160)) return null;
  const height = raw.height;
  const shape = raw.shape;
  const sparkle = raw.sparkle;
  if (!isIntIn(height, 24, 90) || typeof shape !== 'string' || !(FIREWORK_SHAPES as readonly string[]).includes(shape)) return null;
  if (!isIntIn(sparkle, 0, 100)) return null;
  const colors = raw.colors as Record<string, unknown> | undefined;
  if (!colors || !isHexColor(colors.primary) || !isHexColor(colors.secondary) || !isHexColor(colors.trail)) return null;
  const pattern = shape === 'pattern' ? parsePattern(raw.pattern) : null;
  if (shape === 'pattern' && !pattern) return null;
  const caliber = 150;
  const design: FireworkDesign = {
    v: 2,
    height,
    shape: shape as FireworkShape,
    colors: { primary: colors.primary, secondary: colors.secondary, trail: colors.trail },
    breakCharge: Math.max(5, Math.min(200, Math.round(recommendedBreakCharge(caliber) * (raw.size / 100) ** 2))),
    sparkle,
    caliber,
    liftCharge: recommendedLiftCharge(caliber),
    launchAngle: 0,
    starCount: 300,
    starSize: 9,
    burnTime: 3,
    trail: 'comet',
  };
  if (pattern) design.pattern = pattern;
  return design;
}

/** 校验并规范化任意版本的烟花设计；非法返回 null。 */
export function normalizeFireworkDesign(input: unknown): FireworkDesign | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const raw = input as Record<string, unknown>;
  if (raw.v === 1) return upgradeLegacyDesign(raw);
  if (raw.v !== 2) return null;
  if (!isIntIn(raw.height, 24, 90)) return null;
  if (typeof raw.shape !== 'string' || !(FIREWORK_SHAPES as readonly string[]).includes(raw.shape)) return null;
  const colors = raw.colors as Record<string, unknown> | undefined;
  if (!colors || !isHexColor(colors.primary) || !isHexColor(colors.secondary) || !isHexColor(colors.trail)) return null;
  if (!isIntIn(raw.breakCharge, 5, 200)) return null;
  if (!isIntIn(raw.sparkle, 0, 100)) return null;
  if (!isIntIn(raw.caliber, 50, 300)) return null;
  if (!isIntIn(raw.liftCharge, 10, 300)) return null;
  if (!isIntIn(raw.launchAngle, 0, 18)) return null;
  if (!isIntIn(raw.starCount, 40, 600)) return null;
  if (!isIntIn(raw.starSize, 4, 18)) return null;
  if (!isIntIn(raw.burnTime, 1, 6)) return null;
  if (typeof raw.trail !== 'string' || !(FIREWORK_TRAILS as readonly string[]).includes(raw.trail)) return null;
  const design: FireworkDesign = {
    v: 2,
    height: raw.height,
    shape: raw.shape as FireworkShape,
    colors: { primary: colors.primary, secondary: colors.secondary, trail: colors.trail },
    breakCharge: raw.breakCharge,
    sparkle: raw.sparkle,
    caliber: raw.caliber,
    liftCharge: raw.liftCharge,
    launchAngle: raw.launchAngle,
    starCount: raw.starCount,
    starSize: raw.starSize,
    burnTime: raw.burnTime,
    trail: raw.trail as FireworkTrail,
  };
  if (raw.shape === 'pattern') {
    const pattern = parsePattern(raw.pattern);
    if (!pattern) return null;
    design.pattern = pattern;
  }
  return design;
}

/** 客户端保存前的本地校验（与服务端 sanitizeFireworkDesign 同规则）。 */
export function validateFireworkDesign(design: FireworkDesign): string | null {
  if (design.v !== 2) return '烟花版本不受支持';
  if (!Number.isInteger(design.height) || design.height < 24 || design.height > 90) return '高度需在 24–90 之间';
  if (!FIREWORK_SHAPES.includes(design.shape)) return '花形不合法';
  if (!isHexColor(design.colors.primary) || !isHexColor(design.colors.secondary) || !isHexColor(design.colors.trail)) return '颜色格式不合法';
  if (!Number.isInteger(design.caliber) || design.caliber < 50 || design.caliber > 300) return '弹径需在 50–300 毫米之间';
  if (!Number.isInteger(design.liftCharge) || design.liftCharge < 10 || design.liftCharge > 300) return '发射药需在 10–300 克之间';
  if (!Number.isInteger(design.breakCharge) || design.breakCharge < 5 || design.breakCharge > 200) return '开爆药需在 5–200 克之间';
  if (!Number.isInteger(design.launchAngle) || design.launchAngle < 0 || design.launchAngle > 18) return '发射角需在 0–18 度之间';
  if (!Number.isInteger(design.starCount) || design.starCount < 40 || design.starCount > 600) return '星数需在 40–600 之间';
  if (!Number.isInteger(design.starSize) || design.starSize < 4 || design.starSize > 18) return '星体尺寸需在 4–18 毫米之间';
  if (!Number.isInteger(design.burnTime) || design.burnTime < 1 || design.burnTime > 6) return '燃烧时间需在 1–6 秒之间';
  if (!FIREWORK_TRAILS.includes(design.trail)) return '尾迹类型不合法';
  if (!Number.isInteger(design.sparkle) || design.sparkle < 0 || design.sparkle > 100) return '闪烁需在 0–100 之间';
  if (design.shape === 'pattern') {
    if (!design.pattern) return '拼字烟花需要点阵图案';
    const { cols, rows, cells } = design.pattern;
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 10 || cols > 26 || rows < 10 || rows > 26) return '点阵尺寸不合法';
    if (!BASE64.test(cells)) return '点阵数据不合法';
    const bits = decodePatternCells(design.pattern);
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
  /** 闪烁相位（确定性随机）。 */
  flickerPhase: number;
  /** 尾迹类型（由设计继承）。 */
  trail: FireworkTrail;
  /** 生命比例到达时四分裂（十字蕊）。 */
  splitAt?: number;
  /** 分裂后的初速（预先算好，保证预览与引擎一致）。 */
  splitV?: Vec3;
  /** 同一父星的分裂子星序号；0 在分裂前绘制父星，其余保持隐藏。 */
  splitChild?: number;
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

/** 世界坐标 → 相机广告牌平面坐标（2D 试放与 3D 投影保持一致）。 */
export function projectToBillboard(point: Vec3): { u: number; v: number } {
  return {
    u: point.x * RIGHT.x + point.y * RIGHT.y + point.z * RIGHT.z,
    v: point.x * UP.x + point.y * UP.y + point.z * UP.z,
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

type ShapeTuning = {
  life: number;
  drag: number;
  gravity: number;
  size: number;
  speedVar: number;
  yBias: number;
  count: number;
};

function tuningFor(design: FireworkDesign): ShapeTuning {
  const star = design.starCount;
  switch (design.shape) {
    case 'chrysanthemum': return { life: 1.25, drag: 0.65, gravity: 1.05, size: 1.1, speedVar: 0.5, yBias: 0, count: star };
    case 'willow': return { life: 1.5, drag: 0.32, gravity: 1.0, size: 1.2, speedVar: 0.38, yBias: 0.22, count: star };
    case 'palm': return { life: 1.3, drag: 0.55, gravity: 1.1, size: 1.5, speedVar: 0.35, yBias: 0.3, count: Math.round(star * 0.65) };
    case 'crackle': return { life: 0.55, drag: 1.8, gravity: 0.6, size: 0.85, speedVar: 0.8, yBias: 0, count: Math.round(star * 0.8) };
    case 'ring': return { life: 1.0, drag: 0.95, gravity: 0.5, size: 1.0, speedVar: 0.08, yBias: 0, count: star };
    case 'crossette': return { life: 1.0, drag: 0.9, gravity: 0.9, size: 1.2, speedVar: 0.3, yBias: 0, count: Math.round(star * 0.55) };
    case 'heart': return { life: 1.1, drag: 0.85, gravity: 0.5, size: 1.05, speedVar: 0.04, yBias: 0, count: star };
    case 'star': return { life: 1.1, drag: 0.85, gravity: 0.5, size: 1.05, speedVar: 0.04, yBias: 0, count: star };
    case 'pattern': return { life: 1.0, drag: 0.6, gravity: 0.03, size: 1.1, speedVar: 0.05, yBias: 0, count: star };
    case 'peony':
    default: return { life: 1.0, drag: 1.0, gravity: 1.0, size: 1.0, speedVar: 0.5, yBias: 0, count: star };
  }
}

/**
 * 生成一整朵烟花的粒子发射参数。`radius` 是目标爆炸半径（世界单位），
 * 由 `fireworksPhysics.burstRadius` 根据弹径与开爆药算出；阻力模型下
 * 初速 ≈ 半径 × drag，这样粒子停下时恰好铺满目标轮廓。
 */
export function buildBurstSeeds(design: FireworkDesign, radius: number): BurstSeed[] {
  const seeds: BurstSeed[] = [];
  const tuning = tuningFor(design);
  const sizeScale = Math.max(0.3, design.starSize / 9);
  const sparkleOn = design.sparkle >= 15;

  const pushStar = (vx: number, vy: number, vz: number, opts?: {
    life?: number; drag?: number; gravity?: number; size?: number; colorMix?: number;
    flicker?: boolean; splitAt?: number; splitV?: Vec3; splitChild?: number;
  }): BurstSeed => {
    const flicker = sparkleOn && rand() < design.sparkle / 100;
    const seed: BurstSeed = {
      vx, vy, vz,
      life: Math.max(0.5, (opts?.life ?? design.burnTime * tuning.life) * (0.9 + rand() * 0.2)),
      drag: opts?.drag ?? tuning.drag,
      gravity: opts?.gravity ?? tuning.gravity,
      size: (opts?.size ?? tuning.size) * sizeScale * (0.8 + rand() * 0.4),
      colorMix: opts?.colorMix ?? Math.max(0, Math.min(1, rand())),
      flicker,
      flickerPhase: rand() * Math.PI * 2,
      trail: design.trail,
      splitAt: opts?.splitAt,
      splitV: opts?.splitV,
      splitChild: opts?.splitChild,
    };
    seeds.push(seed);
    return seed;
  };

  const sphereBurst = (count: number): void => {
    for (let i = 0; i < count; i += 1) {
      const d = sphereDir();
      const y = d.y + tuning.yBias;
      const len = Math.hypot(d.x, y, d.z) || 1;
      const speed = radius * tuning.drag * (1 - tuning.speedVar / 2 + rand() * tuning.speedVar);
      pushStar((d.x / len) * speed, (y / len) * speed, (d.z / len) * speed);
    }
  };

  switch (design.shape) {
    case 'peony':
    case 'chrysanthemum':
    case 'willow':
    case 'crackle':
      sphereBurst(Math.max(1, tuning.count));
      break;
    case 'palm': {
      // 棕榈：少而粗的枝条，每条带一段下垂。
      const branches = Math.max(6, Math.round(tuning.count / 12));
      const perBranch = Math.max(1, Math.round(tuning.count / branches));
      for (let b = 0; b < branches; b += 1) {
        const dir = sphereDir();
        for (let i = 0; i < perBranch; i += 1) {
          const spread = 0.35;
          const speed = radius * tuning.drag * (0.75 + rand() * 0.3);
          pushStar(
            (dir.x + (rand() - 0.5) * spread) * speed,
            (dir.y + (rand() - 0.5) * spread * 0.5 + 0.12) * speed,
            (dir.z + (rand() - 0.5) * spread) * speed,
          );
        }
      }
      break;
    }
    case 'ring': {
      const ringCount = Math.max(20, Math.round(design.starCount * 0.8));
      for (let i = 0; i < ringCount; i += 1) {
        const t = (i / ringCount) * Math.PI * 2;
        const wobble = (rand() - 0.5) * 0.07;
        const v = plane(Math.cos(t), Math.sin(t), wobble);
        const speed = radius * tuning.drag * (1.02 + rand() * 0.04);
        pushStar(v.x * speed, v.y * speed, v.z * speed);
      }
      sphereBurst(Math.max(4, Math.round(design.starCount * 0.2)));
      break;
    }
    case 'crossette': {
      const parentCount = Math.max(10, Math.round(design.starCount / 4));
      for (let i = 0; i < parentCount; i += 1) {
        const d = sphereDir();
        const speed = radius * tuning.drag * (0.85 + rand() * 0.3);
        const splitSpeed = radius * 0.55;
        const reference = Math.abs(d.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
        const tangent = normalize(cross(d, reference));
        const bitangent = normalize(cross(d, tangent));
        const splitAt = 0.4 + rand() * 0.12;
        const directions = [
          tangent,
          { x: -tangent.x, y: -tangent.y, z: -tangent.z },
          bitangent,
          { x: -bitangent.x, y: -bitangent.y, z: -bitangent.z },
        ];
        const parent = pushStar(d.x * speed, d.y * speed, d.z * speed, {
          splitAt,
          splitChild: 0,
          splitV: { x: tangent.x * splitSpeed, y: tangent.y * splitSpeed, z: tangent.z * splitSpeed },
        });
        for (let child = 1; child < directions.length; child += 1) {
          const direction = directions[child]!;
          seeds.push({
            ...parent,
            splitChild: child,
            splitV: { x: direction.x * splitSpeed, y: direction.y * splitSpeed, z: direction.z * splitSpeed },
          });
        }
      }
      break;
    }
    case 'heart':
    case 'star': {
      const curve = design.shape === 'heart' ? HEART : STAR;
      const count = Math.max(20, tuning.count);
      for (let i = 0; i < count; i += 1) {
        const t = (i / count) * Math.PI * 2 + rand() * 0.02;
        const [cx, cy] = curve(t);
        const jitter = (rand() - 0.5) * 0.05;
        const v = plane(cx + jitter, cy + jitter * 0.7, (rand() - 0.5) * 0.05);
        const speed = radius * tuning.drag * 1.02;
        pushStar(v.x * speed, v.y * speed, v.z * speed);
      }
      break;
    }
    case 'pattern': {
      const pattern = design.pattern;
      if (!pattern) break;
      const bits = decodePatternCells(pattern);
      const { cols, rows } = pattern;
      const extent = radius * 2.3;
      const step = extent / cols;
      const cellRadius = extent / Math.max(cols, rows);
      const litCells = bits.reduce((count, on) => count + (on ? 1 : 0), 0);
      // 星数按点亮格均摊，单格最多 6 颗，避免大图案糊成实心块。
      const perCell = Math.max(1, Math.min(6, Math.floor(design.starCount / Math.max(1, litCells))));
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          if (!bits[row * cols + col]) continue;
          for (let n = 0; n < perCell; n += 1) {
            const u = (col - (cols - 1) / 2) * step + (rand() - 0.5) * step * 0.3;
            const v = ((rows - 1) / 2 - row) * step + (rand() - 0.5) * step * 0.3;
            const v3 = plane(u, v, (rand() - 0.5) * cellRadius * 0.4);
            pushStar(v3.x * tuning.drag, v3.y * tuning.drag, v3.z * tuning.drag, {
              life: Math.max(design.burnTime, 4) + rand() * 0.6,
              colorMix: rand() < 0.82 ? rand() * 0.3 : 0.6 + rand() * 0.4,
            });
          }
        }
      }
      break;
    }
  }
  return seeds;
}

/** 拼字烟花的基准半径（世界单位）——比球形烟花更大以保证可读性。 */
export const PATTERN_RADIUS_SCALE = 1.25;
