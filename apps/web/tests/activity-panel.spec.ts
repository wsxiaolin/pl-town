import { expect, test, type Page } from '@playwright/test';
import { seedCityStorage, waitForCityBooted } from './helpers';

// 活动面板几何冒烟：回归场景是「扁平视口（PC 端显示模式/分屏）把面板拉成
// 近全屏的扁平块」，以及「宽而矮的视口下桌面版 292px 列表挤压 hero 文案」。
//
// 测量一律用 offsetWidth / offsetHeight / offsetTop 等布局尺寸：面板 open
// 有 0.32s 的 scale(0.985) 过渡，getBoundingClientRect 在过渡期间会被缩放
// （200px → 197px），且软件 GL 掉帧时过渡时间线可能长时间冻结、墙钟等待
// 不可靠；布局尺寸不受 transform 影响，任何时刻读取都精确。

async function openActivityPanel(page: Page): Promise<void> {
  // 顶栏按钮可能被淡出的 boot 壳短暂遮挡（software-GL CI 跑得慢），直接
  // 派发点击并轮询面板 open，与 render-settings / 地图用例同一套路。
  await expect.poll(() => page.evaluate(() => {
    const overlay = document.getElementById('activityPanelOverlay');
    if (!overlay?.classList.contains('open')) document.getElementById('activityPanelToggle')?.click();
    return overlay?.classList.contains('open') ?? false;
  }), { timeout: 10_000, intervals: [200, 300, 500] }).toBe(true);
}

test('activity panel keeps its design ratio on flat viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1066, height: 565 });
  await seedCityStorage(page, 'activity-flat-tester');
  await waitForCityBooted(page);
  await openActivityPanel(page);

  const layout = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.activity-panel-shell');
    return {
      shellWidth: shell!.offsetWidth,
      shellHeight: shell!.offsetHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  // 宽高比回到设计值 1180/680（±2%），不再被拉成近全屏的扁平块。
  const ratio = layout.shellWidth / layout.shellHeight;
  expect(Math.abs(ratio - 1180 / 680)).toBeLessThan(0.02 * (1180 / 680));
  expect(layout.shellWidth).toBeLessThanOrEqual(1066 - 48);
  expect(layout.overflow).toBeLessThanOrEqual(0);
});

test('activity panel switches to compact layout on wide-and-short viewports', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 390 });
  await seedCityStorage(page, 'activity-short-tester');
  await waitForCityBooted(page);
  await openActivityPanel(page);

  const layout = await page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('.activity-panel-list');
    const hero = document.querySelector<HTMLElement>('.activity-panel-hero');
    const heroCopy = document.querySelector<HTMLElement>('.activity-panel-hero-copy');
    const description = document.querySelector<HTMLElement>('.activity-panel-description');
    // hero-copy 为 hero 内绝对定位，description 的 offsetTop 相对 hero-copy；
    // hero 的 clientHeight 为布局高，统一在布局坐标系里比较。
    return {
      listWidth: list!.offsetWidth,
      descriptionBottom: heroCopy!.offsetTop + description!.offsetTop + description!.offsetHeight,
      heroHeight: hero!.clientHeight,
    };
  });
  // 高度 ≤480 的宽视口走紧凑布局（列表 200px），hero 文案完整落在面板内。
  expect(layout.listWidth).toBeCloseTo(200, 0);
  expect(layout.descriptionBottom).toBeLessThanOrEqual(layout.heroHeight + 1);
});
