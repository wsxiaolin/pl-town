// 城外世界起伏场（world relief field）——可信地形改造 T2（方案 §4）。
// 聚合三类场，与台地平坦权重合成 terrainHeight（见 terrainHeight.ts）：
// - meadowRelief：城缘草甸正场（收编自 meadowField.ts，两瓣 max）；
// - riverValley：晨溪河谷下切场（负值河槽 + 谷缘微抬 shoulder）；
// - seaBedCut：西海海床下切场（负值，自带滩涂缓坡）。
//
// 聚合模型（方案 §2.2 的一个工程修正，论证见下）：
//   worldRelief = openWeight × meadowRelief + bedCut
//   bedCut = min(min(riverValley, 0), seaBedCut) + max(riverValley, 0)
//
// 为何负场不乘台地裙坡权重：晨溪贴着台地北缘（中心线 z≈-95..-99，
// 台地北界 z=-90）流过，若河谷下切被 14 宽裙坡乘法衰减，中游河床
// -0.85 会衰减为 -0.33，高于沿程水位 -0.45——形成「悬河」，直接违反
// 方案 §9.1 单测 4（河床必须低于水位 ≥ 0.05）。因此河谷/海床负场
// 各自带与台地缘的过渡剖面：
// - 河谷南翼（朝台地侧）过渡带终点钉在台地北缘 z=-90 处精确归 0
//   （带宽 = 台地缘到河槽南缘的实际距离；数学上欧氏距离 ≥ 轴向距离
//   保证台地内恒 0）；
// - 海床域严格 x < -75（台地西缘），滩涂缓坡从缘外自行展开。
// 台地平坦不变量由此两剖面 + openWeight 三方共同保证（单测覆盖）。
import { CHENXI_RIVER } from '../river-chenxi';
import { MINGLAN_ISLES } from '../sea-minglan';
import { meadowReliefAt } from './meadowField';
import { PLATEAU_MAIN, plateauFlat, distanceOutsidePlateau } from './plateauField';
import { fbm2, smoothStep } from './noiseCore';

// ---------------------------------------------------------------------------
// 河床纵剖面站表（方案 §4.2：源头/中游/河口三站，站间 smoothstep 插值）。
// waterY 同时是渲染层晨溪水面的沿程水位契约（T5 接线，方案 D6）。
// ---------------------------------------------------------------------------
interface RiverStation {
  /** 沿中心线归一化弧长（0=源头山泉，1=河口）。 */
  t: number;
  /** 河床（谷底）高度。 */
  bedY: number;
  /** 沿程水面高度（源头为洼地泉面，低于 0；河口汇入湾面 0.075 之下）。 */
  waterY: number;
  /** 中心线半宽（源头 1.6 → 河口 6.0 分段展宽，与渲染层同族规律）。 */
  halfWidth: number;
}

const RIVER_STATIONS: readonly RiverStation[] = [
  { t: 0, bedY: -0.45, waterY: -0.1, halfWidth: 1.6 },
  { t: 0.55, bedY: -0.85, waterY: -0.45, halfWidth: 4.0 },
  { t: 1, bedY: -0.285, waterY: 0.075, halfWidth: 6.0 },
];

/** 北翼湿岸带宽（河槽缘 → 岸缘抬升）。 */
const RIVER_BANK_W = 2;
/** 北翼谷坡带宽（岸缘 → 谷缘背景）。 */
const RIVER_VALLEY_SLOPE_W = 10;
/** 谷缘肩（shoulder）外沿衰减带宽。 */
const RIVER_SHOULDER_FADE_W = 6;
/** 谷缘微抬上限（方案 §4.2：shoulder ≤ +0.35，谷地读感）。 */
const RIVER_SHOULDER_MAX = 0.35;
/** 北翼湿岸相对河床的固定抬升（近水浅滩）。 */
const RIVER_BANK_LIFT = 0.3;
const RIVER_SHOULDER_SEED = 0x72697665; // 'rive'
/** 北缘封口起点 = 世界地面（220×220，±110）北缘线：河谷北翼越线会在
 *  缘线处与山体裙板平地（y=0）切出崖壁接缝；缘线以南 6u 内渐灭
 *  （mountainRanges.ts 裙板基面同源论证，方案 D7）。 */
