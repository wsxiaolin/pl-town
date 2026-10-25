// 年份群岛纪念名录单测（设计 §7.1 修订：作品 → 城市纪念设施）。
// 口径：
// ① 纯函数（动作解析/检索过滤/名录取景/设施反查）；
// ② 入口内容路由（7 座纪念名录 + 总目塔，设施/村碑不产生）；
// ③ 名录完整性——106 座设施逐条可查、设施名不复述作品标题、
//    且不含任何作品原文/评论/热度统计字段。
import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_MEMORIAL_INDEX } from '../../src/city/data/year-towns/gen-index';
import { YEAR_TOWN_BUILDING_EXTRAS } from '../../src/city/data/year-towns/gen-buildings';
import { YEAR_TOWN_MEMORIALS, YEAR_TOWN_MEMORIAL_BY_KEY } from '../../src/city/data/year-towns/yearTownMemorials';
import {
  CATALOG_ACTION_PREFIX,
  CATALOG_PAGE_SIZE,
  YEAR_TOWN_CATALOG_CONTENT,
  archiveYearMemorials,
  filterMemorials,
  parseCatalogAction,
  yearTownCatalogEntryContent,
  yearTownMemorialBuildingId,
} from '../../src/adapters/ui/yearTownCatalogController';

test('open-catalog 动作前缀与解析互为逆运算', () => {
  assert.equal(CATALOG_ACTION_PREFIX, 'open-catalog:');
  assert.equal(parseCatalogAction('open-catalog:yt-tower'), 'yt-tower');
  assert.equal(parseCatalogAction('open-catalog:yt-arch-2022'), 'yt-arch-2022');
  assert.equal(parseCatalogAction('read-body:yt-w2021-04'), null);
  assert.equal(parseCatalogAction('teleport:tavern'), null);
});

test('检索过滤：设施名/导语/设施族可检索，年份可叠加，空口径=全量', () => {
  assert.equal(filterMemorials(YEAR_TOWN_MEMORIAL_INDEX, '', null).length, 106);
  const byFacility = filterMemorials(YEAR_TOWN_MEMORIAL_INDEX, '碑廊', null);
  assert.ok(byFacility.length >= 1, '设施名检索应命中律法碑廊');
  const byNote = filterMemorials(YEAR_TOWN_MEMORIAL_INDEX, '会客厅', null);
  assert.ok(byNote.length >= 1, '导语检索应命中会客厅类设施');
  const byFamily = filterMemorials(YEAR_TOWN_MEMORIAL_INDEX, '律法与制度', null);
  assert.ok(byFamily.length >= 1, '设施族中文名应可检索');
  const combined = filterMemorials(YEAR_TOWN_MEMORIAL_INDEX, '碑', 2022);
  for (const entry of combined) assert.equal(entry.year, 2022);
  assert.equal(filterMemorials(YEAR_TOWN_MEMORIAL_INDEX, '绝不存在的检索词qzwxec', null).length, 0);
  assert.equal(
    filterMemorials(YEAR_TOWN_MEMORIAL_INDEX, ' 碑廊 ', null).length,
    filterMemorials(YEAR_TOWN_MEMORIAL_INDEX, '碑廊', null).length,
    '关键词应容忍首尾空白',
  );
});

test('镇纪念名录取景：只含该年设施，按镇内名次升序', () => {
  const shelves = archiveYearMemorials(YEAR_TOWN_MEMORIAL_INDEX, 2022);
  assert.equal(shelves.length, 20);
  assert.ok(shelves.every((entry) => entry.year === 2022));
  for (let i = 1; i < shelves.length; i += 1) {
    assert.ok(shelves[i - 1]!.townRank <= shelves[i]!.townRank, `第 ${i} 位排架应不降序`);
  }
  assert.equal(archiveYearMemorials(YEAR_TOWN_MEMORIAL_INDEX, 2019).length, 2);
});

