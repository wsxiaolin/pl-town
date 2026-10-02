import { expect, test } from '@playwright/test';
import { waitForCityReady } from './helpers';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'narrow-landscape', width: 700, height: 600 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'se-landscape', width: 667, height: 375 },
];

for (const viewport of viewports) {
  test(`activity panel works at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await waitForCityReady(page, `activity-${viewport.name}`);

    await page.locator('#activityPanelToggle').click({ force: true });
    const overlay = page.locator('#activityPanelOverlay');
    await expect(overlay).toHaveClass(/open/);
    await expect(page.locator('#activityPanelTitle')).toHaveText('巡星归程');
    await expect(page.locator('#activityPanelBadge')).toHaveText('新');

    await expect
      .poll(() =>
        page.evaluate(() => {
          const boxOf = (selector: string) =>
            document.querySelector(selector)?.getBoundingClientRect() ?? null;
          const shell = boxOf('.activity-panel-shell');
          const copy = boxOf('.activity-panel-hero-copy');
          const list = boxOf('#activityPanelList');
          if (!shell || !copy || !list) {
            return null;
          }
          return {
            copyClearsRail:
              copy.left >= list.right - 1 ||
              list.left >= copy.right - 1 ||
              copy.top >= list.bottom - 1 ||
              list.top >= copy.bottom - 1,
            shellInside:
              shell.top >= -1 &&
              shell.left >= -1 &&
              shell.bottom <= window.innerHeight + 1 &&
              shell.right <= window.innerWidth + 1,
            copyClipped: copy.scrollHeight > copy.clientHeight + 1,
          };
        }),
      )
      .toEqual({ copyClearsRail: true, shellInside: true, copyClipped: false });

    await page.locator('[data-activity-id="meteor-market"]').click();
    await expect(page.locator('#activityPanelTitle')).toHaveText('流星夜市，三日不打烊');

    await page.keyboard.press('Escape');
    await expect(overlay).not.toHaveClass(/open/);
  });
}