const RIVER_NORTH_CLOSE_Z = -110;

/** 河床水位纵剖面的沿程插值（站间 smoothstep，t 越界钳制到端站）。 */
function riverStationValue(t: number): { bedY: number; waterY: number; halfWidth: number } {
  if (t <= RIVER_STATIONS[0]!.t) {
    const s = RIVER_STATIONS[0]!;
    return { bedY: s.bedY, waterY: s.waterY, halfWidth: s.halfWidth };
  }
  for (let index = 1; index < RIVER_STATIONS.length; index += 1) {
    const a = RIVER_STATIONS[index - 1]!;
    const b = RIVER_STATIONS[index]!;
    if (t <= b.t) {
      const k = smoothStep(a.t, b.t, t);
      return {
        bedY: a.bedY + (b.bedY - a.bedY) * k,
        waterY: a.waterY + (b.waterY - a.waterY) * k,
        halfWidth: a.halfWidth + (b.halfWidth - a.halfWidth) * k,
      };
    }
  }
  const s = RIVER_STATIONS[RIVER_STATIONS.length - 1]!;
  return { bedY: s.bedY, waterY: s.waterY, halfWidth: s.halfWidth };
}

/** 河中心线折线（自 CHENXI_RIVER 配置取 path，纯数据同源）。 */
const RIVER_PATH = (CHENXI_RIVER[0]!.path ?? []) as ReadonlyArray<readonly [number, number]>;
/** 折线总弧长（t 参数化的分母）。 */
const RIVER_TOTAL_LEN = RIVER_PATH.slice(1).reduce((sum, point, index) => {
  const prev = RIVER_PATH[index]!;
  return sum + Math.hypot(point[0] - prev[0], point[1] - prev[1]);
}, 0);

interface RiverHit {
  /** 到中心线的最近距离。 */
  d: number;
  /** 最近点的归一化弧长。 */
  t: number;
  /** 点在段的哪一侧：true = 南侧（z 大侧，朝台地）。 */
  southSide: boolean;
  /** 端帽衰减因子（1=河身；向两端延长方向渐灭到 0）。 */
  capFade: number;
}

/** 河端帽宽度：源头（山泉）与河口（没入西海）沿端向的渐灭带。 */
const RIVER_END_CAP_W = 6;

/**
 * 河中心线在给定 x 处的 z（折线 x 单调 64→-56，逐段线性插值；x 超
 * 出河范围时取最近端点的 z）。用于南翼过渡带宽的连续参数化——投影点
 * z 在最近段切换处会跳变，x 参数化则全程连续（段交界处两侧插值一致）。
 */