test('纪念名录完整：106 座设施、年份分布与设计表一致', () => {
  assert.equal(YEAR_TOWN_MEMORIAL_INDEX.length, 106);
  assert.equal(YEAR_TOWN_MEMORIALS.length, 106);
  const byYear = new Map<number, number>();
  for (const entry of YEAR_TOWN_MEMORIAL_INDEX) byYear.set(entry.year, (byYear.get(entry.year) ?? 0) + 1);
  assert.deepEqual([...byYear.entries()].sort(([a], [b]) => a - b), [
    [2019, 2], [2020, 10], [2021, 16], [2022, 20], [2023, 18], [2024, 16], [2025, 12], [2026, 12],
  ]);
  assert.equal(CATALOG_PAGE_SIZE, 20);
});

test('名录不含作品原始数据：无正文/评论/热度/浏览量字段', () => {
  for (const entry of YEAR_TOWN_MEMORIAL_INDEX) {
    const keys = Object.keys(entry).sort();
    assert.deepEqual(keys, ['facility', 'family', 'key', 'note', 'townId', 'townRank', 'year']);
    assert.equal(typeof entry.note, 'string');
    assert.ok(entry.note.length > 0, `${entry.key} 应有纪念导语`);
    // 导语是改写文案，不是作品正文搬运：不应出现社区统计数据表述。
    assert.ok(!/热度\s*\d|浏览量\s*\d|\d+\s*条评论/.test(entry.note), `${entry.key} 导语不应提及社区统计数据`);
  }
});

test('设施名不复述作品标题（纪念设施必须经过改写）', () => {
  for (const entry of YEAR_TOWN_MEMORIAL_INDEX) {
    const memorial = YEAR_TOWN_MEMORIAL_BY_KEY[entry.key];
    assert.ok(memorial, `${entry.key} 应在手写目录内`);
    assert.ok(!/[《》「」]/.test(entry.facility), `${entry.key} 设施名不应带书名号`);
    assert.ok(entry.facility.length <= 12, `${entry.key} 设施名应简短`);
  }
});

test('设施 → 建筑反查：106 座建筑各回其位，未知设施查无建筑', () => {
  let memorialBuildings = 0;
  for (const [buildingId, extras] of Object.entries(YEAR_TOWN_BUILDING_EXTRAS)) {
    if (extras.kind !== 'work' || !extras.memorialKey) continue;
    memorialBuildings += 1;
    assert.equal(yearTownMemorialBuildingId(extras.memorialKey), buildingId);
    assert.ok(YEAR_TOWN_MEMORIAL_BY_KEY[extras.memorialKey], '建筑应指向目录内设施');
  }
  assert.equal(memorialBuildings, 106);
  assert.equal(yearTownMemorialBuildingId('no-such-memorial'), undefined);
});

test('入口内容：7 座纪念名录 + 总目塔均有名录选项与告辞出口，设施/村碑不产生', () => {
  assert.deepEqual(Object.keys(YEAR_TOWN_CATALOG_CONTENT).sort(), [
    'yt-arch-2020', 'yt-arch-2021', 'yt-arch-2022', 'yt-arch-2023', 'yt-arch-2024', 'yt-arch-2025', 'yt-arch-2026', 'yt-tower',
  ]);
  for (const [id, content] of Object.entries(YEAR_TOWN_CATALOG_CONTENT)) {
    const node = content.dialogTree?.[0];
    assert.ok(node, `${id} 应有对话节点`);
    const catalogOption = node?.options.find((option) => option.action?.startsWith(CATALOG_ACTION_PREFIX));
    assert.ok(catalogOption, `${id} 应有名录入口选项`);
    assert.equal(parseCatalogAction(catalogOption?.action ?? ''), id, '动作载荷应为该建筑自身');
    assert.equal(catalogOption?.next, null, '选中名录入口即收对话');
    assert.ok(node?.options.some((option) => option.text === '告辞'), `${id} 应保留告辞出口`);
  }
  assert.equal(yearTownCatalogEntryContent('yt-w2021-04'), undefined, '设施建筑不走名录入口');
  assert.equal(yearTownCatalogEntryContent('yt-stele-2019'), undefined, '村碑不走名录入口');
});
