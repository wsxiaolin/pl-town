import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

// 乘坐交通冒烟（T7，GOAL#3）：站牌 interact → 10 站目的地面板 → 选邻镇发车
// → riding 推进 → 到站落点。走真实 UI 入口（interactInterestPoint 是用户点
// 站牌铭牌的等价路由），不经 _mini.transit.start 免面板捷径。
//
// 航段选环线邻站 2023→2024（直线 ~42u，最短可乘段）。时间预算按 c6R 教训：
// 设计速度 18u/s × 航程 + 软渲染帧率余量，断言在动作后立即采样。
test('station sign opens the destination panel and rides to the adjacent town', async ({ page }) => {
  test.setTimeout(240_000);
  stubCityWebSocket(page, { user: 'ride-tester' });
  await waitForCityReady(page, 'ride-tester');

  // ---- ① 站牌 interact：面板状态立即采样（教训#10：晚轮询会读到发车后的 false）----
  const panelState = await page.evaluate(() => {
    const ok = (window as any)._mini.interactInterestPoint('station-2023');
    const state = (window as any)._mini.transit.state();
    return { ok, phase: state.phase, panelStationId: state.panelStationId };
  });
  expect(panelState).toEqual({ ok: true, phase: 'panel', panelStationId: 'station-2023' });

  await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
  await expect(page.locator('#npcName')).toHaveText('回响镇站');
  await expect(page.locator('#npcRole')).toHaveText('群岛环线 · 磁悬浮');
  const options = page.locator('#npcOptions button');
  await expect(options).toHaveCount(10);
  // 10 站全部可选，当前站带标记且不可发车（点到自己没有意义）。
  const optionTexts = await options.allTextContents();
  expect(optionTexts.filter((text) => text.includes('（当前站）'))).toHaveLength(1);
  expect(optionTexts.some((text) => text.includes('微光镇站（'))).toBe(true);

  // ---- ② 选目的地发车：面板收起、phase 进 riding ----
  await page.locator('#npcOptions button', { hasText: '微光镇站（' }).click();
  await expect.poll(() => page.evaluate(() => (window as any)._mini.transit.state().phase), {
    timeout: 30_000,
  }).toBe('riding');
  // 发车即静默收面板（dismissNpc，不触发 onClose 结算）。
  await expect(page.locator('#npcOverlay')).not.toHaveClass(/open/);

  const trip = await page.evaluate(() => {
    const state = (window as any)._mini.transit.state();
    const station = (window as any)._mini.transit.stations().find((s: any) => s.id === state.toId);
    // 注意：这里不能再用 `to` 简写字段名——对象字面量重复键会让后者覆盖前者，
    // 之前正是它把 station 对象盖到了 toId 字符串上导致断言误报（T8 补验定位）。
    return { from: state.fromId, toId: state.toId, length: state.length as number, station };
  });
  expect(trip.from).toBe('station-2023');
  expect(trip.toId).toBe('station-2024');
  expect(trip.length).toBeGreaterThan(0);

  // ---- ③ 到站：预算＝设计速度×软渲染实际折损×路程＋余量，勿自造速度折算公式
  // （教训#10③：自造折算 52s<实际航程曾误报红；180s 给 UI 前置段留 60s）----
  await expect.poll(() => page.evaluate(() => (window as any)._mini.transit.state().phase), {
    timeout: 180_000,
  }).toBe('idle');

  const arrival = await page.evaluate(() => {
    const transit = (window as any)._mini.transit;
    const records = transit.history();
    const player = (window as any)._mini.player.position;
    return { records, player: { x: player.x, y: player.y, z: player.z } };
  });
  const record = arrival.records.at(-1);
  expect(record).toMatchObject({ fromId: 'station-2023', toId: 'station-2024' });
  const platform = trip.station;
  // 到站记录的落点即目标站月台（x/z 与站表一致，y 为月台地面高）。
  const arrivalPos = (record as any).arrival;
  expect(Math.hypot(arrivalPos.x - platform.platformX, arrivalPos.z - platform.platformZ)).toBeLessThan(1e-6);
  // 落点在目标站月台附近（宽 2.5u 容差）。
  const dx = arrival.player.x - platform.platformX;
  const dz = arrival.player.z - platform.platformZ;
  expect(Math.hypot(dx, dz)).toBeLessThan(2.5);
});

// 面板 × 关闭不发车（契约：乘 X 关闭面板则什么都不发生）。
test('closing the destination panel with the X does not dispatch the ride', async ({ page }) => {
  test.setTimeout(120_000);
  stubCityWebSocket(page, { user: 'ride-cancel-tester' });
  await waitForCityReady(page, 'ride-cancel-tester');

  expect(await page.evaluate(() => (window as any)._mini.interactInterestPoint('station-stargate'))).toBe(true);
  await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
  await page.locator('#npcClose').click();
  await expect(page.locator('#npcOverlay')).not.toHaveClass(/open/);
  const state = await page.evaluate(() => (window as any)._mini.transit.state());
  expect(state.phase).toBe('idle');
  expect(state.panelStationId).toBeNull();
});
