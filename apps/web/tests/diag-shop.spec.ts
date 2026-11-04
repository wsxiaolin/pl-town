import { test, expect } from '@playwright/test';

test('diag: mall_south interaction after boot', async ({ page }) => {
  test.setTimeout(300_000);
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'diag-user');
    localStorage.setItem('minicityServerToken', 'diag-token');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  });
  await page.goto('/');
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 300_000 });
  await page.waitForTimeout(3000);
  const interactResult = await page.evaluate(() => {
    const mini = (window as any)._mini;
    try { return { ok: true, value: mini.interactBuilding('mall_south') }; }
    catch (e) { return { ok: false, error: String(e) }; }
  });
  console.log('DIAG_INTERACT:', JSON.stringify(interactResult));
  await page.waitForTimeout(5000);
  const cls = await page.evaluate(() => document.getElementById('shopPanel')?.className ?? 'no-panel');
  console.log('SHOP_AFTER:', cls);
  expect(true).toBe(true);
});
