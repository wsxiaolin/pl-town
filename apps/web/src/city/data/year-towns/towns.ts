// 年份群岛 8 镇落位常量（T3 手写；设计依据 docs/year-towns-design.md §1/§3/§4）。
// 本文件是镇级数据的唯一事实源：地形要素（terrain/sea-archipelago.ts）、
// 高度场（heightfield/islandField.ts）、海图页标记与传送（mapController）、
// 导航/相机边界（MiniCityApp）都从这里取值，永不各写一份。
//
// T5 将在本目录追加生成物（gen-index / gen-t{y} 等，设计 §8.2）；本文件保持
// 手写、零依赖（不 import rendering / three），生成脚本与服务端镜像另行消费。
//
// 坐标语义（设计 §3/T7）：中心 (x,z)、台面半径 plateauR（顶面平，走镇区）、
// 滩环外缘 beachR（沙滩缓坡入水）、台面高 topY（0.8–1.6 错落）。
// 恒海判据：每镇滩环足印满足 z_min > 180 或 x_max < −150（farGround 南缘
// 最大 z=180 / 西缘最小 x=−149.6 的恒假区），与陆地永不冲突（worldTerrainAudit
// 'islands' 组①）。邻岛间距 ≥ 57.7 > 滩环和 44，岛间水道 ≥ 13u。

export interface YearTownSpec {
  /** 年份（2019–2026），同时是稳定排序键。 */
  year: number;
  /** 稳定 ID（island-2019 形式进 WORLD_TERRAIN；发布后不可改名）。 */
  id: string;
  /** 镇名（不含年份前缀）。 */
  name: string;
  /** 展示名「年份·镇名」（地图/海图页统一口径，设计 §1）。 */
  label: string;
  /** 镇中心（岛台圆心）。 */
  x: number;
  z: number;
  /** 台面半径（镇区地面，建筑/街巷限制在 r ≤ plateauR − 3.5，设计 §5.2）。 */
  plateauR: number;
  /** 滩环外缘半径（beachR = plateauR + 滩宽）。 */
  beachR: number;
  /** 台面高（terrainHeight 在台面内恒为此值，语义同主城台地）。 */
  topY: number;
  /** 所属大城（2019 为独立的启源站岛自身）。 */
  districtId: string;
  /** 镇主题（设计 §4：地面基座用主色系做差异；建筑材质是 T5/T6 的事）。 */
  theme: {
    /** 台面地面色（岛台折面顶点色，含远处雾霾化的降饱和）。 */
    groundColor: number;
    /** 海图页图标填充色（与地面色同源）。 */
    iconColor: string;
  };
  /** 镇一句话寓意（海图页 tip slogan；详细面板是 T5）。 */
  tagline: string;
  /** 岛缘自然形状（缺省为正圆）。 */
  shape?: IslandShapeMod;
}

/** 岛形调制：让岛缘随角度自然起伏（海湾/岬角），而不是正圆盘。
 *  以「极角 θ 上的半径倍率」表示，1 = 不调制。所有采样点（高度场、岛体网格、
 *  沙线盘、审计）共用同一函数，图与地形永不漂移。 */
export interface IslandShapeMod {
  /** 谐波项：freq（角频率，整数）× amp（振幅，相对 plateauR 的比例）× phase（相位）。 */
  harmonics: readonly { freq: number; amp: number; phase: number }[];
}

/**
 * 岛形调制倍率（θ 为相对岛心的极角，弧度）。返回值 ∈ [1−Σ|amp|, 1+Σ|amp|]。
 * 纯函数、确定性、无随机：同角度永远同倍率。
 */
export function islandShapeScaleAt(shape: IslandShapeMod | undefined, theta: number): number {
  if (!shape) return 1;
  let scale = 1;
  for (const h of shape.harmonics) scale += h.amp * Math.sin(h.freq * theta + h.phase);
  return scale;
}

/**
 * 海岸线控制点（显式岛形，取代纯径向谐波）。
 *
 * 坐标相对岛心，单位与世界一致。`bulge` 控制该点处的「平滑凸起」量
 * （0 = 尖锐转折，1 = 平缓圆弧），绘图时手写即可：把岬角写成连续几个
 * 外凸点、把海湾写成内凹点，曲线自然区分开来。
 *
 * 与 `shape`（谐波）二选一：给出 `outline` 时谐波不再参与半径计算。
 */
export interface IslandOutlinePoint {
  dx: number;
  dz: number;
  /** 该点的平滑系数 0..1（缺省 0.5）。 */
  bulge?: number;
}

/** 显式海岸线：闭合控制点环。首尾不必重复。 */
export interface IslandOutline {
  points: readonly IslandOutlinePoint[];
}

/** 离岸小屿（与主岛之间留窄水道）：中心相对主岛心，半径按极角谐波微调。 */
export interface IslandSatellite {
  dx: number;
  dz: number;
  radius: number;
  shape?: IslandShapeMod;
}

/** 岛形：谐波调制（旧）或显式海岸线（新）二选一。 */
export interface IslandForm {
  outline?: IslandOutline;
  shape?: IslandShapeMod;
}

/**
 * 显式海岸线的闭合采样（Catmull-Rom，逐段 5 次细分，再按弧长均匀重采样）。
 * 返回多边形顶点（相对岛心），首尾不重复。
 *
 * 只算一次并缓存在模块级：海岸线在运行期恒定，逐帧重算是纯浪费。
 */
