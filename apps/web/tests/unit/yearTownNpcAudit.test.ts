import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_ISLAND_SPECS } from '../../src/city/data/year-towns/towns';
import { islandSurfaceYAt } from '../../src/city/data/terrain/heightfield/islandField';
import { YEAR_TOWN_LAYOUT_CONFIGS } from '../../src/city/yearTownBuildings';
import { YEAR_TOWN_NPCS } from '../../src/city/data/year-towns/yearTownNpcs';

// 年份镇 NPC 落位审计：城市重造后「镇」是大岛上的年份街区，NPC 归属的
// 空间约束升级为岛基——必须落在所属岛的平整台面内（islandSurfaceYAt ===
// topY，杜绝落回海面/滩坡/别岛），且距岛心不超过台缘安全半径。

const YEAR_ISLAND_ID: Readonly<Record<number, string>> = {
  2019: 'island-2019',
  2020: 'island-oldport', 2021: 'island-oldport', 2022: 'island-oldport', 2023: 'island-oldport',
  2024: 'island-starport', 2025: 'island-starport', 2026: 'island-starport',
};

test('年份镇 NPC：全部落在所属岛台面内', () => {
  for (const npc of YEAR_TOWN_NPCS) {
    const year = Number(npc.id.slice(2, 6));
    const island = YEAR_ISLAND_SPECS.find((item) => item.id === YEAR_ISLAND_ID[year]);
    assert.ok(island, `${npc.id} 找不到 ${year} 所属岛`);
    for (const [label, coord] of [['home', npc.home], ['work', npc.work]] as const) {
      assert.ok(coord, `${npc.id}.${label} 缺失坐标`);
      const dist = Math.hypot(coord[0]! - island.x, coord[1]! - island.z);
      assert.ok(
        dist <= island.plateauR - 2.2,
        `${npc.id}.${label} (${coord[0]!},${coord[1]!}) 距 ${island.id} 中心 ${dist.toFixed(2)} 超出台缘`,
      );
      const surface = islandSurfaceYAt(coord[0]!, coord[1]!);
      assert.ok(
        surface !== null && Math.abs(surface - island.topY) < 1e-6,
        `${npc.id}.${label} (${coord[0]!},${coord[1]!}) 未落在所属岛平整台面（高度 ${surface?.toFixed(2)}）`,
      );
    }
  }
});

test('年份镇 NPC：与布局后的建筑保持净距', () => {
  const conflicts: string[] = [];
  for (const npc of YEAR_TOWN_NPCS) {
    for (const building of YEAR_TOWN_LAYOUT_CONFIGS) {
      const dist = Math.hypot(npc.home[0]! - building.x!, npc.home[1]! - building.z!);
      if (dist < 2.9) conflicts.push(`${npc.id} 距建筑 ${building.id} 仅 ${dist.toFixed(2)}`);
    }
  }
  assert.deepEqual(conflicts, [], conflicts.join('\n'));
});
