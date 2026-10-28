import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

// 纪念名录/总目塔检索冒烟：建筑对话 → 名录抽屉 → 检索 → 纪念设施面板。
// 全静态数据（gen-index 本地模块），零实时 API。
// 入口走用户路径：openBuildingDialog 是走近建筑点铭牌的等价路由，选项层
// （#npcOptions）→ open-catalog 动作 → 目录，与酒馆/神社同款既有 DOM 范式。

test('tower catalog searches 106 memorial facilities and opens a memorial note', async ({ page }) => {
  test.setTimeout(150_000);
  stubCityWebSocket(page, { user: 'catalog-tower-tester' });
  await waitForCityReady(page, 'catalog-tower-tester');

  // ---- ① 进千作总目塔：铭牌对话选项层 ----
  expect(await page.evaluate(() => (window as any)._mini.openBuildingDialog('yt-tower'))).toBe(true);
  await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
  await expect(page.locator('#npcName')).toHaveText('千作总目塔');
  await page.locator('#npcOptions button', { hasText: '翻阅千作总目' }).click();

  // ---- ② 千作总目：106 座纪念设施，20 座一页 ----
  const catalog = page.locator('.ytc-panel');
  await expect(catalog).toHaveClass(/open/, { timeout: 20_000 });
  await expect(catalog.locator('.ytc-kicker')).toHaveText('逐年立册');
  await expect(catalog.locator('.ytc-head-text h2')).toHaveText('千作总目');
  await expect(catalog.locator('.ytc-meta')).toContainText('2019–2026');
  await expect(catalog.locator('.ytc-row')).toHaveCount(20, { timeout: 20_000 });
  await expect(catalog.locator('.ytc-page-info')).toContainText('第 1 / 6 页 · 共 106 座');

  // ---- ③ 按设施名检索，结果只保留新律法厅 ----
  await catalog.locator('.ytc-search').fill('新律法厅');
  const subjects = catalog.locator('.ytc-row .ytc-subject');
  await expect(subjects).toHaveCount(1);
  await expect(subjects).toHaveText('新律法厅');

  // ---- ④ 打开设施，查看纪念说明 ----
  await subjects.first().click();
  const drawer = page.locator('#yearTownPanel');
  await expect(drawer).toHaveClass(/open/);
  await expect(drawer.locator('#ytpTitle')).toHaveText('新律法厅');
  await expect(drawer.locator('.ytp-section-title')).toHaveText('纪念说明');
  await expect(drawer.locator('.ytp-body')).toContainText('律法碑廊的续篇');

  // ---- ⑤ 收起详情抽屉，目录仍在（ytp 在上层，Esc 先关 ytp）----
  await drawer.locator('#ytpClose').click();
  await expect(drawer).not.toHaveClass(/open/);
  await expect(catalog).toHaveClass(/open/);
  await catalog.locator('.ytc-close').click();
  await expect(catalog).not.toHaveClass(/open/);
});

test('year memorial archive opens its first facility without search', async ({ page }) => {
  test.setTimeout(150_000);
  stubCityWebSocket(page, { user: 'catalog-arch-tester' });
  await waitForCityReady(page, 'catalog-arch-tester');

  // ---- ① 进盛夏镇纪念名录 ----
  expect(await page.evaluate(() => (window as any)._mini.openBuildingDialog('yt-arch-2022'))).toBe(true);
  await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
  await expect(page.locator('#npcName')).toHaveText('盛夏镇纪念名录');
  await page.locator('#npcOptions button', { hasText: '翻阅纪念名录' }).click();

  // ---- ② 按年份展示 20 座设施 ----
  const catalog = page.locator('.ytc-panel');
  await expect(catalog).toHaveClass(/open/);
  await expect(catalog.locator('.ytc-head-text h2')).toHaveText('2022 年立起的设施');
  await expect(catalog.locator('.ytc-kicker')).toHaveText('2022·盛夏镇 · 纪念名录');
  await expect(catalog.locator('.ytc-year')).toBeHidden();
  await expect(catalog.locator('.ytc-row')).toHaveCount(20, { timeout: 20_000 });
  await expect(catalog.locator('.ytc-row .ytc-rank').first()).toHaveText(/镇内 \d+/);

  // ---- ③ 无检索直接打开镇内第一座设施 ----
  await catalog.locator('.ytc-row').first().click();
  const drawer = page.locator('#yearTownPanel');
  await expect(drawer).toHaveClass(/open/);
  await expect(drawer.locator('#ytpTitle')).toHaveText('新律法厅');
  await expect(drawer.locator('#ytpKicker')).toContainText('2022·盛夏镇');
  await expect(drawer.locator('.ytp-body')).toContainText('律法碑廊的续篇');
});