const OUTLINE_CACHE = new WeakMap<IslandOutline, readonly [number, number][]>();

export function islandOutlinePolygon(outline: IslandOutline): readonly [number, number][] {
  const cached = OUTLINE_CACHE.get(outline);
  if (cached) return cached;
  const pts = outline.points;
  const n = pts.length;
  const dense: [number, number][] = [];
  const at = (i: number): [number, number] => {
    const p = pts[((i % n) + n) % n]!;
    return [p.dx, p.dz];
  };
  // Catmull-Rom：控制点间插值，bulge 缩放该段切线长度（0 → 直线，1 → 圆弧）。
  for (let i = 0; i < n; i += 1) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    // 切向权重：bulge 越大越接近圆弧（权重 1/6 → 0.5），越小越贴近折线。
    const bulge = Math.min(1, Math.max(0, pts[i]!.bulge ?? 0.5));
    const tension = 0.18 + 0.32 * bulge;
    for (let s = 0; s < 5; s += 1) {
      const t = s / 5;
      const t2 = t * t;
      const t3 = t2 * t;
      const k0 = -tension * t + 2 * tension * t2 - tension * t3;
      const k1 = 1 + (tension - 3) * t2 + (2 - tension) * t3;
      const k2 = tension * t + (3 - 2 * tension) * t2 + (tension - 2) * t3;
      const k3 = -tension * t2 + tension * t3;
      dense.push([
        p0[0] * k0 + p1[0] * k1 + p2[0] * k2 + p3[0] * k3,
        p0[1] * k0 + p1[1] * k1 + p2[1] * k2 + p3[1] * k3,
      ]);
    }
  }
  // 弧长重采样：段长恒定，逐角度查找时不会出现疏密不均的折线。
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < dense.length; i += 1) {
    const a = dense[i]!;
    const b = dense[(i + 1) % dense.length]!;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(len);
    total += len;
  }
  const target = Math.max(48, Math.round(total / 1.2));
  const step = total / target;
  const resampled: [number, number][] = [];
  let cursor = 0;
  let carry = 0;
  for (let k = 0; k < target; k += 1) {
    const want = k * step;
    while (cursor < lengths.length - 1 && carry + lengths[cursor]! < want) {
      carry += lengths[cursor]!;
      cursor += 1;
    }
    const a = dense[cursor]!;
    const b = dense[(cursor + 1) % dense.length]!;
    const t = lengths[cursor]! <= 1e-9 ? 0 : Math.min(1, (want - carry) / lengths[cursor]!);
    resampled.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  OUTLINE_CACHE.set(outline, resampled);
  return resampled;
}

/**
 * 显式海岸线在方向 θ 上的半径。
 *
 * 取该方向射线与多边形的交点里最远的那个（凹口/海湾处内缩、岬角处外伸
 * 都自然成立）。射线扫掠长度取多边形顶点的最大模长。
 */
export function islandOutlineRadiusAt(outline: IslandOutline, theta: number): number {
  const poly = islandOutlinePolygon(outline);
  const dx = Math.cos(theta);
  const dz = Math.sin(theta);
  let maxRho = 0;
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const denom = dx * ez - dz * ex;
    if (Math.abs(denom) < 1e-9) continue;
    const t = (a[0] * ez - a[1] * ex) / denom;
    const u = (a[0] * dz - a[1] * dx) / denom;
    if (t > 0 && u >= 0 && u <= 1) maxRho = Math.max(maxRho, t);
  }
  return maxRho;
}

/**
 * 岛在某方向的有效半径倍率（相对 plateauR）：显式海岸线优先，否则谐波。
 * 所有采样点（高度场、岛体网格、沙线盘、审计）共用本函数。
 */
export function islandRadiusScaleAt(
  island: { shape?: IslandShapeMod; outline?: IslandOutline; plateauR: number },
  theta: number,
): number {
  if (island.outline) {
    return islandOutlineRadiusAt(island.outline, theta) / island.plateauR;
  }
  return islandShapeScaleAt(island.shape, theta);
}

/** 岛上的一座山丘：高斯隆起，让岛面有真实起伏。 */
export interface IslandHill {
  /** 相对岛心的位置。 */
  dx: number;
  dz: number;
  /** 相对台面 topY 的抬升高度。 */
  height: number;
  /** 影响半径（高斯 σ）。 */
  radius: number;
}

/** 岛内山脊：沿一串控制点的高斯峰链（比孤立圆包更像真实山体）。 */
export interface IslandRidge {
  /** 相对岛心的控制点（≥2 个）。 */
  nodes: readonly { dx: number; dz: number }[];
  /** 脊线峰高（相对台面 topY）。 */
  height: number;
  /** 横向影响半径（高斯 σ）。 */
  radius: number;
}

/** 城区阶地的形状：轴对齐矩形（缺省）或显式多边形（贴合街区）。 */
export interface IslandTerrace {
  /** 相对岛心的中心与半尺寸（轴对齐矩形，随岛形裁剪）。多边形时忽略。 */
  dx: number;
  dz: number;
  halfW: number;
  halfD: number;
  /** 边缘过渡宽度（从阶地平滑并入自然地形）。 */
  blend: number;
  /** 可选多边形覆盖（相对岛心，顺时针或逆时针均可）。给出时按多边形判定。 */
  polygon?: readonly { dx: number; dz: number }[];
}

