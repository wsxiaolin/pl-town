// 城市分区模型：内区 / 东南西北外区 / 环状路以外的东南西北延伸区。
// 每个区域有五个建造阶段（stage），由 cityZoneController 统一应用可见性。

export type ZoneDirection = 'east' | 'south' | 'west' | 'north';

export type ZoneId =
  | 'inner'
  | `outer_${ZoneDirection}`
  | `ext_${ZoneDirection}`;

export type ZoneStage = 'locked' | 'built1' | 'built2' | 'built3' | 'unlocked';

/** locked=0 仅黑色主干道；built1=道路可见可通行；built2=+装饰；built3=+非民居；unlocked=全部 */
export const ZONE_STAGE_LEVEL: Record<ZoneStage, number> = {
  locked: 0,
  built1: 1,
  built2: 2,
  built3: 3,
  unlocked: 4,
};

export const ZONE_STAGE_ORDER: readonly ZoneStage[] = [
  'locked', 'built1', 'built2', 'built3', 'unlocked',
];

export const CITY_ZONE_IDS: readonly ZoneId[] = [
  'inner',
  'outer_east', 'outer_south', 'outer_west', 'outer_north',
  'ext_east', 'ext_south', 'ext_west', 'ext_north',
];

export const ZONE_LABELS: Record<ZoneId, string> = {
  inner: '内区',
  outer_east: '东外区', outer_south: '南外区', outer_west: '西外区', outer_north: '北外区',
  ext_east: '东延伸区', ext_south: '南延伸区', ext_west: '西延伸区', ext_north: '北延伸区',
};

export const ZONE_STAGE_LABELS: Record<ZoneStage, string> = {
  locked: '未解锁', built1: '建设1', built2: '建设2', built3: '建设3', unlocked: '已解锁',
};

// 内区为 |x|、|z| ≤ 18.5 的方形（覆盖 ±18 网格道路）；外区方形环带延伸到 ±36.5；
// 环状路（半径 37–39）及其附近归外区；40.5 以外且超出外区方带的区域归延伸区。
const INNER_HALF = 18.5;
const OUTER_HALF = 36.5;
const RING_OUTER = 40.5;

export function classifyZone(x: number, z: number): ZoneId {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax <= INNER_HALF && az <= INNER_HALF) return 'inner';
  const direction: ZoneDirection = ax >= az ? (x > 0 ? 'east' : 'west') : (z > 0 ? 'south' : 'north');
  if (Math.hypot(x, z) <= RING_OUTER) return `outer_${direction}`;
  if (Math.max(ax, az) <= OUTER_HALF) return `outer_${direction}`;
  return `ext_${direction}`;
}

export function isZoneId(value: string): value is ZoneId {
  return (CITY_ZONE_IDS as readonly string[]).includes(value);
}

// 一条平行于坐标轴的线（fixed 为另一轴坐标）上，分区归类可能发生变化的所有位置。
// 用于把道路按分区边界切开，保证每段道路只属于一个分区。
export function zoneBoundariesAlongAxis(fixed: number): number[] {
  const cuts = new Set<number>();
  for (const base of [INNER_HALF, OUTER_HALF]) {
    cuts.add(base);
    cuts.add(-base);
  }
  cuts.add(Math.abs(fixed));
  cuts.add(-Math.abs(fixed));
  const circle = Math.sqrt(Math.max(0, RING_OUTER * RING_OUTER - fixed * fixed));
  if (circle > 0) {
    cuts.add(circle);
    cuts.add(-circle);
  }
  return [...cuts];
}

export function zoneLevelFromStage(stage: ZoneStage): number {
  return ZONE_STAGE_LEVEL[stage] ?? 4;
}

export const ZONE_STORAGE_KEY = 'minicityZoneStages';

export type ZoneStageMap = Record<ZoneId, ZoneStage>;

export function defaultZoneStages(stage: ZoneStage = 'unlocked'): ZoneStageMap {
  return Object.fromEntries(CITY_ZONE_IDS.map((zone) => [zone, stage])) as ZoneStageMap;
}

export function readZoneStages(storage: Pick<Storage, 'getItem'> = window.localStorage): ZoneStageMap {
  const stages = defaultZoneStages();
  try {
    const raw = JSON.parse(storage.getItem(ZONE_STORAGE_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      for (const [zone, stage] of Object.entries(raw as Record<string, unknown>)) {
        if (isZoneId(zone) && ZONE_STAGE_ORDER.includes(stage as ZoneStage)) stages[zone] = stage as ZoneStage;
      }
    }
  } catch {
    // 存档损坏时回到默认（全区已解锁）
  }
  return stages;
}

export function writeZoneStages(stages: ZoneStageMap, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  try {
    storage.setItem(ZONE_STORAGE_KEY, JSON.stringify(stages));
  } catch {
    // 隐私模式等写入失败时忽略
  }
}
