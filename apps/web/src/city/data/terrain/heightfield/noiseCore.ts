// 确定性噪声内核（noise core）——全域地形高度场的共享底层。
// 从 rendering/terrain/massifGeometry.ts 逐字平移（方案 docs/terrain-elevation-plan.md
// §2.1 / §10 T2）：函数体不变 = 山体/草甸/麓原等既有渲染的噪声值零漂移；
// massifGeometry.ts 改为 re-export 本文件，消费方 import 路径零改动。
//
// 本文件只含纯函数：无 Math.random、无 Date、无 Three.js/DOM——任何
// 输入在任意时刻求值结果完全一致（可单测、可跨进程复现）。
// 依赖方向（AGENTS.md）：data 层不 import rendering；本文件是
// heightfield/ 各场与 rendering/terrain/* 的共同上游。

/** FNV-1a 32bit 字符串哈希 → 无符号整数。 */
export function hashString(text: string): number {
  // FNV-1a 32bit
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 确定性伪随机序列：同种子同序列，散布/抖动复用。 */
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

/** Hermite smoothstep（C¹ 连续，值域 [0,1]，x 越界钳制）。 */
export function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 钳制到 [0,1]。 */
export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
