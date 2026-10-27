import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_NEIGHBORHOODS } from '../../src/city/data/year-towns/cityNeighborhoods';
import { YEAR_TOWN_BUILDING_DEFS, YEAR_TOWN_BUILDING_CONTENT } from '../../src/city/yearTownBuildings';
import { YEAR_DISTRICTS, islandRadiusScaleAt, type IslandStreet } from '../../src/city/data/year-towns/towns';
import { terrainHeight } from '../../src/city/data/terrain/heightfield/terrainHeight';
import { YEAR_TOWN_URBAN_LIFE } from '../../src/city/data/year-towns/urbanLife';

test('年份外城是完整生活城市：日常建筑、街道设施与两座终章地标齐备', () => {
  assert.ok(YEAR_TOWN_NEIGHBORHOODS.length >= 50);
  assert.ok(YEAR_TOWN_URBAN_LIFE.filter((item) => item.kind === 'stall').length >= 12);
  assert.ok(YEAR_TOWN_URBAN_LIFE.filter((item) => item.kind === 'lamp').length >= 16);
  assert.ok(YEAR_TOWN_URBAN_LIFE.filter((item) => item.kind === 'tree').length >= 12);
  for (const id of ['yt-op-end', 'yt-sp-end']) {
    assert.ok(YEAR_TOWN_BUILDING_DEFS.some((building) => building.id === id), `${id} 应进入真实建筑场景`);
    const content = YEAR_TOWN_BUILDING_CONTENT[id];
    assert.ok(content?.dialog[0]?.includes('终章') || content?.name.includes('终章'));
  }
  const definitions = new Set(YEAR_TOWN_BUILDING_DEFS.map((building) => building.id));
  for (const building of YEAR_TOWN_NEIGHBORHOODS) {
    assert.ok(definitions.has(building.id), `${building.id} 未进入建筑装配`);
    assert.ok(building.story.length >= 30, `${building.id} 缺城市生活内容`);
    assert.ok(YEAR_TOWN_BUILDING_CONTENT[building.id], `${building.id} 缺可交互对话`);
  }
});

function distanceToStreet(x: number, z: number, street: IslandStreet): number {
  const dx = street.x1 - street.x0;
  const dz = street.z1 - street.z0;
  const length2 = dx * dx + dz * dz;
  const t = length2 ? Math.max(0, Math.min(1, ((x - street.x0) * dx + (z - street.z0) * dz) / length2)) : 0;
  return Math.hypot(x - street.x0 - dx * t, z - street.z0 - dz * t);
}

test('年份外城建筑坐标独立且全部落在平整台面并留岸线退距', () => {
  const occupied = new Set<string>();
  for (const building of YEAR_TOWN_NEIGHBORHOODS) {
    const district = YEAR_DISTRICTS.find((entry) => entry.id === (building.townId === 'island-2022' ? 'island-oldport' : 'island-starport'))!;
    const key = `${building.x},${building.z}`;
    assert.ok(!occupied.has(key), `${building.id} 与其他建筑共用中心 ${key}`);
    occupied.add(key);
    assert.ok(Math.abs(terrainHeight(building.x, building.z) - district.topY) < 0.01, `${building.id} 落在滩坡或自然起伏上`);
    const theta = Math.atan2(building.z - district.z, building.x - district.x);
    const edge = district.plateauR * islandRadiusScaleAt(district, theta);
    assert.ok(Math.hypot(building.x - district.x, building.z - district.z) < edge - 4, `${building.id} 缺岸线退距`);
    for (const street of district.grid?.streets ?? []) {
      assert.ok(distanceToStreet(building.x, building.z, street) > street.halfWidth + 2.2, `${building.id} 侵入 ${street.name ?? '街道'}`);
    }
  }
});
