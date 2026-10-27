// T6R-b3：集中检索目录单测。三层口径：
// ① 纯函数（动作解析/检索过滤/馆藏排架/建筑反查）；
// ② 入口内容路由（7 档案馆 + 总目塔的对话选项层，作品/村碑不产生）；
// ③ GOAL#5 验收闭环——gen-index 千作索引覆盖 1000 条、年份分布与 by_year 汇总
//    一致、排架口径稳定，且每条作品在 D 级详情模块中可达（b2 抽屉 openWork
//    的数据前提）。gen-* 经 tsconfig.test-run 的 CommonJS 编译后 import() 字面量
//    退化为延迟 require，可在 Node 单测里真实执行（同 yearTownPanel.test.ts）。
import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_INDEX } from '../../src/city/data/year-towns/gen-index';
import { YEAR_TOWN_BUILDING_EXTRAS } from '../../src/city/data/year-towns/gen-buildings';
import { TOWN_LOADERS } from '../../src/city/data/year-towns/gen-loaders';
import {
  CATALOG_ACTION_PREFIX,
  CATALOG_PAGE_SIZE,
  YEAR_TOWN_CATALOG_CONTENT,
  archiveYearWorks,
  filterCatalogWorks,
  parseCatalogAction,
  yearTownCatalogEntryContent,
  yearTownWorkBuildingId,
} from '../../src/adapters/ui/yearTownCatalogController';

test('open-catalog 动作前缀与解析互为逆运算', () => {
  assert.equal(CATALOG_ACTION_PREFIX, 'open-catalog:');
  assert.equal(parseCatalogAction('open-catalog:yt-tower'), 'yt-tower');
  assert.equal(parseCatalogAction('open-catalog:yt-arch-2022'), 'yt-arch-2022');
  assert.equal(parseCatalogAction('read-body:yt-w2021-04'), null);
  assert.equal(parseCatalogAction('teleport:tavern'), null);
});

test('检索过滤：题名/作者不分大小写，年份与关键词可叠加，空口径=全量', () => {
  assert.equal(filterCatalogWorks(YEAR_TOWN_INDEX, '', null).length, 1000);
  const bySubject = filterCatalogWorks(YEAR_TOWN_INDEX, 'never gonna', null);
  assert.ok(bySubject.length >= 1, '题名检索应命中 Never Gonna Give You Up');
  assert.equal(filterCatalogWorks(YEAR_TOWN_INDEX, 'NEVER GONNA', null).length, bySubject.length, '检索不分大小写');
  const byAuthor = filterCatalogWorks(YEAR_TOWN_INDEX, '月满西楼', null);
  assert.ok(byAuthor.length >= 1, '作者检索应命中月满西楼');
  const combined = filterCatalogWorks(YEAR_TOWN_INDEX, '条例', 2022);
  assert.ok(combined.length >= 1, '年份+题名叠加应命中 2022 管理条例');
  for (const work of combined) {
    assert.equal(work.year, 2022);
    assert.ok(work.subject.toLowerCase().includes('条例') || work.author.toLowerCase().includes('条例'));
  }
  assert.equal(filterCatalogWorks(YEAR_TOWN_INDEX, '绝不存在的检索词qzwxec', null).length, 0);
  assert.equal(filterCatalogWorks(YEAR_TOWN_INDEX, ' never gonna ', null).length, bySubject.length, '关键词应容忍首尾空白');
});

test('镇馆藏视图：只含该年全量，且按镇内名次（热度）升序排架', () => {
  const shelves = archiveYearWorks(YEAR_TOWN_INDEX, 2022);
  assert.equal(shelves.length, 217);
  assert.ok(shelves.every((work) => work.year === 2022));
  for (let i = 1; i < shelves.length; i += 1) {
    const prev = shelves[i - 1]!;
    const cur = shelves[i]!;
    assert.ok(prev.townRank <= cur.townRank, `第 ${i} 位排架应不降序`);
  }
  assert.equal(archiveYearWorks(YEAR_TOWN_INDEX, 2019).length, 2);
});

