import { expect, test } from '@playwright/test';
import { FRAME_ADVANCE_TIMEOUT, waitForCityReady } from './helpers';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'narrow-landscape', width: 700, height: 600 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'se-landscape', width: 667, height: 375 },
];

test('minimal city boots with the map accessible and the activity panel hidden', async ({ page }) => {
  await page.route('**/town-api/scene-mode', (route) => route.fulfill({ json: { minimal: true } }));
  await waitForCityReady(page, 'minimal-activity');
  await expect(page.locator('#activityPanelToggle')).toBeHidden();
  await expect(page.locator('#activityPanelOverlay')).toBeHidden();
  await page.locator('#mapToggle').click();
  await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
});

for (const viewport of viewports) {
  test(`activity panel works at ${viewport.name} size`, async ({ page }) => {
    // Allow for both city boot and panel transitions on a software renderer.
    test.setTimeout(150_000);
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
          const copyElement = document.querySelector('.activity-panel-hero-copy');
          const copy = copyElement?.getBoundingClientRect();
          const list = boxOf('#activityPanelList');
          if (!shell || !copyElement || !copy || !list) {
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
            copyClipped: copyElement.scrollHeight > copyElement.clientHeight + 1,
          };
        }),
        // Shell geometry settles only after the open transition advances a
        // frame; a stalled soft-GL main thread blew the 5 s poll default
        // (flaky shard 1 on #268's run).
        { timeout: FRAME_ADVANCE_TIMEOUT },
      )
      .toEqual({ copyClearsRail: true, shellInside: true, copyClipped: false });

    await page.locator('[data-activity-id="meteor-market"]').click();
    await expect(page.locator('#activityPanelTitle')).toHaveText('流星夜市，三日不打烊');

    await page.keyboard.press('Escape');
    await expect(overlay).not.toHaveClass(/open/);
  });
}
