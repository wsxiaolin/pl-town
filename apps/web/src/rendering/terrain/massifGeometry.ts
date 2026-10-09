// massif 几何生成器：岚屏岭山脉的「形状层」（v5 从 mountainRanges.ts 拆出，
// 应对单文件 ≤1000 行的体积上限，也符合 AI review 建议的「形状生成与
// Three.js 网格组装分离」）。本文件只含纯函数与类型：
// - 确定性随机/噪声（mulberry32、格点哈希、周期 value noise、fBm）
// - lobe 高度场（单峰剖面 + 裂瓣底缘 + 山脊角谐波 + 多峰 max 融合）
// - 圆盘高度场 → non-indexed 折面网格（buildRadialFieldGeometry）
// 山体材质、麓原裙、碎石带、森林与装配见 mountainRanges.ts。
import * as THREE from 'three';

// 峰体基座埋入深度：底环永远在地表以下，不露缝隙。
export const BASE_BURY = 0.35;
// fBm 细节噪声格点密度：角向取整数格，噪声沿圆周周期延拓无缝。
// v5：网格密度翻倍后细节频率同步加密，折面才能显出细节。
export const DETAIL_ANGULAR_CELLS = 10;
export const DETAIL_RADIAL_CELLS = 6;

export type Vec2 = readonly [number, number];

