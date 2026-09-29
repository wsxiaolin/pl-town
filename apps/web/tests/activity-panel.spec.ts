import { expect, test, type Page } from '@playwright/test';
import { seedCityStorage, waitForCityBooted } from './helpers';

// Activity panel geometry. Measure with offsetWidth / offsetHeight / offsetTop:
// the open animation uses scale(0.985) for 0.32s, so getBoundingClientRect is
// scaled during the transition; layout sizes are transform-immune.
//
// Aurora Festival is the longest copy (11-char title / 31-char description)
// and the background this change edits, so every case selects it first.

const AURORA_ITEM = '.activity-panel-item[data-activity-id="aurora-festival"]';

async function openActivityPanel(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => {
    const overlay = document.getElementById('activityPanelOverlay');
    if (!overlay?.classList.contains('open')) document.getElementById('activityPanelToggle')?.click();
    return overlay?.classList.contains('open') ?? false;
  }), { timeout: 10_000, intervals: [200, 300, 500] }).toBe(true);
}

async function selectAurora(page: Page): Promise<void> {
  await page.locator(AURORA_ITEM).dispatchEvent('click');
  await expect(page.locator(AURORA_ITEM)).toHaveClass(/active/);
}

async function measurePanel(page: Page) {
  return page.evaluate(() => {
    const overlay = document.getElementById('activityPanelOverlay');
    const shell = document.querySelector<HTMLElement>('.activity-panel-shell');
    const list = document.querySelector<HTMLElement>('.activity-panel-list');
    const hero = document.querySelector<HTMLElement>('.activity-panel-hero');
    const heroCopy = document.querySelector<HTMLElement>('.activity-panel-hero-copy');
    const description = document.querySelector<HTMLElement>('.activity-panel-description');
    const title = document.querySelector<HTMLElement>('.activity-panel-title');
    const body = document.querySelector<HTMLElement>('.activity-panel-body');
    const overlayStyle = overlay ? getComputedStyle(overlay) : null;
    const padX = overlayStyle ? parseFloat(overlayStyle.paddingLeft) + parseFloat(overlayStyle.paddingRight) : 0;
    const padY = overlayStyle ? parseFloat(overlayStyle.paddingTop) + parseFloat(overlayStyle.paddingBottom) : 0;
    return {
      overlayClientW: overlay!.clientWidth,
      overlayClientH: overlay!.clientHeight,
      overlayPadX: padX,
      overlayPadY: padY,
      shellWidth: shell!.offsetWidth,
      shellHeight: shell!.offsetHeight,
      listWidth: list!.offsetWidth,
      listHeight: list!.offsetHeight,
      bodyFlexDir: getComputedStyle(body!).flexDirection,
      copyTop: heroCopy!.offsetTop,
      copyHeight: heroCopy!.offsetHeight,
      copyScrollH: heroCopy!.scrollHeight,
      descriptionVisible: description!.offsetHeight > 0,
      titleVisible: title!.offsetHeight > 0,
      heroHeight: hero!.clientHeight,
      heroWidth: hero!.clientWidth,
    };
  });
}

function expectFitsOverlay(layout: Awaited<ReturnType<typeof measurePanel>>): void {
  expect(layout.shellWidth).toBeGreaterThan(240);
  expect(layout.shellHeight).toBeGreaterThan(180);
  expect(layout.shellWidth).toBeLessThanOrEqual(layout.overlayClientW - layout.overlayPadX + 1);
  expect(layout.shellHeight).toBeLessThanOrEqual(layout.overlayClientH - layout.overlayPadY + 1);
  expect(layout.heroWidth).toBeGreaterThan(120);
  expect(layout.heroHeight).toBeGreaterThan(80);
  expect(layout.titleVisible).toBe(true);
  expect(layout.descriptionVisible).toBe(true);
  expect(layout.copyScrollH).toBeGreaterThan(0);
  expect(layout.copyHeight).toBeGreaterThan(0);
  expect(layout.copyHeight).toBeLessThanOrEqual(layout.heroHeight + 1);
}

test('activity panel fills a desktop viewport without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedCityStorage(page, 'activity-desktop-tester');
  await waitForCityBooted(page);
  await openActivityPanel(page);
  await selectAurora(page);

  const layout = await measurePanel(page);
  expectFitsOverlay(layout);
  expect(layout.bodyFlexDir).toBe('row');
  expect(layout.listWidth).toBeGreaterThanOrEqual(280);
  expect(layout.shellWidth).toBeGreaterThanOrEqual(1100);
  expect(layout.shellHeight).toBeGreaterThanOrEqual(640);
});

test('activity panel stays inside a flat PC-mode viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1066, height: 565 });
  await seedCityStorage(page, 'activity-flat-tester');
  await waitForCityBooted(page);
  await openActivityPanel(page);
  await selectAurora(page);

  const layout = await measurePanel(page);
  expectFitsOverlay(layout);
  expect(layout.bodyFlexDir).toBe('row');
  expect(layout.shellWidth).toBeGreaterThan(900);
  expect(layout.heroWidth).toBeGreaterThan(layout.listWidth);
});

test('activity panel keeps copy readable on a short landscape viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 390 });
  await seedCityStorage(page, 'activity-short-tester');
  await waitForCityBooted(page);
  await openActivityPanel(page);
  await selectAurora(page);

  const layout = await measurePanel(page);
  expectFitsOverlay(layout);
  expect(layout.bodyFlexDir).toBe('row');
  expect(layout.shellHeight).toBeGreaterThan(300);
  expect(layout.copyHeight).toBeLessThanOrEqual(layout.heroHeight + 1);
});

test('activity panel stacks on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedCityStorage(page, 'activity-phone-tester');
  await waitForCityBooted(page);
  await openActivityPanel(page);
  await selectAurora(page);

  const layout = await measurePanel(page);
  expectFitsOverlay(layout);
  expect(layout.bodyFlexDir).toBe('column');
  expect(layout.listWidth).toBeGreaterThan(layout.shellWidth * 0.8);
  expect(layout.heroHeight).toBeGreaterThan(layout.listHeight);
});

test('activity panel still fits after an in-session resize', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedCityStorage(page, 'activity-resize-tester');
  await waitForCityBooted(page);
  await openActivityPanel(page);
  await selectAurora(page);

  await page.setViewportSize({ width: 844, height: 390 });
  const short = await measurePanel(page);
  expectFitsOverlay(short);

  await page.setViewportSize({ width: 390, height: 844 });
  const phone = await measurePanel(page);
  expectFitsOverlay(phone);
  expect(phone.bodyFlexDir).toBe('column');
});