test('千作索引完整：1000 条、年份分布与 by_year 汇总一致、排架口径稳定', () => {
  assert.equal(YEAR_TOWN_INDEX.length, 1000);
  const byYear = new Map<number, number>();
  for (const work of YEAR_TOWN_INDEX) byYear.set(work.year, (byYear.get(work.year) ?? 0) + 1);
  assert.deepEqual([...byYear.entries()].sort(([a], [b]) => a - b), [
    [2019, 2], [2020, 75], [2021, 147], [2022, 217], [2023, 202], [2024, 170], [2025, 128], [2026, 59],
  ]);
  for (let i = 1; i < YEAR_TOWN_INDEX.length; i += 1) {
    const prev = YEAR_TOWN_INDEX[i - 1]!;
    const cur = YEAR_TOWN_INDEX[i]!;
    if (prev.year === cur.year) assert.ok(prev.townRank <= cur.townRank, '同年应按镇内名次排架');
    else assert.ok(prev.year < cur.year, '总目应按年份升序分架');
  }
  assert.equal(CATALOG_PAGE_SIZE, 50);
  assert.equal(Math.ceil(YEAR_TOWN_INDEX.length / CATALOG_PAGE_SIZE), 20, '千作总目应为 20 页');
});

test('作品 → 建筑反查：106 座作品建筑各回其位，未入选作品查无建筑', () => {
  let workBuildings = 0;
  for (const [buildingId, extras] of Object.entries(YEAR_TOWN_BUILDING_EXTRAS)) {
    if (extras.kind !== 'work' || !extras.workId) continue;
    workBuildings += 1;
    assert.equal(yearTownWorkBuildingId(extras.workId), buildingId);
    assert.ok(YEAR_TOWN_INDEX.some((work) => work.id === extras.workId), '作品建筑应对应索引内的作品');
  }
  assert.equal(workBuildings, 106);
  assert.equal(yearTownWorkBuildingId('no-such-work'), undefined);
});

test('入口内容：7 档案馆 + 总目塔均有目录选项与告辞出口，作品/村碑不产生', () => {
  assert.deepEqual(Object.keys(YEAR_TOWN_CATALOG_CONTENT).sort(), [
    'yt-arch-2020', 'yt-arch-2021', 'yt-arch-2022', 'yt-arch-2023', 'yt-arch-2024', 'yt-arch-2025', 'yt-arch-2026', 'yt-tower',
  ]);
  for (const [id, content] of Object.entries(YEAR_TOWN_CATALOG_CONTENT)) {
    const node = content.dialogTree?.[0];
    assert.ok(node, `${id} 应有对话节点`);
    const catalogOption = node?.options.find((option) => option.action?.startsWith(CATALOG_ACTION_PREFIX));
    assert.ok(catalogOption, `${id} 应有目录入口选项`);
    assert.equal(parseCatalogAction(catalogOption?.action ?? ''), id, '动作载荷应为该建筑自身');
    assert.equal(catalogOption?.next, null, '选中目录入口即收对话');
    assert.ok(node?.options.some((option) => option.text === '告辞'), `${id} 应保留告辞出口`);
  }
  assert.equal(yearTownCatalogEntryContent('yt-w2021-04'), undefined, '作品建筑不走目录入口');
  assert.equal(yearTownCatalogEntryContent('yt-stele-2019'), undefined, '村碑不走目录入口');
});

test('GOAL#5 闭环：千作索引每一条在 D 级详情模块中可达（openWork 数据前提）', async () => {
  const detailIds = new Set<string>();
  for (const loader of Object.values(TOWN_LOADERS)) {
    const module = await loader();
    for (const work of module.works) detailIds.add(work.id);
  }
  assert.equal(detailIds.size, 1000, '八个镇 D 级模块合计应覆盖全部 1000 条');
  const missing = YEAR_TOWN_INDEX.filter((work) => !detailIds.has(work.id));
  assert.deepEqual(missing.map((work) => work.subject), [], '索引作品应全部可开卷');
});