function riverCenterZ(x: number): number {
  for (let index = 1; index < RIVER_PATH.length; index += 1) {
    const a = RIVER_PATH[index - 1]!;
    const b = RIVER_PATH[index]!;
    if ((x - a[0]) * (x - b[0]) <= 0) {
      const k = (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * k;
    }
  }
  return x > RIVER_PATH[0]![0] ? RIVER_PATH[0]![1] : RIVER_PATH[RIVER_PATH.length - 1]![1];
}

/** 点到河折线的最近命中（全段扫描；折线仅 7 点，逐段投影足够快）。 */
function nearestRiverHit(x: number, z: number): RiverHit | null {
  if (RIVER_PATH.length < 2) return null;
  let best: RiverHit | null = null;
  let accLen = 0;
  for (let index = 1; index < RIVER_PATH.length; index += 1) {
    const a = RIVER_PATH[index - 1]!;
    const b = RIVER_PATH[index]!;
    const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const ux = (b[0] - a[0]) / segLen;
    const uz = (b[1] - a[1]) / segLen;
    const rel = Math.min(segLen, Math.max(0, (x - a[0]) * ux + (z - a[1]) * uz));
    const px = a[0] + ux * rel;
    const pz = a[1] + uz * rel;
    const d = Math.hypot(x - px, z - pz);
    if (best === null || d < best.d) {
      // 南侧（z 更大，朝台地）：折线整体近东西走向（|uz| ≤ 0.09），直接
      // 比较点与投影点的 z——与段方向无关（path 自东向西，叉积符号会
      // 随段方向翻转，曾在台地内造成 shoulder 尾巴泄漏，故弃用）。
      // 端帽：点越过首/末折点进入延长方向时，剖面沿端向渐灭（源头
      // 山泉渐隐、河口没入西海——湾面悬平地的读感即来自此处归零）。
      let capFade = 1;
      if (index === 1 && rel <= 0) {
        const along = (a[0] - x) * ux + (a[1] - z) * uz; // 与段向反号的投影
        if (along > 0) capFade = 1 - smoothStep(0, RIVER_END_CAP_W, along);
      } else if (index === RIVER_PATH.length - 1 && rel >= segLen) {
        const along = (x - b[0]) * ux + (z - b[1]) * uz;
        if (along > 0) capFade = 1 - smoothStep(0, RIVER_END_CAP_W, along);
      }
      best = { d, t: (accLen + rel) / RIVER_TOTAL_LEN, southSide: z - pz > 0, capFade };
    }
    accLen += segLen;
  }
  return best;
}

/**
 * 晨溪河谷场（方案 §4.2）：
 * - 河槽（d ≤ 半宽）：河床 bedY(t)（纵剖面插值）；
 * - 北翼：湿岸带（半宽+2，bedY → bedY+0.3）→ 谷坡（+10，→ 谷缘肩）→
 *   肩外沿衰减（+6 → 0）；谷缘肩 shoulder ≤ +0.35，fBm 确定性调制；
 * - 南翼（朝台地）：过渡带终点钉在台地北缘（z = PLATEAU_MAIN.z0），
 *   从河床线性抬到 0——保证台地内恒 0（欧氏距离 ≥ 轴向距离）；若河
 *   远离台地则退化为与北翼同款的完整剖面。
 * 台地内严格返回 0；域外（谷缘肩外沿之外）返回 0。
 */
export function riverValleyAt(x: number, z: number): number {
  // 台地北缘安全门：折线各段 z ∈ [-99,-95] 的弯曲段会让「最近点」偏离
  // 查询点所在 x 处的中心线，轴向过渡带宽（southEdge 按 riverCenterZ(x)
  // 参数化）对斜向最近点失效——实测 z=-90 缘线上残留最深 -0.077 的
  // 泄漏（60 个网格点），违反「台地内严格 0」红线。此门在缘线以北
  // 0.3 宽 smoothstep 内把南翼贡献精确归 0：缘线上严格 0，0.3 外全值，
  // 连续无跳变（0.1 步长增量 ≤ 0.04，远低于 §9.1 连续性预算）。
  const plateauGate = 1 - smoothStep(PLATEAU_MAIN.z0 - 0.3, PLATEAU_MAIN.z0, z);
  // 北缘封口（世界设计，T3 接缝论证）：世界地面（220×220）北缘 z=-110
  // 之外是山体裙板平地（y=0），河谷北翼若越过缘线会在接缝处切出崖壁。
  // 河谷在缘线以南 6u 内渐灭——谷地自然收拢于溪北丘前的缓平原。
  const northGate = smoothStep(RIVER_NORTH_CLOSE_Z, RIVER_NORTH_CLOSE_Z + 6, z);
  const gate = plateauGate * northGate;
  if (gate <= 0) return 0;
  const raw = riverValleyProfileAt(x, z);
  return gate < 1 ? raw * gate : raw;
}

function riverValleyProfileAt(x: number, z: number): number {
  const hit = nearestRiverHit(x, z);
  if (hit === null) return 0;
  const { bedY, halfWidth } = riverStationValue(hit.t);
  const d = hit.d;
  if (hit.capFade <= 0) return 0;
  if (d <= halfWidth) return bedY * hit.capFade;

  const bankY = bedY + RIVER_BANK_LIFT;
  const slopeEnd = halfWidth + RIVER_BANK_W + RIVER_VALLEY_SLOPE_W;
  if (!hit.southSide) {
    // 北翼：湿岸 → 谷坡 → 谷缘肩 → 肩外沿归 0（端帽区整体乘 capFade）。
    if (d <= halfWidth + RIVER_BANK_W) {
      const k = smoothStep(halfWidth, halfWidth + RIVER_BANK_W, d);
      return (bedY + RIVER_BANK_LIFT * k) * hit.capFade;
    }
    const shoulderNoise = fbm2(x * 0.07, z * 0.07, RIVER_SHOULDER_SEED, 8192, 2) * 0.5 + 0.5;
    const shoulderY = RIVER_SHOULDER_MAX * (0.55 + 0.45 * shoulderNoise);
    if (d <= slopeEnd) {
      const k = smoothStep(halfWidth + RIVER_BANK_W, slopeEnd, d);
      return (bankY + (shoulderY - bankY) * k) * hit.capFade;
    }
    const fadeEnd = slopeEnd + RIVER_SHOULDER_FADE_W;
    if (d <= fadeEnd) return shoulderY * (1 - smoothStep(slopeEnd, fadeEnd, d)) * hit.capFade;
    return 0;
  }

  // 南翼（朝台地）：完整剖面若放得下，否则压缩为钉在台地缘的线性坡。
  // 过渡带宽用 x 参数化的中心线 z（riverCenterZ）——连续，无段切换跳变。
  const southEdge = PLATEAU_MAIN.z0 - riverCenterZ(x); // 河中心线到台地北缘的距离
  if (slopeEnd + RIVER_SHOULDER_FADE_W <= southEdge) {
    if (d <= halfWidth + RIVER_BANK_W) {
      const k = smoothStep(halfWidth, halfWidth + RIVER_BANK_W, d);
      return (bedY + RIVER_BANK_LIFT * k) * hit.capFade;
    }
    const shoulderNoise = fbm2(x * 0.07, z * 0.07, RIVER_SHOULDER_SEED, 8192, 2) * 0.5 + 0.5;
    const shoulderY = RIVER_SHOULDER_MAX * (0.55 + 0.45 * shoulderNoise);
    if (d <= slopeEnd) {
      const k = smoothStep(halfWidth + RIVER_BANK_W, slopeEnd, d);
      return (bankY + (shoulderY - bankY) * k) * hit.capFade;
    }
    const fadeEnd = slopeEnd + RIVER_SHOULDER_FADE_W;
    if (d <= fadeEnd) return shoulderY * (1 - smoothStep(slopeEnd, fadeEnd, d)) * hit.capFade;
    return 0;
  }
  // 压缩剖面：湿岸照常 2 宽，剩余距离线性抬到台地缘 0。
  if (d <= halfWidth + RIVER_BANK_W) {
    const k = smoothStep(halfWidth, halfWidth + RIVER_BANK_W, d);
    return (bedY + RIVER_BANK_LIFT * k) * hit.capFade;
  }
  const rampEnd = Math.max(halfWidth + RIVER_BANK_W, southEdge);
  if (d < rampEnd) {
    const k = (d - (halfWidth + RIVER_BANK_W)) / Math.max(1e-6, rampEnd - (halfWidth + RIVER_BANK_W));
    return bankY * (1 - k) * hit.capFade;
  }
  return 0;
}

/**
 * 晨溪沿程水面高度（方案 §4.2 水位表）。水道及湿岸带（d ≤ 半宽+2）
 * 内返回插值水位，域外返回 null（调用方自行处理非河区）。
 */
export function riverWaterYAt(x: number, z: number): number | null {
  const hit = nearestRiverHit(x, z);
  if (hit === null) return null;
  const { waterY, halfWidth } = riverStationValue(hit.t);
  if (hit.d > halfWidth + RIVER_BANK_W) return null;
  return waterY;
}

// ---------------------------------------------------------------------------
// 西海海床（方案 §4.3）：域 x < -75、z ∈ [-112,112]；深度剖面
// 滩涂缓坡（0→-0.9, 11 宽）→ 渐深（→-2.0）→ 深水 fBm（-2.0..-2.6）；
// 岛基保护区（明澜岛屿/岬角包围盒外扩 3 + 12 宽软过渡）钳制 ≥ -0.7
// （岛底 -0.6 埋入），过渡带从浅滩向深海渐变（无硬边界跳变）。
// ---------------------------------------------------------------------------
const SEABED_MIN_X = -75;
const SEABED_Z0 = -112;
const SEABED_Z1 = 112;
const SEABED_EDGE_FADE = 8;
const SEABED_ISLAND_MARGIN = 3;
// 软过渡带宽：钳制差最大 2.6-0.7=1.9，smoothstep 峰值斜率 1.5×1.9/12
// ≈ 0.24/unit → 2u 采样步 |Δh| ≤ 0.48 < 0.5（方案 §9.1 连续性阈值）。
const SEABED_KEEPOUT_FADE = 12;
const SEABED_SHALLOW_CAP = 0.7;
const SEABED_SEED = 0x73656162; // 'seab'

/** 明澜岛基保护区盒（island/mountain 条目包围盒外扩 3，预计算）。 */
const SEABED_KEEPOUTS: ReadonlyArray<{ x0: number; x1: number; z0: number; z1: number }> = MINGLAN_ISLES
  .filter((feature) => feature.kind === 'island' || feature.kind === 'mountain')
  .map((feature) => {
    const w = (feature.width ?? 20) / 2;
    const d = (feature.depth ?? feature.width ?? 20) / 2;
    return {
      x0: (feature.x ?? 0) - w - SEABED_ISLAND_MARGIN,
      x1: (feature.x ?? 0) + w + SEABED_ISLAND_MARGIN,
      z0: (feature.z ?? 0) - d - SEABED_ISLAND_MARGIN,
      z1: (feature.z ?? 0) + d + SEABED_ISLAND_MARGIN,
    };
  });

/** 点到盒的有向外距（盒内为 0）。 */
function outsideBoxDistance(x: number, z: number, box: { x0: number; x1: number; z0: number; z1: number }): number {
  const dx = Math.max(box.x0 - x, 0, x - box.x1);
  const dz = Math.max(box.z0 - z, 0, z - box.z1);
  return Math.hypot(dx, dz);
}

/** 西海海床下切场（≤ 0）：域外（含整个台地）为 0。 */
export function seaBedCutAt(x: number, z: number): number {
  if (x >= SEABED_MIN_X || z <= SEABED_Z0 || z >= SEABED_Z1) return 0;
  // 深度剖面（西向单调渐深 + 深水 fBm）。
  let depth: number;
  if (x >= -86) depth = 0.9 * smoothStep(SEABED_MIN_X, -86, x);
  else if (x >= -100) depth = 0.9 + 1.1 * smoothStep(-86, -100, x);
  else {
    const noise = fbm2(x * 0.045, z * 0.045, SEABED_SEED, 8192, 3);
    depth = 2.3 + 0.3 * noise;
  }
  // 岛基保护区：浅滩钳制（岛底 -0.6 埋入 ≥ -0.7 的床），12 宽软过渡
  // （取最近保护盒的外距做混合因子；盒重叠时取最深钳制后统一过渡）。
  let shallowest = depth;
  let nearestDist = Infinity;
  for (const box of SEABED_KEEPOUTS) {
    const dist = outsideBoxDistance(x, z, box);
    if (dist < nearestDist) {
      nearestDist = dist;
      shallowest = Math.min(depth, SEABED_SHALLOW_CAP);
    }
  }
  if (nearestDist < SEABED_KEEPOUT_FADE) {
    const blend = smoothStep(0, SEABED_KEEPOUT_FADE, nearestDist);
    depth = shallowest * (1 - blend) + depth * blend;
  }
  // 域边缘（z 向）平滑归 0，保证与背景 0 无跳变。
  depth *= smoothStep(SEABED_Z0, SEABED_Z0 + SEABED_EDGE_FADE, z);
  depth *= 1 - smoothStep(SEABED_Z1 - SEABED_EDGE_FADE, SEABED_Z1, z);
  return -depth;
}

// ---------------------------------------------------------------------------
// 出城步道（南草甸观景步道）切槽 —— 方案 §5.3 / D5（切槽压平，T4 落位）。
//
// 走向（方案定稿节点表）：S1 主城南出口外 → S2 → S3 裙坡中段 → S4 观景
// 平台。槽床纵剖面不取方案草图的单调 smoothstep 直坡（0→≈2.4）：实测
// 裙坡自然坡 ~13.6%（z 78→92 抬 ~1.9），直坡剖面会在裙坡段架空出 ~1.3
// 高的填方堤、在上段切深 ~0.5，均超 §9.1 连续性 b 预算。改为工程化的
// 「坡度受限贴面纵剖」：沿中心线 0.5 步长采样自然场，双向 clamp 钳制
// |纵坡| ≤ TRAIL_MAX_GRADE（前向从 S1 出发、端点钉在 S4 自然高程后回
// 向收紧）——切/填有界（实测 ≤ ~0.5），槽床始终贴着草甸面爬升。
// 槽内横向恒平（床高只依赖弧长）；两侧 TRAIL_BLEND_W 融合坡回自然场；
// S4 观景平台半径 TRAIL_PLATFORM_R 压平在终点高程（与所在草甸面齐平）。
// ---------------------------------------------------------------------------
export const TRAIL_NODES = [
  { x: 6, z: 44 },   // S1 主城南出口外（台地内，床高 0，与主城路面层直接相接）
  { x: 18, z: 66 },  // S2 裙坡前草坡
  { x: 30, z: 86 },  // S3 裙坡中段
  { x: 34, z: 96 },  // S4 观景平台（压平半径 3）
] as const;
/** 槽半宽：路宽 2.4（方案 §5.3）。 */
export const TRAIL_SLOT_HALF = 1.2;
/** 两侧融合坡宽（方案 3.0 → 4.5：走廊邻域草甸 2u 基线实测 ~0.66，需给连续性 b 预算留余量）。 */
export const TRAIL_BLEND_W = 4.5;
/** S4 观景平台压平半径（方案 §5.3）。 */
export const TRAIL_PLATFORM_R = 3;
/** 槽床纵坡上限（方案预算 ≤ 8%，取 7% 留余量）。 */
export const TRAIL_MAX_GRADE = 0.07;
/** 槽床台地缘渐显宽：中心线越出台地后床高在 2u 内渐显（对角泄漏保险）。 */
const TRAIL_PLATEAU_FADE_W = 2;

interface TrailSegment {
  readonly ax: number; readonly az: number;
  readonly ux: number; readonly uz: number;
  readonly len: number;
  readonly acc: number; // 段起点累计弧长
}

const TRAIL_SEGMENTS: readonly TrailSegment[] = (() => {
  let acc = 0;
  return TRAIL_NODES.slice(1).map((node, index) => {
    const a = TRAIL_NODES[index]!;
    const len = Math.hypot(node.x - a.x, node.z - a.z);
    const segment: TrailSegment = { ax: a.x, az: a.z, ux: (node.x - a.x) / len, uz: (node.z - a.z) / len, len, acc };
    acc += len;
    return segment;
  });
})();
/** 折线总弧长。 */
export const TRAIL_TOTAL_LENGTH = TRAIL_SEGMENTS.reduce((sum, s) => sum + s.len, 0);

/** 走廊包围盒（槽半宽+融合坡与平台外扩，含余量；域外免算折线投影）。 */
const TRAIL_BBOX = { x0: 0, x1: 42, z0: 36, z1: 106 };

function nearestTrailHit(x: number, z: number): { dist: number; s: number } | null {
  if (x < TRAIL_BBOX.x0 || x > TRAIL_BBOX.x1 || z < TRAIL_BBOX.z0 || z > TRAIL_BBOX.z1) return null;
  let bestDist = Infinity;
  let bestS = 0;
  for (const segment of TRAIL_SEGMENTS) {
    const rel = Math.min(segment.len, Math.max(0, (x - segment.ax) * segment.ux + (z - segment.az) * segment.uz));
    const px = segment.ax + segment.ux * rel;
    const pz = segment.az + segment.uz * rel;
    const d = Math.hypot(x - px, z - pz);
    if (d < bestDist) {
      bestDist = d;
      bestS = segment.acc + rel;
    }
  }
  return { dist: bestDist, s: bestS };
}

/** 未切槽自然场（terrainHeight 的聚合公式去掉步道项；床表与切槽混合共用）。 */
function naturalWorldReliefAt(x: number, z: number): number {
  const openWeight = 1 - plateauFlat(x, z);
  const meadow = meadowReliefAt(x, z);
  const valley = riverValleyAt(x, z);
  const bedCut = Math.min(Math.min(valley, 0), seaBedCutAt(x, z)) + Math.max(valley, 0);
  return openWeight * meadow + bedCut;
}

const TRAIL_SAMPLE_STEP = 0.5;
const TRAIL_SAMPLE_COUNT = Math.ceil(TRAIL_TOTAL_LENGTH / TRAIL_SAMPLE_STEP);

/** 槽床纵剖面采样表（模块初始化时按未切槽场构建，纯函数确定性）。 */
const TRAIL_BED: readonly number[] = (() => {
  const natural = new Array<number>(TRAIL_SAMPLE_COUNT + 1);
  const plateauFade = new Array<number>(TRAIL_SAMPLE_COUNT + 1);
  for (let i = 0; i <= TRAIL_SAMPLE_COUNT; i += 1) {
    const s = Math.min(TRAIL_TOTAL_LENGTH, i * TRAIL_SAMPLE_STEP);
    const hit = nearestTrailHitOnCenterline(s);
    natural[i] = naturalWorldReliefAt(hit.x, hit.z);
    // 台地缘渐显保险：中心线斜穿台地边界时，域外弧段的床高会把台地内
    // 的投影点拉上床（对角泄漏，单测「台地主盒严格为 0」曾捕获 0.0031
    // 级残差）。床高乘中心线台地外距离的 2u 渐显——台地内严格 0。
    plateauFade[i] = smoothStep(0, TRAIL_PLATEAU_FADE_W, distanceOutsidePlateau(hit.x, hit.z));
  }
  const grade = TRAIL_MAX_GRADE * TRAIL_SAMPLE_STEP;
  const bed = new Array<number>(TRAIL_SAMPLE_COUNT + 1);
  bed[0] = 0; // S1 在台地内（自然场 0，槽床归 0）
  for (let i = 1; i <= TRAIL_SAMPLE_COUNT; i += 1) {
    // 前向双侧级差限制：床贴自然场（缓坡段床=自然，陡坡段滞后成切槽），
    // 每采样步 ±grade。不做 S4 硬钉与回扫——级差不可达时 S4 平台即
    // 「草甸起伏内的压平切台」（方案 §5.3 观景平台语义，实测低于自然
    // 峰 ≈0.35），且回扫会把终点高程沿纵坡倒拉进台地（台地平坦红线）。
    const clamped = Math.min(bed[i - 1]! + grade, Math.max(bed[i - 1]! - grade, natural[i]!));
    bed[i] = clamped * plateauFade[i]!;
  }
  return bed;
})();

/** S4 槽床高程（= 未切槽自然场在 S4 的高，观景平台面）。 */
export const TRAIL_END_ELEV: number = TRAIL_BED[TRAIL_BED.length - 1]!;

/** 中心线上弧长 s 处的坐标（床表采样专用）。 */
function nearestTrailHitOnCenterline(s: number): { x: number; z: number } {
  const clamped = Math.min(TRAIL_TOTAL_LENGTH, Math.max(0, s));
  for (const segment of TRAIL_SEGMENTS) {
    if (clamped <= segment.acc + segment.len || segment === TRAIL_SEGMENTS[TRAIL_SEGMENTS.length - 1]) {
      const rel = clamped - segment.acc;
      return { x: segment.ax + segment.ux * rel, z: segment.az + segment.uz * rel };
    }
  }
  const last = TRAIL_SEGMENTS[TRAIL_SEGMENTS.length - 1]!;
  return { x: last.ax + last.ux * last.len, z: last.az + last.uz * last.len };
}

/** 槽床纵剖面（弧长线性插值；槽内横向恒平由混合权重保证）。 */
function trailBedAt(s: number): number {
  const clamped = Math.min(TRAIL_TOTAL_LENGTH, Math.max(0, s));
  const fi = clamped / TRAIL_SAMPLE_STEP;
  const i = Math.min(TRAIL_SAMPLE_COUNT - 1, Math.floor(fi));
  const k = fi - i;
  return TRAIL_BED[i]! * (1 - k) + TRAIL_BED[i + 1]! * k;
}

/**
 * 步道切槽权重（0..1）：槽内/平台为 1，融合坡内平滑衰减，域外 0。
 * 供渲染层装饰剔除（cityGround 草甸散布避让路面）与单测消费。
 */
export function trailCutAt(x: number, z: number): number {
  const hit = nearestTrailHit(x, z);
  const s4 = TRAIL_NODES[TRAIL_NODES.length - 1]!;
  const platform = 1 - smoothStep(TRAIL_PLATFORM_R, TRAIL_PLATFORM_R + TRAIL_BLEND_W, Math.hypot(x - s4.x, z - s4.z));
  if (hit === null) return platform;
  const corridor = 1 - smoothStep(TRAIL_SLOT_HALF, TRAIL_SLOT_HALF + TRAIL_BLEND_W, hit.dist);
  return Math.max(corridor, platform);
}

/**
 * 城外世界起伏场（terrainHeight 的主体实现，含台地平坦压制与步道切槽）：
 *   = trailCutBlend(openWeight × meadowRelief + bedCut)
 * - bedCut = min(min(riverValley, 0), seaBedCut) + max(riverValley, 0)：
 *   min 支路水域区取更深者（河口拦门沙等重叠区，方案 §2.2）；max 支路
 *   谷缘肩（正值微抬）不参与 min，避免被海床 0 吃掉；
 * - trailCutBlend：槽内取纵剖面床（横向恒平），融合坡回自然场，平台床
 *   高钉 TRAIL_END_ELEV（走廊/平台双权重按加权和混合床高，全域连续）。
 * 台地内自然项与床表同时为 0 → 严格平坦（含 S1 槽段，单测覆盖）。
 */
export function worldReliefAt(x: number, z: number): number {
  const natural = naturalWorldReliefAt(x, z);
  const hit = nearestTrailHit(x, z);
  const s4 = TRAIL_NODES[TRAIL_NODES.length - 1]!;
  const platformW = 1 - smoothStep(TRAIL_PLATFORM_R, TRAIL_PLATFORM_R + TRAIL_BLEND_W, Math.hypot(x - s4.x, z - s4.z));
  const corridorW = hit === null ? 0 : 1 - smoothStep(TRAIL_SLOT_HALF, TRAIL_SLOT_HALF + TRAIL_BLEND_W, hit.dist);
  const wSum = corridorW + platformW;
  if (wSum <= 0) return natural;
  const bed = (corridorW * (hit === null ? TRAIL_END_ELEV : trailBedAt(hit.s)) + platformW * TRAIL_END_ELEV) / wSum;
  const w = Math.max(corridorW, platformW);
  // 采样点台地门（R3 红①）：TRAIL_BED 的台地渐显按「垂足」预烘焙（见
  // plateauFade 注释），但走廊 S2→S3 段斜穿台地南缘 z=78 时，台地内的
  // 采样点会把垂足投到缘线外的弧段上、拿到台外床值——缘线上 25 点泄漏
  // （(27,78)=0.0056、(28,78)=0.021）。此门按采样点自身的台地外距离
  // 渐显床贡献：台地内（含缘线本身）床项严格归 0。与垂足门的双重衰减
  // 只落在缘线外 2u 带（该带床值 ≤ ~0.15，本就是刚从 0 爬起的床头），
  // 每 0.1 步床贡献增量 ≤ 0.15 × smoothstep 最大斜率 0.75 × 0.1 ≈ 0.011，
  // 远低于连续性 c 的 0.12 预算（实测见单测「台地南缘 z=78」扫描）。
  const plateauGate = smoothStep(0, TRAIL_PLATEAU_FADE_W, distanceOutsidePlateau(x, z));
  return bed * plateauGate * w + natural * (1 - w);
}