/** 岛屿地形配置（缺省为纯台面）。 */
export interface IslandTerrain {
  hills?: readonly IslandHill[];
  ridges?: readonly IslandRidge[];
  terraces?: readonly IslandTerrace[];
}

/** 街道等级：主干道 / 次街 / 巷道 / 滨水步道。 */
export type IslandStreetKind = 'avenue' | 'street' | 'lane' | 'promenade';

/**
 * 一条街。轴对齐街用 `axis` + `at`；斜街用 `from`/`to` 两端点（两者都给时
 * 以两端点为准）。`halfWidth` 是车行道半宽，人行道由渲染按等级补。
 */
export interface IslandStreet {
  /** 轴对齐街：'ew' 沿 x，'ns' 沿 z。斜街留空。 */
  axis?: 'ew' | 'ns';
  /** 轴对齐街的中心线坐标（ew 为 z，ns 为 x）。 */
  at?: number;
  /** 端点（绝对坐标）。轴对齐街只填沿轴方向的两个坐标即可。 */
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  /** 车行道半宽。 */
  halfWidth: number;
  /** 街道等级（决定铺装宽度、人行道、标线）。 */
  kind: IslandStreetKind;
  /** 街道名（调试与命名用，不渲染）。 */
  name?: string;
}

/** 广场：圆形或矩形，作为街网节点。 */
export interface IslandPlaza {
  x: number;
  z: number;
  radius: number;
  /** 'station' 站前广场 / 'market' 市集广场 / 'water' 滨水广场。 */
  kind: 'station' | 'market' | 'water';
}

/**
 * 街廓：由街网围合出的一块地。建筑按街廓分配，沿 `fronts` 指定的边成排。
 */
export interface IslandBlock {
  /** 街廓范围（轴对齐矩形，绝对坐标）。 */
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** 临街边：建筑正面朝向这些方向。 */
  fronts: readonly ('n' | 's' | 'e' | 'w')[];
  /** 用途，决定街廓内的空地比例与建筑密度。 */
  use: 'commercial' | 'residential' | 'civic' | 'works';
  /** 街廓中心留空的半径（院落/树/小广场），0 表示不留空。 */
  courtyard?: number;
}

/** 岛的城市街网（渲染与建筑临街面共用）。 */
export interface IslandStreetGrid {
  streets: readonly IslandStreet[];
  plazas?: readonly IslandPlaza[];
  /** 街廓登记：建筑落位必须落在某个街廓内并沿其临街边成排。 */
  blocks?: readonly IslandBlock[];
}

/** 大城（年份片区的承载岛）：启源站岛之外的 2 座可扩建城区。 */
export interface YearDistrictSpec {
  id: string;
  name: string;
  label: string;
  x: number;
  z: number;
  plateauR: number;
  beachR: number;
  topY: number;
  theme: { groundColor: number; iconColor: string };
  tagline: string;
  /** 岛缘自然形状（缺省为正圆；大城启用起伏岸线）。 */
  shape?: IslandShapeMod;
  /** 显式海岸线（给出时取代 shape 的径向谐波）。 */
  outline?: IslandOutline;
  /** 离岸小屿（与主岛之间留窄水道）。 */
  satellites?: readonly IslandSatellite[];
  /** 岛内地形（山脊 / 城区阶地；缺省为纯台面）。 */
  terrain?: IslandTerrain;
  /** 城市街网（缺省无街网，沿用旧放射干道）。 */
  grid?: IslandStreetGrid;
}

// ── 旧港城：港市原型（半岛 + 内湾 + 南岬）──────────────────────────────
//
// 形态原型：**地中海港市 + 方格网**。城区压在岛中部的方整阶地上，主街从
// 北侧车站直下南岸码头；西侧是避风内湾（渔港），东侧一片长滩；西南伸出
// 一道花岗岩岬角，岬端一座灯塔小屿。山脊贴着西缘走，把内湾与城区隔开。
//
// 坐标系：岛心 (0, 302)，plateauR 124、beachR 138（滩环宽 14）。
// 内城保留原作品建筑与站区，外圈以南北两条生活街和横向大街组织完整城市。
// 下列 OLDPORT_OUTLINE 仅保留为旧小岛的形态档案，当前大城使用低幅谐波岸线。

const OLDPORT_OUTLINE: IslandOutline = {
  points: [
    // 北岸：四座环线站背后的缓弧
    { dx: -30, dz: -50, bulge: 0.6 },
    { dx: -8, dz: -56, bulge: 0.8 },
    { dx: 18, dz: -57, bulge: 0.9 },
    { dx: 40, dz: -49, bulge: 0.6 },
    // 东北：向起源村方向退让的湾口
    { dx: 50, dz: -34, bulge: 0.35 },
    { dx: 56, dz: -16, bulge: 0.5 },
    // 东岸：平缓长滩，中段一处浅湾
    { dx: 55, dz: 5, bulge: 0.9 },
    { dx: 51, dz: 24, bulge: 0.2 },
    { dx: 45, dz: 42, bulge: 0.55 },
    // 东南角：滩尾收窄
    { dx: 30, dz: 55, bulge: 0.5 },
    // 南岸：码头岸线（两处凹口做泊位）
    { dx: 14, dz: 61, bulge: 0.18 },
    { dx: -2, dz: 63, bulge: 0.22 },
    { dx: -16, dz: 59, bulge: 0.2 },
    // 西南岬角：向外伸出的花岗岩嘴
    { dx: -31, dz: 62, bulge: 0.7 },
    { dx: -46, dz: 55, bulge: 0.85 },
    { dx: -52, dz: 43, bulge: 0.6 },
    // 西岸：避风内湾（渔港），岸线大幅内凹
    { dx: -48, dz: 29, bulge: 0.2 },
    { dx: -36, dz: 18, bulge: 0.2 },
    { dx: -34, dz: 5, bulge: 0.25 },
    { dx: -43, dz: -11, bulge: 0.45 },
    { dx: -51, dz: -27, bulge: 0.7 },
    { dx: -47, dz: -42, bulge: 0.85 },
  ],
};

