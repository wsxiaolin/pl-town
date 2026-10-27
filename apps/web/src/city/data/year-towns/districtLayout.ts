import { YEAR_TOWN_BUILDING_CONFIGS, YEAR_TOWN_BUILDING_EXTRAS } from './gen-buildings';
import { YEAR_TOWNS, yearDistrictById, type YearTownSpec } from './towns';
import type { BuildingConfig } from '../buildings/_types';
import type { YearTownBuildingExtras } from './_types';

// 年份片区街区化布局（T6 修订）：生成器原始坐标是「以镇为岛」的环带撒点，
// 现在 8 个年份是 2 座大城里的片区。本模块移植生成器 layoutTown 的布局
// 语法（主街两侧 + 环巷 + 间距校验 + 等比缩放），只把「镇」换成「片区」，
// 不新造建筑定义：输入/输出都是标准 BuildingConfig，继续走
// yearTownBuildings → buildingSceneController（与主城同管道）。
//
// 2019 仍是独立的启源站小岛，保留生成器手工点位。

const PLOT_BASE: Record<Tier, number> = { XL: 5.5, L: 4.6, M: 3.8, S: 3.2, ARCH: 4.2, TOWER: 3.0, STELE: 1.8 };
const RECT_GAP = 0.5;
const MIN_SCALE = 0.45;

type Tier = 'XL' | 'L' | 'M' | 'S' | 'ARCH' | 'TOWER' | 'STELE';

function extrasOf(id: string): YearTownBuildingExtras | undefined {
  return YEAR_TOWN_BUILDING_EXTRAS[id];
}

function tierOf(extras: YearTownBuildingExtras | undefined): Tier {
  if (!extras) return 'S';
  if (extras.kind === 'archive') return 'ARCH';
  if (extras.kind === 'tower') return 'TOWER';
  if (extras.kind === 'stele') return 'STELE';
  const rank = extras.townRank ?? 99;
  if (rank === 1) return 'XL';
  if (rank <= 3) return 'L';
  if (rank <= 10) return 'M';
  return 'S';
}

type Rect = { x0: number; x1: number; z0: number; z1: number };

const rectOf = (x: number, z: number, size: number): Rect => ({
  x0: x - size / 2, x1: x + size / 2, z0: z - size / 2, z1: z + size / 2,
});

const separated = (a: Rect, b: Rect, gap: number): boolean =>
  a.x1 + gap <= b.x0 || b.x1 + gap <= a.x0 || a.z1 + gap <= b.z0 || b.z1 + gap <= a.z0;