export function hashString(text: string): number {
  // FNV-1a 32bit
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 旧抖动锥遗留的纯位置哈希噪声：松树锥面微抖动仍复用（确定性）。 */
export function hashNoise(angle: number, ring: number, seed: number): number {
  const value = Math.sin(angle * 127.1 + ring * 311.7 + seed * 74.7) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

// ── 确定性噪声工具（整数格点哈希 → 周期 value noise → fBm）───────────

/** 整数格点哈希，返回 [0,1)。同格点同种子永远同值。 */
export function latticeNoise(ix: number, iy: number, seed: number): number {
  let hash = (Math.imul(ix, 0x27d4eb2f) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return hash / 4294967296;
}

/** 二维 value noise；x 方向按 periodX 取模回绕，沿圆周采样时天然无缝。 */
export function valueNoise2(x: number, y: number, seed: number, periodX: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const x0 = ((ix % periodX) + periodX) % periodX;
  const x1 = (x0 + 1) % periodX;
  const n00 = latticeNoise(x0, iy, seed);
  const n10 = latticeNoise(x1, iy, seed);
  const n01 = latticeNoise(x0, iy + 1, seed);
  const n11 = latticeNoise(x1, iy + 1, seed);
  return (n00 * (1 - ux) + n10 * ux) * (1 - uy) + (n01 * (1 - ux) + n11 * ux) * uy;
}

/** 2~3 阶 fBm，返回约 [-1,1]。角向频率逐阶翻倍且保持整数周期。 */
export function fbm2(x: number, y: number, seed: number, periodX: number, octaves: number): number {
  let amplitude = 1;
  let sum = 0;
  let norm = 0;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * (valueNoise2(x * frequency, y * frequency, seed + octave * 40503, periodX * frequency) * 2 - 1);
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return sum / norm;
}

/** 角谐波（2/3/5/7 倍频正弦叠加，相位由种子哈希）：山脊折线的基底。
 * 7 倍频小项是 v5 加的：加密网格上显出细碎棱线，主脊不再光秃。 */
export function angularHarmonics(angle: number, seed: number): number {
  const phase2 = latticeNoise(101, 7, seed) * Math.PI * 2;
  const phase3 = latticeNoise(233, 13, seed) * Math.PI * 2;
  const phase5 = latticeNoise(701, 29, seed) * Math.PI * 2;
  const phase7 = latticeNoise(911, 41, seed) * Math.PI * 2;
  return 0.48 * Math.sin(angle * 2 + phase2)
    + 0.27 * Math.sin(angle * 3 + phase3)
    + 0.15 * Math.sin(angle * 5 + phase5)
    + 0.10 * Math.sin(angle * 7 + phase7);
}

/** 3..5 瓣低频角向轮廓噪声（约 ±1 归一化）：底盘裂瓣形底缘，永不圆/椭圆。 */
export function angularLobes(angle: number, seed: number): number {
  const phase3 = latticeNoise(37, 11, seed) * Math.PI * 2;
  const phase4 = latticeNoise(53, 19, seed) * Math.PI * 2;
  const phase5 = latticeNoise(97, 31, seed) * Math.PI * 2;
  return 0.5 * Math.sin(angle * 3 + phase3) + 0.32 * Math.sin(angle * 4 + phase4) + 0.18 * Math.sin(angle * 5 + phase5);
}

export function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

// ── 径向高度场 massif ───────────────────────────────────────────

/** 单个山体 lobe（主峰或双峰副瓣）。偏移/半径按主峰半径归一化。 */
export type MassifLobe = {
  offsetX: number;
  offsetZ: number;
  radius: number;
  heightFraction: number; // 相对 shape.height 的高度比
  k: number; // 峰型剖面指数（2.2..2.9，陡壁凹坡）
  elongAxis: number; // 拉伸轴方向（弧度）
  elongation: number; // 拉伸比 1.25..1.6（横轴收窄 1/拉伸比）
  leanAngle: number; // 迎坡不对称方向
  lean: number; // 迎坡拉伸量（0..0.12）
  silhouetteAmp: number; // 裂瓣底缘不规则度（0.2..0.3）
  silSeed: number;
  ridgeAmp: number; // 主脊角谐波幅度（0.12..0.18·h）
  ridgeSeed: number;
  ridgeAmp2: number; // 偏轴副脊幅度（0.05..0.09·h）
  crest2Shift: number; // 副脊相位偏移（离开主轴）
  crest2Seed: number;
};

export type MassifShape = {
  height: number;
  bury: number; // 底环 y（负值 = 埋地）
  detailAmp: number; // fBm 细节幅度（相对 height）
  detailSeed: number;
  main: MassifLobe;
  /** 副峰链（多峰 massif）：沿主峰拉伸轴偏移，逐点 max 融合。 */
  extraLobes: MassifLobe[];
};

/** lobe 在归一化坐标 (xn, zn) 处的高度占比（0..约1.2）。 */
export function lobeFraction(lobe: MassifLobe, xn: number, zn: number): number {
  const dx = xn - lobe.offsetX;
  const dz = zn - lobe.offsetZ;
  const rho = Math.hypot(dx, dz);
  const angle = Math.atan2(dz, dx);
  // 定向拉伸：沿 elongAxis 保持半径，垂直方向收窄 1/elongation——
  // 剪影读作岭链而非圆顶；包络仍被半径 r 完全包含（审计安全）。
  const delta = angle - lobe.elongAxis;
  const rhoElong = rho * Math.hypot(Math.cos(delta), Math.sin(delta) * lobe.elongation);
  // 裂瓣底缘：3..5 瓣低频角向噪声（±silhouetteAmp）。
  const silhouette = 1 + lobe.silhouetteAmp * angularLobes(angle, lobe.silSeed);
  const rhoN = rhoElong / silhouette;
  if (rhoN >= 1) return 0;
  // 迎坡方向剖面半径拉长 → 缓坡长脊；背坡收短 → 陡峭反坡（不对称 massif）。
  const stretched = rhoN / (1 + lobe.lean * Math.cos(angle - lobe.leanAngle));
  const profile = 1 - Math.pow(stretched, lobe.k);
  if (profile <= 0) return 0;
  // 双频山脊：主脊角谐波 + 偏轴副脊，折面投影成放射状棱线。
  const ridge = 1
    + lobe.ridgeAmp * angularHarmonics(angle, lobe.ridgeSeed)
    + lobe.ridgeAmp2 * angularHarmonics(angle + lobe.crest2Shift, lobe.crest2Seed);
  return profile * ridge;
}

/** massif 表面世界高度：多 lobe max 融合 + fBm 细节 + 底缘埋地过渡。 */
export function massifSurfaceY(shape: MassifShape, xn: number, zn: number): number {
  const rho = Math.min(Math.hypot(xn, zn), 1);
  let fraction = lobeFraction(shape.main, xn, zn);
  for (const lobe of shape.extraLobes) {
    const lobeFrac = lobeFraction(lobe, xn, zn) * lobe.heightFraction;
    if (lobeFrac > fraction) fraction = lobeFrac;
  }
  const angle = Math.atan2(zn, xn);
  const rimFade = 1 - smoothStep(0.72, 1, rho); // 近底缘细节渐隐，底环干净
  const detail = fbm2(
    (angle / (Math.PI * 2)) * DETAIL_ANGULAR_CELLS,
    rho * DETAIL_RADIAL_CELLS,
    shape.detailSeed,
    DETAIL_ANGULAR_CELLS,
    3,
  ) * shape.detailAmp * rimFade;
  const surfaced = Math.max(0, fraction + detail);
  const buryBlend = Math.pow(rho, 6); // 底环精确落在 bury，向内光滑过渡
  return shape.height * surfaced * (1 - buryBlend) + shape.bury * buryBlend;
}

// ── 圆盘高度场 → non-indexed 折面网格 ───────────────────────────

export type RadialFieldParams = {
  radius: number;
  rings: number;
  segments: number;
  /** 归一化平面轮廓（裂瓣底缘 + 拉伸包络的外接界），与表面函数共用谐波。 */
  planRadius: (angle: number) => number;
  /** 归一化坐标 (xn, zn) → 局部世界高度（含埋地）。 */
  surfaceY: (xn: number, zn: number) => number;
};

export function radialFieldVertex(params: RadialFieldParams, ring: number, segment: number, out: THREE.Vector3): void {
  if (ring <= 0) {
    out.set(0, params.surfaceY(0, 0), 0);
    return;
  }
  const rhoN = ring / params.rings;
  const angularOffset = ring % 2 === 0 ? 0 : 0.5; // 奇数环错开半扇区，棱面呈菱形交织
  const wrapped = ((segment % params.segments) + params.segments) % params.segments;
  const angle = ((wrapped + angularOffset) / params.segments) * Math.PI * 2;
  const radial = rhoN * params.radius * params.planRadius(angle);
  const x = Math.cos(angle) * radial;
  const z = Math.sin(angle) * radial;
  out.set(x, params.surfaceY(x / params.radius, z / params.radius), z);
}

/**
 * 圆盘高度场 → non-indexed 三角形网格。逐三角形直接发射顶点（不共享），
 * computeVertexNormals 得到真正的逐面法线：每个三角形都是一块干净棱面。
 */
export function buildRadialFieldGeometry(params: RadialFieldParams): THREE.BufferGeometry {
  const positions: number[] = [];
  const apex = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const d = new THREE.Vector3();
  const emit = (p: THREE.Vector3, q: THREE.Vector3, r: THREE.Vector3): void => {
    positions.push(p.x, p.y, p.z, q.x, q.y, q.z, r.x, r.y, r.z);
  };
  radialFieldVertex(params, 0, 0, apex);
  for (let segment = 0; segment < params.segments; segment += 1) {
    radialFieldVertex(params, 1, segment, a);
    radialFieldVertex(params, 1, segment + 1, b);
    emit(apex, b, a); // 中心扇面（绕向朝外）
  }
  for (let ring = 1; ring < params.rings; ring += 1) {
    for (let segment = 0; segment < params.segments; segment += 1) {
      radialFieldVertex(params, ring, segment, a);
      radialFieldVertex(params, ring, segment + 1, b);
      radialFieldVertex(params, ring + 1, segment, c);
      radialFieldVertex(params, ring + 1, segment + 1, d);
      emit(a, d, c); // 环间四边形 → 两三角形（绕向朝外）
      emit(a, b, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
