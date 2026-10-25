// 年份镇纪念设施面板单测（设计 §7.1 修订：取代作品详情抽屉）。
// 口径：动作解析、设施视图组装、便签交互文案、纪念名录按年份取。
import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_BUILDING_EXTRAS } from '../../src/city/data/year-towns/gen-buildings';
import { YEAR_TOWN_MEMORIAL_INDEX } from '../../src/city/data/year-towns/gen-index';
import {
  FAMILY_LABELS,
  READ_BODY_ACTION_PREFIX,
  memorialIndexForYear,
  memorialOfBuilding,
  memorialViewOfBuilding,
  noteLabelOf,
  parseReadBodyAction,
} from '../../src/adapters/ui/yearTownPanelController';

test('read-body 动作前缀与解析互为逆运算', () => {
  assert.equal(READ_BODY_ACTION_PREFIX, 'read-body:');
  assert.equal(parseReadBodyAction(`${READ_BODY_ACTION_PREFIX}yt-w2022-01`), 'yt-w2022-01');
});

test('parseReadBodyAction 拒绝非本面板动作与残缺动作', () => {
  assert.equal(parseReadBodyAction('teleport:musichall'), null);
  assert.equal(parseReadBodyAction('read-body'), null);
  assert.equal(parseReadBodyAction(''), null);
});

test('设施视图：建筑 → 设施名/导语/年份/镇名，未知建筑落空', () => {
  const view = memorialViewOfBuilding('yt-w2020-01');
  assert.ok(view, '启明镇 #1 应有设施视图');
  assert.equal(view?.facility, '议事厅');
  assert.ok(view?.note.length);
  assert.equal(view?.year, 2020);
  assert.ok(view?.townLabel.includes('启明镇'), '镇名应包含启明镇');
  assert.equal(memorialViewOfBuilding('no-such-building'), undefined);
});

test('纪念名录建筑有导语视图（7 座名录 + 总目塔）', () => {
  for (const id of ['yt-arch-2020', 'yt-arch-2026', 'yt-tower']) {
    const view = memorialViewOfBuilding(id);
    assert.ok(view, `${id} 应有地标导语视图`);
    assert.ok(view?.note.length, `${id} 导语不应为空`);
  }
});

test('设施视图不含社区统计数据（无热度/评论/浏览量字段）', () => {
  const view = memorialViewOfBuilding('yt-w2022-01');
  assert.ok(view);
  const keys = Object.keys(view!).sort();
  assert.deepEqual(keys, ['facility', 'family', 'key', 'note', 'noteKind', 'townLabel', 'year'].filter((k) => k in view!));
});

test('memorialOfBuilding 返回手写目录条目，地标建筑返回 undefined', () => {
  const memorial = memorialOfBuilding('yt-w2023-04');
  assert.ok(memorial);
  assert.equal(memorial?.facility, '往生堂');
  assert.equal(memorialOfBuilding('yt-arch-2022'), undefined);
});

test('便签交互文案：四种交互各有动作与完成反馈，未知种类落空', () => {
  for (const kind of ['stamp', 'lamp', 'leaving', 'capsule']) {
    const label = noteLabelOf(kind);
    assert.ok(label, `${kind} 应有文案`);
    assert.ok(label!.action.length);
    assert.ok(label!.done.length);
  }
  assert.equal(noteLabelOf(undefined), undefined);
  assert.equal(noteLabelOf('no-such-kind'), undefined);
});

test('设施族中文名覆盖全部出现的设施族', () => {
  const used = new Set(YEAR_TOWN_MEMORIAL_INDEX.map((entry) => entry.family));
  for (const family of used) {
    assert.ok(FAMILY_LABELS[family], `设施族 ${family} 缺中文名`);
  }
});

test('按年份取纪念名录：条数与设计表一致', () => {
  assert.equal(memorialIndexForYear(2019).length, 2);
  assert.equal(memorialIndexForYear(2022).length, 20);
  assert.equal(memorialIndexForYear(2026).length, 12);
  assert.equal(memorialIndexForYear(1999).length, 0);
});

test('每座设施建筑都能解析出面板视图（106 座无遗漏）', () => {
  let count = 0;
  for (const [buildingId, extras] of Object.entries(YEAR_TOWN_BUILDING_EXTRAS)) {
    if (extras.kind !== 'work') continue;
    count += 1;
    assert.ok(memorialViewOfBuilding(buildingId), `${buildingId} 应能打开纪念面板`);
  }
  assert.equal(count, 106);
});
