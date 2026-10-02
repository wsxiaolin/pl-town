import { expect, test } from '@playwright/test';
import { waitForCityReady } from './helpers';

for (const viewport of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'short-mobile', width: 844, height: 390 },
]) {
  test(`activity panel works at ${viewport.name} size`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await waitForCityReady(page, `activity-${viewport.name}`);

    await page.locator('#activityPanelToggle').click({ force: true });
    const overlay = page.locator('#activityPanelOverlay');
    const shell = page.locator('.activity-panel-shell');
    await expect(overlay).toHaveClass(/open/);
    await expect(page.locator('#activityPanelTitle')).toHaveText('巡星归程');
    await expect(page.locator('#activityPanelBadge')).toHaveText('新');

    const shellBox = await shell.boundingBox();
    expect(shellBox).not.toBeNull();
    expect(shellBox!.y).toBeGreaterThanOrEqual(0);
    expect(shellBox!.y + shellBox!.height).toBeLessThanOrEqual(viewport.height);
    const copyBox = await page.locator('.activity-panel-hero-copy').boundingBox();
    const listBox = await page.locator('#activityPanelList').boundingBox();
    expect(copyBox).not.toBeNull();
    expect(listBox).not.toBeNull();
    expect(copyBox!.y + copyBox!.height).toBeLessThanOrEqual(listBox!.y + 1);

    await page.locator('[data-activity-id="meteor-market"]').click();
    await expect(page.locator('#activityPanelTitle')).toHaveText('流星夜市，三日不打烊');

    await page.keyboard.press('Escape');
    await expect(overlay).not.toHaveClass(/open/);
  });
}
