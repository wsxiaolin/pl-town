import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWNS } from '../../src/city/data/year-towns/towns';
import { YEAR_TOWN_LAYOUT_CONFIGS } from '../../src/city/data/year-towns/districtLayout';
import { YEAR_TOWN_NPCS } from '../../src/city/data/year-towns/yearTownNpcs';

// 年份镇 NPC 落位审计：坐标随 districtLayout 迁移后，必须仍在所属片区台面内、
// 与建筑保持净距，避免重新落回海面或别镇台面（T7 审查发现 17/18 名滞留旧岛）。

test('年份镇 NPC：全部落在所属片区台面内', () => {
  for (const npc of YEAR_TOWN_NPCS) {
    const year = Number(npc.id.slice(2, 6));
    const town = YEAR_TOWNS.find((item) => item.year === year);
    assert.ok(town, `${npc.id} 找不到 ${year} 年片区`);
    for (const [label, coord] of [['home', npc.home], ['work', npc.work]] as const) {
      assert.ok(coord, `${npc.id}.${label} 缺失坐标`);
      const dist = Math.hypot(coord[0]! - town!.x, coord[1]! - town!.z);
      assert.ok(
        dist <= town!.plateauR - 2.2,
        `${npc.id}.${label} (${coord[0]!},${coord[1]!}) 距 ${town!.id} 中心 ${dist.toFixed(2)} 超出台缘`,
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
