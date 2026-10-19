// 城外起伏场：聚合草甸、共享河流剖面、西海海床和南北步道切槽。
// riverField 提供源头水位 0.5 单调下降、床深 0.5 的河槽及岸坡；
// 海床域 x < -75，各场在城区台地归零。北侧山体由独立连续山体场生成。
import { riverValleyAt } from './riverField';
export { riverValleyAt, riverWaterYAt } from './riverField';
import { MINGLAN_ISLES } from '../sea-minglan';
import { islandSurfaceYAt } from './islandField';
import { meadowReliefAt } from './meadowField';
import { plateauFlat, distanceOutsidePlateau } from './plateauField';
import { bridgeDeckBlendAt, stationPadBlendAt } from './transitField';
import { fbm2, smoothStep } from './noiseCore';

/**
 * 滩面贴场抬升（westBeach 沙/浪条带顶点采样用，采样值 + 0.07 = 沙面终高）：
 * 平滩（无切割）返回 0——与旧绝对层全等；滩带内有河道/河口湾/海床切割时，
 * 沙面随切下潜且间隔随深度自适应加宽（0.07 → 0.18）。
 * v9 修复（2026-10-12，sin「入海口水漫出来 + 不规则几何图形」复现定位）：
 * 沙带原只采 seaBedCutAt，一条平沙坝（y 0.07）横在河口湾水道上——湾面
 * 0.08 与沙坝仅 0.01 间隔，掠射角整湾闪烁（同机位帧差 2.7 万像素）。
 * 首版恒定 0.07 间隔随切失败：粗沙网格（8×96，z 步 2.3u）与细 farGround
 * （77×66）对同一弯曲场各自线性插值，坡度曲率发散 ~0.07 与间隔同阶，
 * 互穿更烈（复测 8.9 万像素）。间隔加深区抬到 0.18 > 发散上界后脱开。
 */