/** 旧港主城阶地：覆盖中部方格网（相对岛心 −12..+34, −28..+30）。 */
const OLDPORT_TERRACE = [
  { dx: -34, dz: -43 },
  { dx: 43, dz: -43 },
  { dx: 47, dz: 35 },
  { dx: 30, dz: 50 },
  { dx: -34, dz: 47 },
];

/** 旧港西岸渔港阶地（内湾边的一小块平地，泊船与鱼市）。 */
const OLDPORT_HARBOUR_TERRACE = [
  { dx: -38, dz: 2 },
  { dx: -26, dz: 2 },
  { dx: -24, dz: 20 },
  { dx: -38, dz: 24 },
];

export const YEAR_DISTRICTS: readonly YearDistrictSpec[] = [
  {
    id: 'island-oldport',
    name: '旧港城',
    label: '旧港城',
    x: -5,
    z: 302,
    plateauR: 124,
    beachR: 130,
    topY: 1.2,
    theme: { groundColor: 0xcfc3a6, iconColor: '#cfc3a6' },
    tagline: '2019–2023 的旧港：从村口第一盏灯长成的滨海城区。',
    satellites: [],
    shape: {
      harmonics: [
        { freq: 3, amp: 0.035, phase: 0.8 },
        { freq: 5, amp: 0.025, phase: 1.6 },
      ],
    },
    terrain: {
      ridges: [],
      terraces: [
        { dx: 5, dz: 2, halfW: 40, halfD: 47, blend: 4.5, polygon: OLDPORT_TERRACE },
        { dx: -32, dz: 13, halfW: 7, halfD: 11, blend: 3, polygon: OLDPORT_HARBOUR_TERRACE },
      ],
    },
    // 街网：南北主街（车站 → 市中心 → 南码头）+ 三条东西横街切出六个街廓，
    // 西侧一条滨水步道接渔港，东南一条斜街通往东滩。
    grid: {
      streets: [
        // 港口大道把北岸站区、中央市集与南码头连成一条清晰城市轴。
        { x0: 20, z0: 172, x1: 20, z1: 400, halfWidth: 3.4, kind: 'avenue', name: '港口大道' },
        { x0: -82, z0: 170, x1: 112, z1: 170, halfWidth: 2.6, kind: 'street', name: '北环街' },
        { x0: -82, z0: 207, x1: 112, z1: 207, halfWidth: 2.6, kind: 'street', name: '学院街' },
        { x0: -82, z0: 366, x1: 112, z1: 366, halfWidth: 2.6, kind: 'street', name: '南市街' },
        { x0: -68, z0: 364, x1: 104, z1: 364, halfWidth: 2.4, kind: 'street', name: '海堤街' },
        { x0: -68, z0: 190, x1: -68, z1: 380, halfWidth: 2.4, kind: 'street', name: '西巷' },
        { x0: 104, z0: 190, x1: 104, z1: 380, halfWidth: 2.4, kind: 'street', name: '东堤街' },
        { x0: -68, z0: 382, x1: -68, z1: 390, halfWidth: 1.3, kind: 'lane', name: '南市巷' },
        { x0: -18, z0: 220, x1: 62, z1: 220, halfWidth: 2.2, kind: 'street', name: '站前街' },
        { x0: -18, z0: 262, x1: 62, z1: 262, halfWidth: 2.5, kind: 'street', name: '中市街' },
        { x0: -18, z0: 309, x1: 58, z1: 309, halfWidth: 2.1, kind: 'street', name: '鱼市街' },
        { x0: -68, z0: 336, x1: 104, z1: 336, halfWidth: 2.3, kind: 'street', name: '灯市街' },
        // 两条袋形院巷从滨水侧开口，在街廓边缘止步，院心保持完整。
        { x0: -18, z0: 287, x1: -15, z1: 287, halfWidth: 1.1, kind: 'lane', name: '秤砣巷' },
        { x0: 58, z0: 287, x1: 62, z1: 287, halfWidth: 1.1, kind: 'lane', name: '缆绳巷' },
        // 滨水步道：沿内湾东缘，接渔港阶地
        { x0: -20, z0: 225, x1: -18, z1: 260, halfWidth: 1.5, kind: 'promenade', name: '渔港步道' },
        { x0: -18, z0: 260, x1: -16, z1: 306, halfWidth: 1.5, kind: 'promenade', name: '南岸步道' },
        // 斜街：市区东南角通往东滩
        { x0: 62, z0: 262, x1: 68, z1: 294, halfWidth: 1.8, kind: 'street', name: '东滩街' },
      ],
      plazas: [
        { x: -26, z: 229, radius: 5.2, kind: 'station' },
        { x: 66, z: 229, radius: 5.2, kind: 'station' },
        { x: 20, z: 240, radius: 6.5, kind: 'market' },
        { x: -26, z: 295, radius: 5.2, kind: 'station' },
        { x: 66, z: 295, radius: 5.2, kind: 'station' },
        { x: 20, z: 317, radius: 4.5, kind: 'water' },
        { x: 20, z: 184, radius: 8, kind: 'market' },
        { x: -44, z: 354, radius: 7, kind: 'market' },
        { x: 78, z: 354, radius: 7, kind: 'market' },
        { x: 20, z: 428, radius: 7, kind: 'water' },
      ],
      blocks: [
        // 全部街廓按岛心 (-5,302) 半径 ≤114 裁剪（谐波下限 0.94×124=116.6，留 2u 余量）。
        // ── 北岸（学院街↔站前街之间为滨海缓坡带，不设街廓；建筑集中于站前以南）──
        // ── 站前厢（站前街↔中市街）：西城厢 / 东商肆（站前广场在东厢西北角）──
        { x0: -62, x1: 13, z0: 225.5, z1: 256, fronts: ['n', 's', 'e', 'w'], use: 'residential', courtyard: 7 },
        { x0: 27, x1: 79, z0: 225.5, z1: 256, fronts: ['n', 's', 'e', 'w'], use: 'commercial' },
        // ── 中市厢（中市街↔鱼市街）：鱼市西排两段 / 中央工坊 / 东宅 / 东滩里 ──
        { x0: -62, x1: -22, z0: 268, z1: 283, fronts: ['n', 's', 'e', 'w'], use: 'commercial' },
        { x0: -62, x1: -22, z0: 291, z1: 303, fronts: ['n', 's', 'e', 'w'], use: 'commercial' },
        { x0: -8, x1: 13, z0: 268, z1: 303, fronts: ['n', 's', 'e', 'w'], use: 'works', courtyard: 6 },
        { x0: 27, x1: 58, z0: 268, z1: 303, fronts: ['n', 's', 'e', 'w'], use: 'residential', courtyard: 6 },
        { x0: 74, x1: 98, z0: 268, z1: 303, fronts: ['n', 's', 'e', 'w'], use: 'residential' },
        // ── 灯市厢（鱼市街↔灯市街）：两排大街廓，中央留 avenue 绿带 ──
        { x0: -62, x1: 13, z0: 314.5, z1: 330, fronts: ['n', 's', 'e', 'w'], use: 'residential', courtyard: 6 },
        { x0: 28, x1: 98, z0: 314.5, z1: 330, fronts: ['n', 's', 'e', 'w'], use: 'residential', courtyard: 7 },
        // ── 灯市南（灯市街↔海堤街）：西馆区 / 三排宅里（两处市集广场在廓内留白）──
        { x0: -62, x1: -26, z0: 341.5, z1: 358, fronts: ['n', 's', 'e', 'w'], use: 'civic' },
        { x0: -8, x1: 13, z0: 341.5, z1: 358, fronts: ['n', 's', 'e', 'w'], use: 'residential' },
        { x0: 27, x1: 58, z0: 341.5, z1: 358, fronts: ['n', 's', 'e', 'w'], use: 'residential' },
        { x0: 66, x1: 94, z0: 341.5, z1: 358, fronts: ['n', 's', 'e', 'w'], use: 'residential' },
        // ── 南端（海堤街/南市街↔南码头）──
        { x0: -62, x1: 13, z0: 372, z1: 396, fronts: ['n', 's', 'e', 'w'], use: 'residential', courtyard: 9 },
        { x0: 27, x1: 59, z0: 372, z1: 396, fronts: ['n', 's', 'e', 'w'], use: 'residential', courtyard: 8 },
        { x0: 14, x1: 26, z0: 405, z1: 411, fronts: ['s'], use: 'civic' },
      ],
    },
  },
  // ── 星港城：未来港原型（长岬 + 内湾 + 磁悬干道）────────────────────
  //
  // 形态原型：**当代填海港区**。一条笔直的南北向磁悬干道（北端车站、
  // 南端昼夜码头），干道两侧各两块大尺度街区；西侧是深水内湾（货运泊位），
  // 东北伸出一道狭长长岬，岬上只有灯塔与航标；山脊在东缘，街区向东收边。
  //
  // 坐标系：岛心 (−215, 256)，plateauR 56、beachR 66。
  {
    id: 'island-starport',
    name: '星港城',
    label: '星港城',
    x: -285,
    z: 262,
    plateauR: 130,
    beachR: 139,
    topY: 0.9,
    theme: { groundColor: 0xaeb8c2, iconColor: '#aeb8c2' },
    tagline: '2024–2026 的星港：磁悬、灯塔与夜航码头。',
    shape: {
      harmonics: [
        { freq: 3, amp: 0.06, phase: 0.4 },
        { freq: 5, amp: 0.035, phase: 1.2 },
      ],
    },
    satellites: [],
    terrain: {
      ridges: [],
      terraces: [
        // 港区阶地：干道两侧的四块街区 + 站前广场，压成一片平地。
        {
          dx: 0,
          dz: 0,
          halfW: 43,
          halfD: 47,
          blend: 4.5,
          polygon: [
            { dx: -43, dz: -43 },
            { dx: 35, dz: -43 },
            { dx: 43, dz: -27 },
            { dx: 41, dz: 39 },
            { dx: 24, dz: 49 },
            { dx: -41, dz: 46 },
            { dx: -46, dz: 24 },
          ],
        },
      ],
    },
    // 三座真实车站接入一条南北港口大道，两条横街切出三组围合街区。
    grid: {
      streets: [
        { x0: -320, z0: 138, x1: -320, z1: 378, halfWidth: 3.6, kind: 'avenue', name: '星港大道' },
        { x0: -425, z0: 176, x1: -215, z1: 176, halfWidth: 2.6, kind: 'street', name: '天幕街' },
        { x0: -425, z0: 196, x1: -257, z1: 196, halfWidth: 2.6, kind: 'street', name: '科研街西段' },
        { x0: -215, z0: 196, x1: -140, z1: 196, halfWidth: 2.6, kind: 'street', name: '科研街东段' },
        { x0: -425, z0: 336, x1: -215, z1: 336, halfWidth: 2.6, kind: 'street', name: '夜市街' },
        { x0: -425, z0: 383, x1: -292, z1: 383, halfWidth: 2.4, kind: 'street', name: '远航街西段' },
        { x0: -278, z0: 383, x1: -215, z1: 383, halfWidth: 2.4, kind: 'street', name: '远航街东段' },
        { x0: -410, z0: 156, x1: -410, z1: 376, halfWidth: 2.4, kind: 'street', name: '西环大道' },
        { x0: -170, z0: 156, x1: -170, z1: 218, halfWidth: 2.4, kind: 'street', name: '东环大道' },
        { x0: -170, z0: 306, x1: -170, z1: 376, halfWidth: 2.4, kind: 'street', name: '东环大道南段' },
        { x0: -258, z0: 218, x1: -174, z1: 218, halfWidth: 2.5, kind: 'street', name: '货站街' },
        { x0: -258, z0: 257, x1: -174, z1: 257, halfWidth: 2.3, kind: 'street', name: '夜航街' },
        { x0: -258, z0: 300, x1: -174, z1: 300, halfWidth: 2.2, kind: 'street', name: '南港街' },
        { x0: -251, z0: 222, x1: -251, z1: 296, halfWidth: 1.3, kind: 'lane', name: '集装箱路' },
        { x0: -179, z0: 222, x1: -179, z1: 296, halfWidth: 1.2, kind: 'lane', name: '光纤巷' },
        { x0: -260, z0: 237, x1: -251, z1: 237, halfWidth: 1.4, kind: 'promenade', name: '西湾步道' },
        { x0: -251, z0: 296, x1: -179, z1: 304, halfWidth: 1.4, kind: 'promenade', name: '南岸步道' },
        { x0: -180, z0: 218, x1: -166, z1: 202, halfWidth: 1.2, kind: 'lane', name: '灯塔小路' },
      ],
      plazas: [
        { x: -215, z: 208, radius: 5.5, kind: 'station' },
        { x: -258, z: 283, radius: 5.2, kind: 'station' },
        { x: -172, z: 283, radius: 5.2, kind: 'station' },
        { x: -215, z: 240, radius: 6.5, kind: 'market' },
        { x: -215, z: 304, radius: 4.8, kind: 'water' },
        { x: -320, z: 190, radius: 9, kind: 'market' },
        { x: -383, z: 352, radius: 9, kind: 'market' },
        { x: -257, z: 352, radius: 9, kind: 'market' },
        { x: -320, z: 380, radius: 9, kind: 'water' },
      ],
      blocks: [
        // 全部街廓按岛心 (-285,262) 半径 ≤116 裁剪（谐波下限 0.94×130=122.2，留余量）。
        // ── 北岸（天幕街↔科研街）：西港北岸 / 大道东商业长排 ──
        { x0: -368, x1: -327, z0: 182, z1: 192.5, fronts: ['n', 's', 'e', 'w'], use: 'commercial' },
        { x0: -313, x1: -203, z0: 182, z1: 192.5, fronts: ['n', 's', 'e', 'w'], use: 'commercial', courtyard: 10 },
        // ── 科研带（科研街↔货站街）：西湾宿区 / 科研西院 / 科研东院 ──
        { x0: -382, x1: -327, z0: 199.5, z1: 212, fronts: ['n', 's', 'e', 'w'], use: 'residential' },
        { x0: -313, x1: -256, z0: 199.5, z1: 212, fronts: ['n', 's', 'e', 'w'], use: 'civic' },
        { x0: -246, x1: -188, z0: 199.5, z1: 212, fronts: ['n', 's', 'e', 'w'], use: 'works' },
        // ── 货站带（货站街↔夜航街）：泊位后场两组 / 西宅 / 市集广场两侧 ──
        { x0: -395, x1: -370, z0: 224, z1: 251, fronts: ['n', 's', 'e', 'w'], use: 'works' },
        { x0: -360, x1: -327, z0: 224, z1: 251, fronts: ['n', 's', 'e', 'w'], use: 'works' },
        { x0: -313, x1: -256, z0: 224, z1: 251, fronts: ['n', 's', 'e', 'w'], use: 'residential', courtyard: 6 },
        { x0: -246, x1: -228, z0: 224, z1: 251, fronts: ['n', 's', 'e', 'w'], use: 'residential' },
        { x0: -202, x1: -184, z0: 224, z1: 251, fronts: ['n', 's', 'e', 'w'], use: 'civic', courtyard: 6 },
        // ── 夜航带（夜航街↔南港街）：西宅 / 西工坊（站前广场在西缘）/ 东工坊 ──
        { x0: -396, x1: -327, z0: 263, z1: 294, fronts: ['n', 's', 'e', 'w'], use: 'residential', courtyard: 7 },
        { x0: -313, x1: -256, z0: 263, z1: 294, fronts: ['n', 's', 'e', 'w'], use: 'works', courtyard: 6 },
        { x0: -246, x1: -184, z0: 263, z1: 294, fronts: ['n', 's', 'e', 'w'], use: 'works' },
        // ── 南港带（南港街↔夜市街）──
        { x0: -379, x1: -327, z0: 306, z1: 330, fronts: ['n', 's', 'e', 'w'], use: 'residential' },
        { x0: -313, x1: -256, z0: 306, z1: 330, fronts: ['n', 's', 'e', 'w'], use: 'residential' },
        { x0: -246, x1: -192, z0: 306, z1: 330, fronts: ['n', 's', 'e', 'w'], use: 'commercial' },
        // ── 夜市带（夜市街↔远航街）：西排 / 中排 / 东排（两处市集广场留白）──
        { x0: -368, x1: -344, z0: 342, z1: 362, fronts: ['n', 's', 'e', 'w'], use: 'commercial' },
        { x0: -313, x1: -270, z0: 342, z1: 366, fronts: ['n', 's', 'e', 'w'], use: 'commercial' },
        { x0: -246, x1: -228, z0: 342, z1: 358, fronts: ['n', 's', 'e', 'w'], use: 'commercial' },
      ],
    },
  },
];

