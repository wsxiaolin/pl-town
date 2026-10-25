import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_BUILDING_DEFS } from '../../src/city/data/year-towns/yearTownBuildings';
import { terrainHeight } from '../../src/city/data/terrain/heightfield/terrainHeight';

// 地基高度单一事实源：建筑 baseY 必须与 terrainHeight 同采样器一致，
// 防止岛缘 / 枢纽过渡带的高度聚合变化让建筑地基与玩家落点漂移。
test('年份建筑 baseY 与 terrainHeight 一致', () => {
  for (const def of YEAR_TOWN_BUILDING_DEFS) {
    const expected = Math.round(terrainHeight(def.x!, def.z!) * 100) / 100;
    assert.equal(def.baseY, expected, `${def.id} baseY 漂移`);
    assert.ok(Number.isFinite(def.baseY), `${def.id} baseY 非有限值`);
  }
});
