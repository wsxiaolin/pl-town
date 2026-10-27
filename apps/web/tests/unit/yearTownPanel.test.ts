// T6R-b2：年份镇作品详情抽屉的懒加载路由 / 数据组装纯函数单测。
// gen-* 模块经 tsconfig.test-run 的 CommonJS 编译后，import() 字面量退化为
// 延迟 require——TOWN_LOADERS 可以在 Node 单测里真实执行（懒加载路由验证）。
import assert from 'node:assert/strict';
import test from 'node:test';
import { YEAR_TOWN_BUILDING_EXTRAS, YEAR_TOWN_NAMEPLATES } from '../../src/city/data/year-towns/gen-buildings';
import { TOWN_LOADERS } from '../../src/city/data/year-towns/gen-loaders';
import {
  COMMENT_PAGE_SIZE,
  READ_BODY_ACTION_PREFIX,
  SELECTED_COMMENT_PREVIEW,
  commentPages,
  findPackComments,
  findWorkDetail,
  formatCommentTime,
  parseReadBodyAction,
} from '../../src/adapters/ui/yearTownPanelController';
import type { YearTownCommentPackModule, YearWorkDetail } from '../../src/city/data/year-towns/_types';

test('read-body 动作前缀与解析互为逆运算', () => {
  assert.equal(READ_BODY_ACTION_PREFIX, 'read-body:');
  assert.equal(parseReadBodyAction(`${READ_BODY_ACTION_PREFIX}yt-w2022-01`), 'yt-w2022-01');
});

test('parseReadBodyAction 拒绝非本面板动作与残缺动作', () => {
  assert.equal(parseReadBodyAction('teleport:musichall'), null);
  assert.equal(parseReadBodyAction('read-body'), null);
  assert.equal(parseReadBodyAction(''), null);
});

test('findWorkDetail 按作品 ID 定位详情并干净落空', () => {
  const works: readonly YearWorkDetail[] = [
    { id: 'a', body: '甲', bodyExternal: false, comments: [] },
    { id: 'b', body: '乙', bodyExternal: true, comments: [], pack: '2022-1' },
  ];
  assert.equal(findWorkDetail(works, 'b')?.body, '乙');
  assert.equal(findWorkDetail(works, 'c'), undefined);
});

test('findPackComments 在评论包中按作品 ID 取全部评论', () => {
  const pack: YearTownCommentPackModule = {
    works: [{ id: 'a', comments: [{ nickname: '居民', content: '路过' }] }],
  };
  assert.equal(findPackComments(pack, 'a')?.length, 1);
  assert.equal(findPackComments(pack, 'zz'), undefined);
});

test('formatCommentTime 渲染 ISO 时间为日期，无效输入落空串', () => {
  assert.equal(formatCommentTime('2026-10-06T12:16:45+08:00'), '2026-10-06');
  assert.equal(formatCommentTime(undefined), '');
  assert.equal(formatCommentTime('not-a-date'), '');
});

test('全部评论分页遵循 50/批哨兵节奏', () => {
  assert.equal(COMMENT_PAGE_SIZE, 50);
  assert.equal(SELECTED_COMMENT_PREVIEW, 5);
  assert.equal(commentPages(0), 0);
  assert.equal(commentPages(50), 1);
  assert.equal(commentPages(51), 2);
  assert.equal(commentPages(200), 4);
});

test('全部 106 座作品建筑的路由键齐备（extras → 镇 loader → 铭牌）', () => {
  let works = 0;
  for (const [buildingId, extras] of Object.entries(YEAR_TOWN_BUILDING_EXTRAS)) {
    if (extras.kind !== 'work') continue;
    works += 1;
    assert.ok(TOWN_LOADERS[extras.year], `${buildingId} 缺少年份 ${extras.year} 的镇懒加载路由`);
    const nameplate = YEAR_TOWN_NAMEPLATES[buildingId];
    assert.ok(nameplate, `${buildingId} 缺少铭牌`);
    assert.equal(extras.workId, nameplate?.id, `${buildingId} 的 extras.workId 与铭牌 id 不一致`);
  }
  assert.equal(works, 106);
});

test('镇懒加载路由可真实解析 D 级模块（2022 样本：Top 作品 + 锁定作品）', async () => {
  const loader = TOWN_LOADERS[2022];
  assert.ok(loader);
  const module = await loader();
  assert.equal(module.year, 2022);
  const topWorkId = YEAR_TOWN_BUILDING_EXTRAS['yt-w2022-01']?.workId;
  assert.ok(topWorkId);
  const top = findWorkDetail(module.works, topWorkId);
  assert.ok(top, '盛夏镇第 1 名作品应存在于 D 级模块');
  assert.ok(top!.comments.length <= 20, 'D 级评论精选不超过 20 条');
  assert.ok(top!.pack, '评论多于 20 条的作品应带评论包键');
  const locked = findWorkDetail(module.works, '6256584dfa4ee80001c7104d');
  assert.equal(locked?.locked, true, 'rank 344（服务端 403）应带锁定标记');
});