export function yearDistrictById(id: string): YearDistrictSpec | undefined {
  return YEAR_DISTRICTS.find((district) => district.id === id);
}

/** 8 个年份片区（年份语义/面板/装饰不变；坐标落进所属大城的片区网格）。 */
export const YEAR_TOWNS: readonly YearTownSpec[] = [
  {
    year: 2019,
    id: 'island-2019',
    name: '起源村',
    label: '2019·起源村',
    x: 150,
    z: 210,
    plateauR: 22,
    beachR: 26,
    topY: 1.0,
    districtId: 'island-2019',
    theme: { groundColor: 0xd9c8a0, iconColor: '#d9c8a0' },
    tagline: '社区的第一块基石——荒原上的第一盏灯，两栋屋的微型村。',
  },
  {
    year: 2020,
    id: 'island-2020',
    name: '启明镇',
    label: '2020·启明镇',
    x: -8,
    z: 242,
    plateauR: 34,
    beachR: 38,
    topY: 1.2,
    districtId: 'island-oldport',
    theme: { groundColor: 0xc9a184, iconColor: '#c9a184' },
    tagline: '新手指南与启蒙年代——砖陶街灯下，晨星初升。',
  },
  {
    year: 2021,
    id: 'island-2021',
    name: '潮声镇',
    label: '2021·潮声镇',
    x: 48,
    z: 242,
    plateauR: 34,
    beachR: 38,
    topY: 1.2,
    districtId: 'island-oldport',
    theme: { groundColor: 0xd6d9d4, iconColor: '#d6d9d4' },
    tagline: '聊天室世代——潮水般涌来又退去的一代代留言。',
  },
  {
    year: 2022,
    id: 'island-2022',
    name: '盛夏镇',
    label: '2022·盛夏镇',
    x: -8,
    z: 282,
    plateauR: 34,
    beachR: 38,
    topY: 1.2,
    districtId: 'island-oldport',
    theme: { groundColor: 0xd8cfa4, iconColor: '#d8cfa4' },
    tagline: '百作盛世——217 条作品的社区最高峰，盛夏都会。',
  },
  {
    year: 2023,
    id: 'island-2023',
    name: '回响镇',
    label: '2023·回响镇',
    x: 48,
    z: 282,
    plateauR: 34,
    beachR: 38,
    topY: 1.2,
    districtId: 'island-oldport',
    theme: { groundColor: 0xbfa98a, iconColor: '#bfa98a' },
    tagline: '市井烟火与文字回声——胶片色的年代。',
  },
  {
    year: 2024,
    id: 'island-2024',
    name: '微光镇',
    label: '2024·微光镇',
    x: -215,
    z: 230,
    plateauR: 25,
    beachR: 29,
    topY: 0.9,
    districtId: 'island-starport',
    theme: { groundColor: 0xb9c6cd, iconColor: '#b9c6cd' },
    tagline: '静谧年份——猫咖与微光夜灯的小城。',
  },
  {
    year: 2025,
    id: 'island-2025',
    name: '长风镇',
    label: '2025·长风镇',
    x: -239,
    z: 271,
    plateauR: 25,
    beachR: 29,
    topY: 0.9,
    districtId: 'island-starport',
    theme: { groundColor: 0xdadad4, iconColor: '#dadad4' },
    tagline: '极简现代岸——长风与灯塔。',
  },
  {
    year: 2026,
    id: 'island-2026',
    name: '星港',
    label: '2026·星港',
    x: -191,
    z: 271,
    plateauR: 25,
    beachR: 29,
    topY: 0.9,
    districtId: 'island-starport',
    theme: { groundColor: 0x9aa4ae, iconColor: '#9aa4ae' },
    tagline: '最新一代——磁悬浮与星轨的天港。',
  },
];

