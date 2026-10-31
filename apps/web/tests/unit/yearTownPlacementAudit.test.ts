import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_BUILDING_DEFS } from '../../src/city/yearTownBuildings';
import { terrainHeight } from '../../src/city/data/terrain/heightfield/terrainHeight';
import { islandSurfaceYAt } from '../../src/city/data/terrain/heightfield/islandField';
import { YEAR_DISTRICTS } from '../../src/city/data/year-towns/towns';
import { YEAR_TOWN_MEMORIALS } from '../../src/city/data/year-towns/yearTownMemorials';
import { YEAR_TOWN_NEIGHBORHOODS } from '../../src/city/data/year-towns/cityNeighborhoods';

// 地基高度单一事实源：建筑 baseY 必须与 terrainHeight 同采样器一致，
// 防止岛缘 / 枢纽过渡带的高度聚合变化让建筑地基与玩家落点漂移。
test('年份建筑 baseY 与 terrainHeight 一致', () => {
  for (const def of YEAR_TOWN_BUILDING_DEFS) {
    const expected = Math.round(terrainHeight(def.x!, def.z!) * 100) / 100;
    assert.equal(def.baseY, expected, `${def.id} baseY 漂移`);
    assert.ok(Number.isFinite(def.baseY), `${def.id} baseY 非有限值`);
  }
});

function distanceToSegment(
  x: number,
  z: number,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
): number {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const length2 = dx * dx + dz * dz;
  const t = length2 <= 1e-9 ? 0 : Math.min(1, Math.max(0, ((x - x0) * dx + (z - z0) * dz) / length2));
  return Math.hypot(x - (x0 + dx * t), z - (z0 + dz * t));
}

test('年份城市建筑逐栋手写、面向街道并落在平整街廓', () => {
  for (const memorial of YEAR_TOWN_MEMORIALS) {
    const year = Number(memorial.key.slice(4, 8));
    if (year === 2019) continue;
    const district = YEAR_DISTRICTS.find((entry) =>
      year <= 2023 ? entry.id === 'island-oldport' : entry.id === 'island-starport',
    );
    assert.ok(district?.grid, `${memorial.key} 找不到城市街网`);
    assert.ok(memorial.layout, `${memorial.key} 缺手写布局`);
    assert.ok(memorial.layout.facing, `${memorial.key} 缺临街朝向`);

    const { x, z } = memorial.layout;
    const inBlock = district.grid.blocks?.some((block) =>
      x >= block.x0 && x <= block.x1 && z >= block.z0 && z <= block.z1,
    );
    assert.ok(inBlock, `${memorial.key} (${x},${z}) 未落入登记街廓`);
    assert.ok(
      Math.abs((islandSurfaceYAt(x, z) ?? -99) - district.topY) < 1e-6,
      `${memorial.key} (${x},${z}) 未落在平整城区阶地`,
    );
  }
});

test('年份城市建筑避开道路、广场且中心不重复', () => {
  const cityMemorials = YEAR_TOWN_MEMORIALS.filter((entry) => Number(entry.key.slice(4, 8)) >= 2020);
  const occupied = new Map<string, string>();
  const conflicts: string[] = [];
  for (const memorial of cityMemorials) {
    const layout = memorial.layout!;
    const year = Number(memorial.key.slice(4, 8));
    const district = YEAR_DISTRICTS.find((entry) =>
      year <= 2023 ? entry.id === 'island-oldport' : entry.id === 'island-starport',
    )!;
    const key = `${layout.x},${layout.z}`;
    if (occupied.has(key)) conflicts.push(`${memorial.key} 与 ${occupied.get(key)} 共用坐标 (${key})`);
    occupied.set(key, memorial.key);

    const footprint = (layout.plot ?? 4.2) / 2;
    for (const street of district.grid?.streets ?? []) {
      const distance = distanceToSegment(layout.x, layout.z, street.x0, street.z0, street.x1, street.z1);
      if (distance < street.halfWidth + footprint - 0.05) {
        conflicts.push(`${memorial.key} 距 ${street.name ?? '街道'} 中线 ${distance.toFixed(2)}，建筑压街`);
      }
    }
    for (const plaza of district.grid?.plazas ?? []) {
      const distance = Math.hypot(layout.x - plaza.x, layout.z - plaza.z);
      if (distance < plaza.radius + footprint - 0.05) {
        conflicts.push(`${memorial.key} 距广场中心 ${distance.toFixed(2)}，建筑侵入广场`);
      }
    }
  }
  assert.deepEqual(conflicts, [], conflicts.join('\n'));
});

