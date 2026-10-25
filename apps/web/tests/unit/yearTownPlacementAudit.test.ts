import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_BUILDING_DEFS } from '../../src/city/yearTownBuildings';
import { terrainHeight } from '../../src/city/data/terrain/heightfield/terrainHeight';
import { islandSurfaceYAt } from '../../src/city/data/terrain/heightfield/islandField';
import { YEAR_DISTRICTS } from '../../src/city/data/year-towns/towns';
import { YEAR_TOWN_MEMORIALS } from '../../src/city/data/year-towns/yearTownMemorials';

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
