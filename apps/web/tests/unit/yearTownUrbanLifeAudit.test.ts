import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_BUILDING_DEFS } from '../../src/city/yearTownBuildings';
import { YEAR_TOWN_URBAN_LIFE } from '../../src/city/data/year-towns/urbanLife';
import { TRANSIT_STATIONS } from '../../src/city/data/year-towns/transit';

// 生活道具审计（红队复核发现的规则缺口）：道具与建筑此前互不检查，
// wave2 重排落位后出现过「摊位与建筑同坐标」「路灯在楼体足印内」。
// 规则：物理道具（含长椅/摊位/灯/树）距任何年份建筑中心 ≥3.4u
// （最大 footprint 5.5/2=2.75 + 道具自身半径 ~0.65）；距车站月台中心
// ≥7.5u（pad 半径 6.8，站台上不放街具）。

test('生活道具不与年份建筑足印重叠', () => {
  const conflicts: string[] = [];
  for (const prop of YEAR_TOWN_URBAN_LIFE) {
    for (const building of YEAR_TOWN_BUILDING_DEFS) {
      const distance = Math.hypot(prop.x - building.x!, prop.z - building.z!);
      if (distance < 3.4) {
        conflicts.push(`${prop.kind} (${prop.x},${prop.z}) 距建筑 ${building.id} ${distance.toFixed(2)}u < 3.4`);
      }
    }
  }
  assert.deepEqual(conflicts, [], conflicts.join('\n'));
});

test('生活道具不落在车站月台内', () => {
  const conflicts: string[] = [];
  for (const prop of YEAR_TOWN_URBAN_LIFE) {
    for (const station of TRANSIT_STATIONS) {
      const distance = Math.hypot(prop.x - station.x, prop.z - station.z);
      if (distance < 7.5) {
        conflicts.push(`${prop.kind} (${prop.x},${prop.z}) 距车站 ${station.id} ${distance.toFixed(2)}u，侵入月台`);
      }
    }
  }
  assert.deepEqual(conflicts, [], conflicts.join('\n'));
});