/** 年份片区所属大城（2019 仍指向独立的启源站岛）。 */
export function yearTownDistrict(town: YearTownSpec): YearDistrictSpec | undefined {
  return yearDistrictById(town.districtId);
}

/** 某座大城的全部年份片区。 */
export function yearTownsOfDistrict(districtId: string): readonly YearTownSpec[] {
  return YEAR_TOWNS.filter((town) => town.districtId === districtId);
}

/** 岛体条目（大城 + 启源站独立小岛）：渲染/高度场/审计共用。 */
export const YEAR_ISLAND_SPECS: readonly YearDistrictSpec[] = [
  ...YEAR_DISTRICTS,
  {
    id: 'island-2019',
    name: '启源站',
    label: '2019·起源村',
    x: 150,
    z: 210,
    plateauR: 22,
    beachR: 26,
    topY: 1.0,
    theme: { groundColor: 0xd9c8a0, iconColor: '#d9c8a0' },
    tagline: '社区的第一块基石——荒原上的第一盏灯。',
    // 起源村是桥头沙洲：北侧收窄接桥，东西两端各伸一块宅地，南侧留小湾。
    outline: {
      points: [
        { dx: -8, dz: -18, bulge: 0.5 },
        { dx: 0, dz: -21, bulge: 0.8 },
        { dx: 9, dz: -17, bulge: 0.5 },
        { dx: 20, dz: -8, bulge: 0.45 },
        { dx: 22, dz: 2, bulge: 0.7 },
        { dx: 18, dz: 13, bulge: 0.5 },
        { dx: 7, dz: 19, bulge: 0.25 },
        { dx: -2, dz: 16, bulge: 0.15 },
        { dx: -11, dz: 20, bulge: 0.35 },
        { dx: -21, dz: 10, bulge: 0.6 },
        { dx: -22, dz: -3, bulge: 0.7 },
        { dx: -17, dz: -13, bulge: 0.55 },
      ],
    },
    grid: {
      streets: [
        { x0: 150, z0: 195, x1: 150, z1: 219, halfWidth: 1.5, kind: 'street', name: '启源路' },
        { x0: 144, z0: 210, x1: 156, z1: 210, halfWidth: 1.1, kind: 'lane', name: '基石巷' },
      ],
      plazas: [{ x: 150, z: 210, radius: 3.2, kind: 'market' }],
      blocks: [
        { x0: 132, x1: 144, z0: 205, z1: 216, fronts: ['e'], use: 'civic' },
        { x0: 156, x1: 168, z0: 205, z1: 216, fronts: ['w'], use: 'works' },
      ],
    },
  },
];

