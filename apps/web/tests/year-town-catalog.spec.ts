import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

// 档案馆/总目塔检索冒烟（T7，GOAL#5）：建筑对话 → 目录抽屉 → 检索 → 条目
// → 正文/评论详情抽屉。全静态数据（gen-index 懒加载本地模块），零实时 API。
// 入口走用户路径：openBuildingDialog 是走近建筑点铭牌的等价路由，选项层
// （#npcOptions）→ open-catalog 动作 → 目录，与酒馆/神社同款既有 DOM 范式。

test('tower catalog search narrows the index and opens the work drawer with body and comments', async ({ page }) => {
  test.setTimeout(150_000);
  stubCityWebSocket(page, { user: 'catalog-tower-tester' });
  await waitForCityReady(page, 'catalog-tower-tester');

  // ---- ① 进千作总目塔：铭牌对话选项层 ----
  expect(await page.evaluate(() => (window as any)._mini.openBuildingDialog('yt-tower'))).toBe(true);
  await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
  await expect(page.locator('#npcName')).toHaveText('千作总目塔');
  await page.locator('#npcOptions button', { hasText: '检索千作总目' }).click();

  // ---- ② 目录抽屉：千作总目（1000 条、50/页分页 + 检索）----
  const catalog = page.locator('.ytc-panel');
  await expect(catalog).toHaveClass(/open/, { timeout: 20_000 });
  await expect(catalog.locator('.ytc-kicker')).toHaveText('黑洞区历史热门 Top1000');
  await expect(catalog.locator('.ytc-head-text h2')).toHaveText('千作总目');
  await expect(catalog.locator('.ytc-meta')).toContainText('2019–2026 全收录');
  await expect(catalog.locator('.ytc-row')).toHaveCount(50, { timeout: 20_000 });
  await expect(catalog.locator('.ytc-page-info')).toContainText('第 1 / 20 页'); // 1000 条 / 50 每页

  // ---- ③ 检索「管理条例」：索引收窄到 3 条命中（gen-index 数据事实）----
  await catalog.locator('.ytc-search').fill('管理条例');
  const subjects = catalog.locator('.ytc-row .ytc-subject');
  await expect(catalog.locator('.ytc-page-info')).toContainText('共 3 条');
  await expect(subjects).toHaveText([
    '《管理条例》', '《管理条例》（new）', '管理条例[新]',
  ]);
  // 行内带年份/作者/热度元信息（总目塔模式）。
  await expect(catalog.locator('.ytc-row .ytc-row-meta').first()).toContainText(/20\d\d · .+ · 热度/);

  // ---- ④ 打开首条（2019 rank 14《管理条例》）：正文 + 评论精选抽屉 ----
  await subjects.first().click();
  const drawer = page.locator('#yearTownPanel');
  await expect(drawer).toHaveClass(/open/);
  await expect(drawer.locator('#ytpTitle')).toContainText('管理条例');
  // 正文分片渲染（详情模块懒加载），首屏至少一个整片正文。
  await expect
    .poll(async () => (await drawer.locator('.ytp-body').textContent())?.length ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(100);
  // 评论精选：标题 + 昵称 + 内容齐全。
  await expect(drawer.locator('.ytp-section-title').last()).toHaveText('评论精选');
  await expect(drawer.locator('.ytp-comment').first()).toBeVisible({ timeout: 30_000 });
  await expect(drawer.locator('.ytp-comment-name').first()).not.toBeEmpty();
  await expect(drawer.locator('.ytp-comment').first()).toContainText(/\S/);

  // ---- ⑤ 收起详情抽屉，目录仍在（ytp 在上层，Esc 先关 ytp）----
  await drawer.locator('#ytpClose').click();
  await expect(drawer).not.toHaveClass(/open/);
  await expect(catalog).toHaveClass(/open/);
  await catalog.locator('.ytc-close').click();
  await expect(catalog).not.toHaveClass(/open/);
});

test('year archive opens town-shelved works and the drawer without search', async ({ page }) => {
  test.setTimeout(150_000);
  stubCityWebSocket(page, { user: 'catalog-arch-tester' });
  await waitForCityReady(page, 'catalog-arch-tester');

  // ---- ① 进盛夏镇档案馆：选项层走「翻阅馆藏目录」----
  expect(await page.evaluate(() => (window as any)._mini.openBuildingDialog('yt-arch-2022'))).toBe(true);
  await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
  await expect(page.locator('#npcName')).toHaveText('盛夏镇档案馆');
  await page.locator('#npcOptions button', { hasText: '翻阅馆藏目录' }).click();

  // ---- ② 镇档案馆模式：按年过滤 + 镇内名次排架 ----
  const catalog = page.locator('.ytc-panel');
  await expect(catalog).toHaveClass(/open/);
  await expect(catalog.locator('.ytc-head-text h2')).toHaveText('2022 年馆藏');
  await expect(catalog.locator('.ytc-kicker')).toHaveText('2022·盛夏镇 · 镇档案馆');
  await expect(catalog.locator('.ytc-year')).toBeHidden();
  await expect(catalog.locator('.ytc-row')).toHaveCount(50, { timeout: 20_000 });
  await expect(catalog.locator('.ytc-row .ytc-rank').first()).toHaveText(/镇内 \d+/);
  await expect(catalog.locator('.ytc-page-info')).toContainText('第 1 / 5 页'); // 217 条 / 50 每页

  // ---- ③ 无检索直接开镇内第 1 名《管理条例》（new）：正文 + 评论 ----
  await catalog.locator('.ytc-row').first().click();
  const drawer = page.locator('#yearTownPanel');
  await expect(drawer).toHaveClass(/open/);
  await expect(drawer.locator('#ytpTitle')).toHaveText('《管理条例》（new）');
  await expect(drawer.locator('#ytpKicker')).toContainText('全站第');
  await expect
    .poll(async () => (await drawer.locator('.ytp-body').textContent())?.length ?? 0, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(100);
  await expect(drawer.locator('.ytp-comment').first()).toBeVisible({ timeout: 30_000 });
});
