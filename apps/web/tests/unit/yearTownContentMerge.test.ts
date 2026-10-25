import assert from 'node:assert/strict';
import test from 'node:test';
import { BUILDING_CONTENT } from '../../src/city/data/buildings';
import { mergeBuildingContent, YEAR_TOWN_BUILDING_CONTENT } from '../../src/city/yearTownBuildings';
import { YEAR_TOWN_CATALOG_CONTENT } from '../../src/adapters/ui/yearTownCatalogController';

test('主城与年份镇建筑内容键不重叠', () => {
  for (const id of [...Object.keys(YEAR_TOWN_BUILDING_CONTENT), ...Object.keys(YEAR_TOWN_CATALOG_CONTENT)]) {
    assert.ok(!(id in BUILDING_CONTENT), `年份镇内容键 ${id} 与主城冲突`);
  }
});

test('合流冲突时主城内容优先', () => {
  const main = { name: 'main', slogan: '', dialog: [] };
  const extra = { name: 'year', slogan: '', dialog: [] };
  const merged = mergeBuildingContent({ shared: main }, { shared: extra });
  assert.equal(merged.shared, main);
});