/** 按稳定 ID 取镇。 */
export function yearTownById(id: string): YearTownSpec | undefined {
  return YEAR_TOWNS.find((town) => town.id === id);
}

/** 岛体边缘锚点 [x,z]：roadNavigation 的 yearTownAnchors（WORLD_BOUNDS 外扩，T3a）。
 *  用 3 座岛的滩环四向极值而非 8 个镇中心，避免大城边缘建筑被步行界钳回。
 *  元组保持可变形态以匹配 roadNavigation 的 Coord2 契约（外层数组只读防改写）。 */
export const YEAR_TOWN_ANCHORS: readonly [number, number][] = YEAR_ISLAND_SPECS.flatMap((island) => [
  [island.x - island.beachR, island.z],
  [island.x + island.beachR, island.z],
  [island.x, island.z - island.beachR],
  [island.x, island.z + island.beachR],
]);

/** 海图页镇标记 DTO（mapController 消费、MiniCityApp 接线）：零渲染依赖的纯数据视图。 */
export interface YearTownMarker {
  id: string;
  /** 展示名「年份·镇名」（tip 标题 + 图标 title）。 */
  label: string;
  /** tip slogan（镇一句话寓意）。 */
  tagline: string;
  /** 图标填充色（CSS 色串，theme.iconColor 同源）。 */
  iconColor: string;
  x: number;
  z: number;
}

