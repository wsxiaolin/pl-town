import { expect, test } from '@playwright/test';
import { waitForCityReady } from './helpers';

test('LanYu prelude is available only through the hidden cinematic debug API', async ({ page }) => {
  await waitForCityReady(page, 'lanyu-cg-tester');

  await expect(page.locator('[data-lanyu-cg]')).toHaveCount(0);
  const apiShape = await page.evaluate(() => {
    const api = (window as any)._mini;
    return {
      hasPlay: typeof api?.cinematics?.playLanYuPrelude === 'function',
      hasStop: typeof api?.cinematics?.stopLanYuPrelude === 'function',
      hasStatus: typeof api?.cinematics?.isLanYuPreludeActive === 'function',
      hasPublicShortcut: 'playLanYuPrelude' in window,
    };
  });
  expect(apiShape).toEqual({ hasPlay: true, hasStop: true, hasStatus: true, hasPublicShortcut: false });

  const handleShape = await page.evaluate(() => {
    const handle = (window as any)._mini.cinematics.playLanYuPrelude();
    return {
      hasFinished: handle.finished instanceof Promise,
      hasStop: typeof handle.stop === 'function',
      active: (window as any)._mini.cinematics.isLanYuPreludeActive(),
    };
  });
  expect(handleShape).toEqual({ hasFinished: true, hasStop: true, active: true });

  const overlay = page.locator('[data-lanyu-cg="blood-mark-prelude"]');
  await expect(overlay).toHaveClass(/is-active/);
  await expect(overlay.locator('canvas')).toBeVisible();
  await expect(overlay.locator('.lanyu-cg__caption.is-current')).toBeVisible({ timeout: 3_000 });

  const viewport = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-lanyu-cg] canvas')!;
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(viewport.canvasWidth).toBeGreaterThan(0);
  expect(viewport.canvasHeight).toBeGreaterThan(0);
  expect(viewport.overflow).toBeLessThanOrEqual(1);

  expect(await page.evaluate(() => (window as any)._mini.cinematics.stopLanYuPrelude())).toBe(true);
  await expect(overlay).toHaveCount(0, { timeout: 2_000 });
  expect(await page.evaluate(() => (window as any)._mini.cinematics.isLanYuPreludeActive())).toBe(false);
});