export function shoreSandLiftAt(x: number, z: number): number {
  const cut = Math.min(0, seaBedCutAt(x, z), riverValleyAt(x, z));
  return cut + (0.18 - 0.07) * smoothStep(0, 0.35, -cut);
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
// 出城步道切槽系统（v9 双走廊）——方案 §5.3 / D5 + sin 2026-10-11「山要
// 修路、可探索」：南线（既有，南草甸观景步道）+ 北线（晨溪谷地观景道，
// 从台地东北缘下到溪口丘/溪北丘之间的谷地走廊，观晨溪河口湾与北山墙）。
//
// 走向（节点表）：南线 S1 主城南出口外 → S2 → S3 裙坡中段 → S4 观景平台；
// 北线 N1 台地东北缘（北城 keep-out 东侧）→ N2 北裙坡中段 → N3 谷地草甸
// → N4 溪口观景平台（v1/v5 侧丘之间的无水走廊 x 47..76，东避河口湾
// RIVER_X_RANGE 东缘 66、西避 v1 包围盒）。槽床纵剖面统一走「坡度受限
// 贴面纵剖」：沿中心线 0.5 步长采样自然场，双向 clamp 钳制 |纵坡| ≤
// TRAIL_MAX_GRADE——切/填有界，槽床始终贴着草甸面爬升/下行。
// 槽内横向恒平（床高只依赖弧长）；两侧 TRAIL_BLEND_W 融合坡回自然场；
// 末端观景平台压平半径 TRAIL_PLATFORM_R（与所在草甸面齐平）。
// ---------------------------------------------------------------------------
export const SOUTH_TRAIL_NODES = [
  { x: 6, z: 44 },   // S1 主城南出口外（台地内，床高 0，与主城路面层直接相接）
  { x: 18, z: 66 },  // S2 裙坡前草坡
  { x: 30, z: 86 },  // S3 裙坡中段
  { x: 34, z: 96 },  // S4 观景平台（压平半径 3）
] as const;

export const NORTH_TRAIL_NODES = [
  { x: 70, z: -86 },  // N1 台地东北缘（北城 keep-out x≤41 东侧，台地内床高 0）
  { x: 73, z: -96 },  // N2 北裙坡中段（距晨溪源头 (64,-95) ≥8u，不扰源头河床快照）
  { x: 74, z: -106 }, // N3 谷地草甸（河口湾水域以东 x>66）
  { x: 74, z: -113 }, // N4 溪口观景平台（v1/v5 侧丘走廊，压平半径 3）
] as const;

/** 槽半宽：路宽 2.4（方案 §5.3）。 */
export const TRAIL_SLOT_HALF = 1.2;
/** 两侧融合坡宽（方案 3.0 → 4.5：走廊邻域草甸 2u 基线实测 ~0.66，需给连续性 b 预算留余量）。 */
export const TRAIL_BLEND_W = 4.5;
/** 观景平台压平半径（方案 §5.3）。 */
export const TRAIL_PLATFORM_R = 3;
/** 槽床纵坡上限（方案预算 ≤ 8%，取 7% 留余量）。 */
export const TRAIL_MAX_GRADE = 0.07;
/** 槽床台地缘渐显宽：中心线越出台地后床高在 2u 内渐显（对角泄漏保险）。 */
const TRAIL_PLATEAU_FADE_W = 2;
const TRAIL_SAMPLE_STEP = 0.5;

interface TrailSegment {
  readonly ax: number; readonly az: number;
  readonly ux: number; readonly uz: number;
  readonly len: number;
  readonly acc: number; // 段起点累计弧长
}

/** 一条步道走廊：节点折线 + 段表 + 走廊包围盒 + 床表（模块初始化构建）。 */
interface TrailCorridor {
  readonly id: 'south' | 'north';
  readonly nodes: ReadonlyArray<{ readonly x: number; readonly z: number }>;
  readonly segments: readonly TrailSegment[];
  readonly totalLength: number;
  readonly bbox: { x0: number; x1: number; z0: number; z1: number };
  readonly sampleCount: number;
  readonly bed: readonly number[];
  readonly end: { readonly x: number; readonly z: number };
  readonly endElev: number;
}

function buildTrailCorridor(id: TrailCorridor['id'], nodes: ReadonlyArray<{ readonly x: number; readonly z: number }>): TrailCorridor {
  let acc = 0;
  const segments = nodes.slice(1).map((node, index) => {
    const a = nodes[index]!;
    const len = Math.hypot(node.x - a.x, node.z - a.z);
    const segment: TrailSegment = { ax: a.x, az: a.z, ux: (node.x - a.x) / len, uz: (node.z - a.z) / len, len, acc };
    acc += len;
    return segment;
  });
  const totalLength = segments.reduce((sum, s) => sum + s.len, 0);
  const pad = TRAIL_SLOT_HALF + TRAIL_BLEND_W + TRAIL_PLATFORM_R + 1;
  const xs = nodes.map((n) => n.x);
  const zs = nodes.map((n) => n.z);
  const bbox = { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, z0: Math.min(...zs) - pad, z1: Math.max(...zs) + pad };
  const sampleCount = Math.ceil(totalLength / TRAIL_SAMPLE_STEP);
  const natural = new Array<number>(sampleCount + 1);
  const plateauFade = new Array<number>(sampleCount + 1);
  for (let i = 0; i <= sampleCount; i += 1) {
    const s = Math.min(totalLength, i * TRAIL_SAMPLE_STEP);
    const hit = nearestTrailHitOnCenterline(segments, totalLength, s);
    natural[i] = naturalWorldReliefAt(hit.x, hit.z);
    // 台地缘渐显保险：中心线斜穿台地边界时，域外弧段的床高会把台地内
    // 的投影点拉上床（对角泄漏，单测「台地主盒严格为 0」曾捕获 0.0031
    // 级残差）。床高乘中心线台地外距离的 2u 渐显——台地内严格 0。
    plateauFade[i] = smoothStep(0, TRAIL_PLATEAU_FADE_W, distanceOutsidePlateau(hit.x, hit.z));
  }
  const grade = TRAIL_MAX_GRADE * TRAIL_SAMPLE_STEP;
  const bed = new Array<number>(sampleCount + 1);
  bed[0] = 0; // 首节点在台地内（自然场 0，槽床归 0）
  for (let i = 1; i <= sampleCount; i += 1) {
    // 前向双侧级差限制：床贴自然场（缓坡段床=自然，陡坡段滞后成切槽），
    // 每采样步 ±grade。不做终点硬钉与回扫——级差不可达时末端平台即
    // 「草甸起伏内的压平切台」（方案 §5.3 观景平台语义），且回扫会把
    // 终点高程沿纵坡倒拉进台地（台地平坦红线）。
    const clamped = Math.min(bed[i - 1]! + grade, Math.max(bed[i - 1]! - grade, natural[i]!));
    bed[i] = clamped * plateauFade[i]!;
  }
  return {
    id, nodes, segments, totalLength, bbox, sampleCount, bed,
    end: { x: nodes[nodes.length - 1]!.x, z: nodes[nodes.length - 1]!.z },
    endElev: bed[sampleCount]!,
  };
}

/** 中心线上弧长 s 处的坐标（床表采样专用；段表为空时返回原点）。 */
function nearestTrailHitOnCenterline(segments: readonly TrailSegment[], totalLength: number, s: number): { x: number; z: number } {
  if (segments.length === 0) return { x: 0, z: 0 };
  const clamped = Math.min(totalLength, Math.max(0, s));
  for (const segment of segments) {
    if (clamped <= segment.acc + segment.len || segment === segments[segments.length - 1]) {
      const rel = clamped - segment.acc;
      return { x: segment.ax + segment.ux * rel, z: segment.az + segment.uz * rel };
    }
  }
  const last = segments[segments.length - 1]!;
  return { x: last.ax + last.ux * last.len, z: last.az + last.uz * last.len };
}

/** 未切槽自然场（terrainHeight 的聚合公式去掉步道项；床表与切槽混合共用）。 */
function naturalWorldReliefAt(x: number, z: number): number {
  const openWeight = 1 - plateauFlat(x, z);
  const meadow = meadowReliefAt(x, z);
  const valley = riverValleyAt(x, z);
  const bedCut = Math.min(Math.min(valley, 0), seaBedCutAt(x, z)) + Math.max(valley, 0);
  return openWeight * meadow + bedCut;
}

/** 双走廊（南线/北线；naturalWorldReliefAt 为函数声明有提升，初始化可用）。 */
const TRAIL_CORRIDORS: readonly TrailCorridor[] = [
  buildTrailCorridor('south', SOUTH_TRAIL_NODES),
  buildTrailCorridor('north', NORTH_TRAIL_NODES),
];

/** 槽床纵剖面（弧长线性插值；槽内横向恒平由混合权重保证）。 */
function trailBedAt(corridor: TrailCorridor, s: number): number {
  const clamped = Math.min(corridor.totalLength, Math.max(0, s));
  const fi = clamped / TRAIL_SAMPLE_STEP;
  const i = Math.min(corridor.sampleCount - 1, Math.floor(fi));
  const k = fi - i;
  return corridor.bed[i]! * (1 - k) + corridor.bed[i + 1]! * k;
}

/** 观景平台末端高程（南线 S4 / 北线 N4，各自未切槽自然场压平面）。 */
export const SOUTH_TRAIL_END_ELEV: number = TRAIL_CORRIDORS[0]!.endElev;
export const NORTH_TRAIL_END_ELEV: number = TRAIL_CORRIDORS[1]!.endElev;

/**
 * 步道切槽权重（0..1）：槽内/平台为 1，融合坡内平滑衰减，域外 0。
 * 双走廊取最大值。供渲染层装饰剔除（cityGround 草甸散布避让路面）与
 * 单测消费。
 */
export function trailCutAt(x: number, z: number): number {
  let best = 0;
  for (const corridor of TRAIL_CORRIDORS) {
    const b = corridor.bbox;
    const end = corridor.end;
    const platform = 1 - smoothStep(TRAIL_PLATFORM_R, TRAIL_PLATFORM_R + TRAIL_BLEND_W, Math.hypot(x - end.x, z - end.z));
    let corridorWeight = platform;
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) {
      let bestDist = Infinity;
      let bestS = 0;
      for (const segment of corridor.segments) {
        const rel = Math.min(segment.len, Math.max(0, (x - segment.ax) * segment.ux + (z - segment.az) * segment.uz));
        const px = segment.ax + segment.ux * rel;
        const pz = segment.az + segment.uz * rel;
        const d = Math.hypot(x - px, z - pz);
        if (d < bestDist) { bestDist = d; bestS = segment.acc + rel; }
      }
      const corridorCut = 1 - smoothStep(TRAIL_SLOT_HALF, TRAIL_SLOT_HALF + TRAIL_BLEND_W, bestDist);
      corridorWeight = Math.max(corridorWeight, corridorCut);
    }
    if (corridorWeight > best) best = corridorWeight;
  }
  return best;
}

