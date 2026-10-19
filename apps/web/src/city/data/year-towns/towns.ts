// 年份群岛 8 镇落位常量（T3 手写；设计依据 docs/year-towns-design.md §1/§3/§4）。
// 本文件是镇级数据的唯一事实源：地形要素（terrain/sea-archipelago.ts）、
// 高度场（heightfield/islandField.ts）、海图页标记与传送（mapController）、
// 导航/相机边界（MiniCityApp）都从这里取值，永不各写一份。
//
// T5 将在本目录追加生成物（gen-index / gen-t{y} 等，设计 §8.2）；本文件保持
// 手写、零依赖（不 import rendering / three），生成脚本与服务端镜像另行消费。
//
// 坐标语义（设计 §3）：中心 (x,z)、台面半径 plateauR（顶面平，走镇区）、
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
  /** 镇主题（设计 §4：地面基座用主色系做差异；建筑材质是 T5/T6 的事）。 */
  theme: {
    /** 台面地面色（岛台折面顶点色，含远处雾霾化的降饱和）。 */
    groundColor: number;
    /** 海图页图标填充色（与地面色同源）。 */
    iconColor: string;
  };
  /** 镇一句话寓意（海图页 tip slogan；详细面板是 T5）。 */
  tagline: string;
}

/** 8 座年份镇（年份升序 = 沿岛弧自东向西的时间序，设计 D1）。 */
export const YEAR_TOWNS: readonly YearTownSpec[] = [
  {
    year: 2019,
    id: 'island-2019',
    name: '起源村',
    label: '2019·起源村',
    x: 96,
    z: 202,
    plateauR: 9,
    beachR: 13,
    topY: 1.0,
    theme: { groundColor: 0xd9c8a0, iconColor: '#d9c8a0' },
    tagline: '社区的第一块基石——荒原上的第一盏灯，两栋屋的微型村。',
  },
  {
    year: 2020,
    id: 'island-2020',
    name: '启明镇',
    label: '2020·启明镇',
    x: 28,
    z: 224,
    plateauR: 11,
    beachR: 15,
    topY: 1.2,
    theme: { groundColor: 0xc9a184, iconColor: '#c9a184' },
    tagline: '新手指南与启蒙年代——砖陶街灯下，晨星初升。',
  },
  {
    year: 2021,
    id: 'island-2021',
    name: '潮声镇',
    label: '2021·潮声镇',
    x: -48,
    z: 238,
    plateauR: 15,
    beachR: 19,
    topY: 1.4,
    theme: { groundColor: 0xd6d9d4, iconColor: '#d6d9d4' },
    tagline: '聊天室世代——潮水般涌来又退去的一代代留言。',
  },
  {
    year: 2022,
    id: 'island-2022',
    name: '盛夏镇',
    label: '2022·盛夏镇',
    x: -126,
    z: 232,
    plateauR: 18,
    beachR: 23,
    topY: 1.6,
    theme: { groundColor: 0xd8cfa4, iconColor: '#d8cfa4' },
    tagline: '百作盛世——217 条作品的社区最高峰，盛夏都会。',
  },
  {
    year: 2023,
    id: 'island-2023',
    name: '回响镇',
    label: '2023·回响镇',
    x: -186,
    z: 214,
    plateauR: 17,
    beachR: 21,
    topY: 1.4,
    theme: { groundColor: 0xbfa98a, iconColor: '#bfa98a' },
    tagline: '市井烟火与文字回声——胶片色的年代。',
  },
  {
    year: 2024,
    id: 'island-2024',
    name: '微光镇',
    label: '2024·微光镇',
    x: -238,
    z: 172,
    plateauR: 16,
    beachR: 20,
    topY: 1.2,
    theme: { groundColor: 0xb9c6cd, iconColor: '#b9c6cd' },
    tagline: '静谧年份——猫咖与微光夜灯的小城。',
  },
  {
    year: 2025,
    id: 'island-2025',
    name: '长风镇',
    label: '2025·长风镇',
    x: -252,
    z: 116,
    plateauR: 14,
    beachR: 18,
    topY: 1.0,
    theme: { groundColor: 0xdadad4, iconColor: '#dadad4' },
    tagline: '极简现代岸——长风与灯塔。',
  },
  {
    year: 2026,
    id: 'island-2026',
    name: '星港',
    label: '2026·星港',
    x: -228,
    z: 62,
    plateauR: 13,
    beachR: 17,
    topY: 0.8,
    theme: { groundColor: 0x9aa4ae, iconColor: '#9aa4ae' },
    tagline: '最新一代——磁悬浮与星轨的天港。',
  },
];

/** 按稳定 ID 取镇。 */
export function yearTownById(id: string): YearTownSpec | undefined {
  return YEAR_TOWNS.find((town) => town.id === id);
}

/** 8 镇中心锚点 [x,z]：roadNavigation 的 yearTownAnchors（WORLD_BOUNDS 外扩，T3a）。
 *  元组保持可变形态以匹配 roadNavigation 的 Coord2 契约（外层数组只读防改写）。 */
export const YEAR_TOWN_ANCHORS: readonly [number, number][] = YEAR_TOWNS.map((town) => [town.x, town.z]);

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
  for (const town of YEAR_TOWNS) {
    minX = Math.min(minX, town.x - town.beachR - MARGIN);
    maxX = Math.max(maxX, town.x + town.beachR + MARGIN);
    minZ = Math.min(minZ, town.z - town.beachR - MARGIN);
    maxZ = Math.max(maxZ, town.z + town.beachR + MARGIN);
  }
  return { minX, maxX, minZ, maxZ };
}