const withinCircle = (r: Rect, cx: number, cz: number, radius: number): boolean => {
  for (const [x, z] of [[r.x0, r.z0], [r.x0, r.z1], [r.x1, r.z0], [r.x1, r.z1]] as const) {
    if (Math.hypot(x - cx, z - cz) > radius) return false;
  }
  return true;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

type Candidate = { config: BuildingConfig; tier: Tier; size: number; side: number };

type Placement = { id: string; x: number; z: number; size: number };

function layoutBlocks(town: YearTownSpec, configs: readonly BuildingConfig[]): Placement[] {
  const cx = town.x;
  const cz = town.z;
  const rBuild = round2(town.plateauR - 3.5);
  // 片区主街轴向：从片区中心指向所属大城中心（城内主干道方向）。
  const district = yearDistrictById(town.districtId);
  const ax = district ? district.x - cx : 0;
  const az = district ? district.z - cz : 1;
  const norm = Math.hypot(ax, az) || 1;
  const ux = ax / norm;
  const uz = az / norm;
  const px = -uz;
  const pz = ux;
  const axisPhi = Math.atan2(uz, ux);
  const axisDistance = (theta: number) => {
    let d = Math.abs(theta - axisPhi) % Math.PI;
    if (d > Math.PI / 2) d = Math.PI - d;
    return d;
  };

  const candidates: Candidate[] = configs.map((config, index) => {
    const tier = tierOf(extrasOf(config.id));
    return { config, tier, size: PLOT_BASE[tier], side: index % 2 === 0 ? 1 : -1 };
  });
  const totalArea = candidates.reduce((sum, item) => sum + item.size * item.size, 0);
  let scale = Math.min(1, Math.sqrt((Math.PI * rBuild * rBuild * 0.4) / Math.max(totalArea, 1)));
  scale = Math.max(MIN_SCALE, scale);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const placed: Placement[] = [];
    const rects: Rect[] = [];
    const place = (candidate: Candidate, x: number, z: number, size: number) => {
      placed.push({ id: candidate.config.id, x: round2(x), z: round2(z), size: round2(size) });
      rects.push(rectOf(x, z, size));
    };
    let allOk = true;
    const ordered = [...candidates].sort((a, b) => {
      const order: Record<Tier, number> = { XL: 0, L: 1, ARCH: 2, TOWER: 3, M: 4, STELE: 5, S: 6 };
      return order[a.tier] - order[b.tier];
    });
    const xl = ordered.find((item) => item.tier === 'XL');
    if (xl) {
      const size = round2(xl.size * scale);
      const s = rBuild - size / 2 - 0.35;
      place(xl, cx + ux * s, cz + uz * s, size);
    }
    for (const candidate of ordered) {
      if (candidate === xl) continue;
      const size = round2(candidate.size * scale);
      const lat = 2.3 + size / 2;
      const sStep = Math.max(2.2, size + 1.1);
      const sMax = rBuild - 2.2 - size / 2 - 0.4;
      const sMin = -(rBuild - 2.0) + size / 2 + 0.4;
      let done = false;
      for (const sideSign of [candidate.side, -candidate.side]) {
        if (done) break;
        const side = sideSign * lat;
        for (let s = sMax; s >= sMin && !done; s -= sStep) {
          const x = cx + ux * s + px * side;
          const z = cz + uz * s + pz * side;
          if (Math.hypot(x - cx, z - cz) > rBuild) continue;
          const rect = rectOf(x, z, size);
          if (!withinCircle(rect, cx, cz, town.plateauR - 0.9)) continue;
          if (!rects.every((other) => separated(rect, other, RECT_GAP))) continue;
          place(candidate, x, z, size);
          done = true;
        }
      }
      if (done) continue;
      const bands = [rBuild - 0.7, rBuild - 2.3, rBuild - 3.9, rBuild - 5.5]
        .map((band) => band - size / 2)
        .filter((radius) => radius > size / 2 + 0.6 && radius <= rBuild);
      for (const radius of bands) {
        if (done) break;
        const step = Math.max(0.36, 2.0 / radius);
        const angles: number[] = [];
        for (let theta = 0; theta < Math.PI * 2 - 1e-9; theta += step) angles.push(theta);
        angles.sort((a, b) => axisDistance(b) - axisDistance(a));
        for (const theta of angles) {
          if (axisDistance(theta) < 0.3) continue;
          const x = cx + Math.cos(theta) * radius;
          const z = cz + Math.sin(theta) * radius;
          const rect = rectOf(x, z, size);
          if (!withinCircle(rect, cx, cz, town.plateauR - 0.9)) continue;
          if (!rects.every((other) => separated(rect, other, RECT_GAP))) continue;
          place(candidate, x, z, size);
          done = true;
          break;
        }
      }
      if (!done) {
        allOk = false;
        break;
      }
    }
    if (allOk) return placed;
    scale = Math.max(MIN_SCALE, scale * 0.9);
  }
  // 兜底：保持生成器原始坐标，避免因布局收敛失败丢建筑。
  return configs.map((config) => ({ id: config.id, x: config.x, z: config.z, size: 3.2 }));
}

const BY_YEAR = new Map<number, BuildingConfig[]>();
for (const config of YEAR_TOWN_BUILDING_CONFIGS) {
  const extras = extrasOf(config.id);
  if (!extras) continue;
  const list = BY_YEAR.get(extras.year) ?? [];
  list.push(config);
  BY_YEAR.set(extras.year, list);
}

const RELOCATED = new Map<string, { x: number; z: number }>();
for (const town of YEAR_TOWNS) {
  if (town.districtId === 'island-2019') continue;
  const layouts = layoutBlocks(town, BY_YEAR.get(town.year) ?? []);
  for (const layout of layouts) RELOCATED.set(layout.id, { x: layout.x, z: layout.z });
}

/** 布局后的年份建筑配置（2019 保留生成器手工点位）。 */
export const YEAR_TOWN_LAYOUT_CONFIGS: readonly BuildingConfig[] = YEAR_TOWN_BUILDING_CONFIGS.map((config) => {
  const relocated = RELOCATED.get(config.id);
  return relocated ? { ...config, x: relocated.x, z: relocated.z } : config;
});

/** 片区道路/街区参数（地面渲染与装饰共用）。 */
export const DISTRICT_BLOCK = {
  roadHalf: 2.3,
  sidewalkHalf: 3.0,
  plateauInset: 3.5,
} as const;