/** 海图页 8 镇标记（mapController 不再 import 镇表本体，只吃这份投影）。 */
export const YEAR_TOWN_MARKERS: readonly YearTownMarker[] = YEAR_TOWNS.map((town) => ({
  id: town.id,
  label: town.label,
  tagline: town.tagline,
  iconColor: town.theme.iconColor,
  x: town.x,
  z: town.z,
}));

/**
 * 相机平移域（T3a）：主城 ±cityLimit 与 8 镇滩域（含 margin 取景余量）的
 * 轴对齐并集。cameraPanController 不传 panBounds 时默认仍是 ±cityLimit，
 * 行为不变；MiniCityApp 传入本并集后相机可一路平移到远岛。
 */
export function yearTownPanBounds(cityLimit: number): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  const MARGIN = 12;
  let minX = -cityLimit;
  let maxX = cityLimit;
  let minZ = -cityLimit;
  let maxZ = cityLimit;
  for (const town of YEAR_ISLAND_SPECS) {
    minX = Math.min(minX, town.x - town.beachR * 1.2 - MARGIN);
    maxX = Math.max(maxX, town.x + town.beachR * 1.2 + MARGIN);
    minZ = Math.min(minZ, town.z - town.beachR * 1.2 - MARGIN);
    maxZ = Math.max(maxZ, town.z + town.beachR * 1.2 + MARGIN);
  }
  return { minX, maxX, minZ, maxZ };
}