// 纪念设施与外城生活建筑的交叉净距：两者坐标分属不同目录、审计此前互不
// 检查，重排布局时容易视觉穿模（2023 归港镇落位时发现的规则缺口）。7u 为
// 城市设计总纲 §3 规则 7 的既定值。
test('纪念设施与外城生活建筑保持 7u 交叉净距', () => {
  const conflicts: string[] = [];
  for (const memorial of YEAR_TOWN_MEMORIALS) {
    if (!memorial.layout) continue;
    for (const neighbor of YEAR_TOWN_NEIGHBORHOODS) {
      const distance = Math.hypot(memorial.layout.x - neighbor.x, memorial.layout.z - neighbor.z);
      if (distance < 7) {
        conflicts.push(`${memorial.key} (${memorial.layout.x},${memorial.layout.z}) 距外城 ${neighbor.id} (${neighbor.x},${neighbor.z}) ${distance.toFixed(2)}u，小于 7u`);
      }
    }
  }
  assert.deepEqual(conflicts, [], conflicts.join('\n'));
});

// 年份-街区映射守卫（红队复核 P1-6）：落位审计只查「落在所属岛某街廓」，
// 不查「落在设计总纲 §2 分配给本年份的街廓」——未来任何人把 2023 的楼挪进
// 2022 街廓，五套审计照样全绿。此表固化 docs/year-towns-urban-redesign.md
// §2 的分配；街廓矩形与 towns.ts 同步维护（rect 必须仍是登记街廓之一，
// 下方测试隐式校验：落不进注册街廓时上一用例先红）。
const YEAR_BLOCK_ASSIGNMENT: Readonly<Record<number, readonly { x0: number; x1: number; z0: number; z1: number }[]>> = {
  2020: [
    { x0: -62, x1: 13, z0: 225.5, z1: 256 },
    { x0: 27, x1: 79, z0: 225.5, z1: 256 },
  ],
  2021: [
    { x0: -62, x1: -22, z0: 268, z1: 283 },
    { x0: -62, x1: -22, z0: 291, z1: 303 },
    { x0: -8, x1: 13, z0: 268, z1: 303 },
    { x0: 27, x1: 58, z0: 268, z1: 303 },
  ],
  2022: [
    { x0: 74, x1: 98, z0: 268, z1: 303 },
    { x0: -62, x1: 13, z0: 314.5, z1: 330 },
    { x0: 28, x1: 98, z0: 314.5, z1: 330 },
    { x0: -62, x1: -26, z0: 341.5, z1: 358 },
  ],
  2023: [
    { x0: -8, x1: 13, z0: 341.5, z1: 358 },
    { x0: 27, x1: 58, z0: 341.5, z1: 358 },
    { x0: 66, x1: 94, z0: 341.5, z1: 358 },
    { x0: -62, x1: 13, z0: 372, z1: 396 },
    { x0: 27, x1: 59, z0: 372, z1: 396 },
    { x0: 14, x1: 26, z0: 405, z1: 411 },
  ],
  2024: [
    { x0: -382, x1: -327, z0: 199.5, z1: 212 },
    { x0: -313, x1: -256, z0: 199.5, z1: 212 },
    { x0: -246, x1: -188, z0: 199.5, z1: 212 },
    { x0: -313, x1: -256, z0: 224, z1: 251 },
    { x0: -246, x1: -228, z0: 224, z1: 251 },
    { x0: -202, x1: -184, z0: 224, z1: 251 },
  ],
  2025: [
    { x0: -396, x1: -327, z0: 263, z1: 294 },
    { x0: -313, x1: -256, z0: 263, z1: 294 },
    { x0: -246, x1: -184, z0: 263, z1: 294 },
    { x0: -379, x1: -327, z0: 306, z1: 330 },
    { x0: -313, x1: -256, z0: 306, z1: 330 },
  ],
  2026: [
    { x0: -246, x1: -192, z0: 306, z1: 330 },
    { x0: -368, x1: -344, z0: 342, z1: 362 },
    { x0: -313, x1: -270, z0: 342, z1: 366 },
    { x0: -246, x1: -228, z0: 342, z1: 358 },
  ],
};

test('纪念设施落在设计总纲分配给本年份的街区', () => {
  const conflicts: string[] = [];
  for (const memorial of YEAR_TOWN_MEMORIALS) {
    const year = Number(memorial.key.slice(4, 8));
    const rects = YEAR_BLOCK_ASSIGNMENT[year];
    if (!rects) continue; // 2019 起源村：村庄格局豁免
    const { x, z } = memorial.layout!;
    const inAssigned = rects.some((rect) => x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1);
    if (!inAssigned) conflicts.push(`${memorial.key} (${x},${z}) 未落在 ${year} 分配街区`);
  }
  assert.deepEqual(conflicts, [], conflicts.join('\n'));
});