/** 导航用步道节点（双走廊合表——roadNavigation 图与地形切槽场同源）。 */
export const TRAIL_NAV_NODES = [...SOUTH_TRAIL_NODES, ...NORTH_TRAIL_NODES];
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
  // 年份群岛岛台（T3，设计 §6.2）：足印内恒为岛面高（台面/滩坡/水下裙，
  // 语义同主城台地——寻路、玩家落点、相机目标直接采样）。8 岛全在恒海区
  // （z_min>180 或 x_max<−150），与下面的自然场/走廊零重叠，直接短路。
  const islandY = islandSurfaceYAt(x, z);
  if (islandY !== null) {
    // T4 交通件上盖（设计 §5.1/§5.2）：星门大桥末段横穿起源村北滩（走廊内
    // 床高=桥面纵断面、落台 y=1.0 与台面无缝衔接）；各镇月台/栈桥以台面高
    // 盖在滩环上（桩基平台，走廊场语义同桥面）。月台优先于桥走廊（T4b 换序：
    // 月台是乘车落点的精确基准面，优先级与 transitGroundY 同口径）。
    const padY = stationPadBlendAt(x, z, islandY);
    if (padY !== null) return padY;
    const deckY = bridgeDeckBlendAt(x, z, islandY);
    return deckY === null ? islandY : deckY;
  }
  const natural = naturalWorldReliefAt(x, z);
  const plateauGate = smoothStep(0, TRAIL_PLATEAU_FADE_W, distanceOutsidePlateau(x, z));
  // 双走廊求最大切槽权重者胜（两走廊包围盒相距 >100u，恒不重叠）。
  let bestW = 0;
  let bestBed = 0;
  for (const corridor of TRAIL_CORRIDORS) {
    const b = corridor.bbox;
    const end = corridor.end;
    const platformW = 1 - smoothStep(TRAIL_PLATFORM_R, TRAIL_PLATFORM_R + TRAIL_BLEND_W, Math.hypot(x - end.x, z - end.z));
    let corridorW = 0;
    let s = 0;
    if (x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1) {
      let bestDist = Infinity;
      let bestS = 0;
      for (const segment of corridor.segments) {
        const rel = Math.min(segment.len, Math.max(0, (x - segment.ax) * segment.ux + (z - segment.az) * segment.uz));
        const px = segment.ax + segment.ux * rel;
        const pz = segment.az + segment.uz * rel;
        const d = Math.hypot(x - px, z - pz);
        if (d < bestDist) { bestDist = d; bestS = segment.acc + rel; }
      }
      corridorW = 1 - smoothStep(TRAIL_SLOT_HALF, TRAIL_SLOT_HALF + TRAIL_BLEND_W, bestDist);
      s = bestS;
    }
    const wSum = corridorW + platformW;
    if (wSum <= 0) continue;
    // 走廊/平台双权重按加权和混合床高（平台床 = 末端自然场压平值）。
    const bed = (corridorW * (corridorW > 0 ? trailBedAt(corridor, s) : corridor.endElev) + platformW * corridor.endElev) / wSum;
    const w = Math.max(corridorW, platformW);
    if (w > bestW) { bestW = w; bestBed = bed; }
  }
  if (bestW <= 0) return natural;
  // 采样点台地门（R3 红①）：TRAIL_BED 的台地渐显按「垂足」预烘焙（见
  // plateauFade 注释），但走廊斜穿台地南/北缘时，台地内的采样点会把垂足
  // 投到缘线外的弧段上、拿到台外床值。此门按采样点自身的台地外距离渐显
  // 床贡献：台地内（含缘线本身）床项严格归 0。
  return bestBed * plateauGate * bestW + natural * (1 - bestW);
}
