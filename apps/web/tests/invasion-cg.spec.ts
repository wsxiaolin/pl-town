import { expect, test } from '@playwright/test';
import { waitForCityReady } from './helpers';

test('invasion CG renders its continuous arc in the shared overlay and exits cleanly', async ({ page }) => {
  await waitForCityReady(page, 'cg-tester');

  const started = await page.evaluate(() => (window as any)._mini.invasionCG());
  expect(started).toBe(true);
  const overlay = page.locator('#cgOverlay');
  await expect(overlay).toHaveClass(/active/);
  // linear progress bar (continuous take, not chapter dots)
  await expect(page.locator('#cgProgress .cgm-bar')).toBeVisible();

  // after a couple of seconds the 2D canvas must contain lit pixels
  await page.waitForTimeout(1500);
  const hasPixels = await page.evaluate(() => {
    const cv = document.querySelector<HTMLCanvasElement>('#cgSceneWrap canvas.cg-canvas');
    if (!cv) return false;
    const cx = cv.getContext('2d');
    if (!cx) return false;
    const data = cx.getImageData(cv.width / 2 - 50, cv.height / 2 - 50, 100, 100).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i]! + data[i + 1]! + data[i + 2]! > 24) return true;
    }
    return false;
  });
  expect(hasPixels).toBe(true);

  await page.keyboard.press('Escape');
  await expect(overlay).not.toHaveClass(/active/);
});
