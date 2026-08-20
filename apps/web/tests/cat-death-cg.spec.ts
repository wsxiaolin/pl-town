import { expect, test } from '@playwright/test';
import { waitForCityReady } from './helpers';

test('Cat Death CG is available only through the hidden cinematic debug API', async ({ page }) => {
  await waitForCityReady(page, 'cat-death-cg-tester');

  await expect(page.locator('[data-cat-death-cg]')).toHaveCount(0);
  const apiShape = await page.evaluate(() => {
    const api = (window as any)._mini;
    return {
      hasPlay: typeof api?.cinematics?.playCatDeath === 'function',
      hasStop: typeof api?.cinematics?.stopCatDeath === 'function',
      hasStatus: typeof api?.cinematics?.isCatDeathActive === 'function',
      hasPublicShortcut: 'playCatDeath' in window,
    };
  });
  expect(apiShape).toEqual({ hasPlay: true, hasStop: true, hasStatus: true, hasPublicShortcut: false });

  const handleShape = await page.evaluate(() => {
    const handle = (window as any)._mini.cinematics.playCatDeath();
    return {
      hasFinished: handle.finished instanceof Promise,
      hasStop: typeof handle.stop === 'function',
      active: (window as any)._mini.cinematics.isCatDeathActive(),
    };
  });
  expect(handleShape).toEqual({ hasFinished: true, hasStop: true, active: true });

  const overlay = page.locator('[data-cat-death-cg="death-of-a-cat"]');
  await expect(overlay).toHaveClass(/is-active/);
  await expect(overlay.locator('canvas')).toBeVisible();
  await expect(overlay.getByText('自由从来不是死亡的反义词')).toHaveCount(0);
  await expect(overlay.locator('.cat-death-cg__end-blackout')).toHaveCount(1);
  await expect(overlay.locator('.cat-death-cg__caption.is-current')).toBeVisible({ timeout: 3_000 });

  const viewport = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('[data-cat-death-cg] canvas')!;
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
    };
  });
  expect(viewport.canvasWidth).toBeGreaterThan(0);
  expect(viewport.canvasHeight).toBeGreaterThan(0);
  expect(viewport.overflow).toBeLessThanOrEqual(1);

  expect(await page.evaluate(() => (window as any)._mini.cinematics.stopCatDeath())).toBe(true);
  await expect(overlay).toHaveCount(0, { timeout: 2_000 });
  expect(await page.evaluate(() => (window as any)._mini.cinematics.isCatDeathActive())).toBe(false);
});
