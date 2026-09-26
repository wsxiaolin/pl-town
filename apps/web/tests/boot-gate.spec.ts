import { expect, test } from '@playwright/test';
import { stubCityWebSocket, stubNewsstandWebSocket, stubWorldCatalogWebSocket, waitForCityBooted } from './helpers';

// The boot gate is the front door of the city: these specs pin the two boot
// paths end to end (light moment splash vs heavy pipeline) so refactors of
// bootGate/bootPipeline/momentSplash cannot silently break entry.

function expectedMomentLabel(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return '清晨';
  if (hour >= 11 && hour < 17) return '正午';
  if (hour >= 17 && hour < 20) return '黄昏';
  return '夜晚';
}

test('light boot shows the current real-world moment still and enters', async ({ page }) => {
  test.setTimeout(180_000);
  stubCityWebSocket(page);
  stubNewsstandWebSocket(page);
  stubWorldCatalogWebSocket(page);
  await page.goto('/');
  await seedCityStorage(page); // seeds minicityForceBoot=light
  await page.goto('/');

  await expect(page.locator('#bootScreen')).toHaveClass(/is-splash/);
  // The heavy pipeline must stay out of a light visit.
  await expect(page.locator('#bootPipeline')).not.toHaveClass(/is-active/);
  // The still matches the visitor's local clock.
  await expect(page.locator('#bootMomentCaption')).toContainText(expectedMomentLabel());
  const src = await page.locator('#bootMomentImgA, #bootMomentImgB').evaluateAll((imgs) =>
    imgs.filter((img) => (img as HTMLImageElement).classList.contains('is-front')).map((img) => (img as HTMLImageElement).getAttribute('src')),
  );
  expect(src[0]).toMatch(/moments\/(dawn|noon|dusk|night)\.webp$/);

  await waitForCityBooted(page);
});

test('forced heavy boot runs the pipeline, marks precache, reveals', async ({ page }) => {
  test.setTimeout(240_000);
  stubCityWebSocket(page);
  stubNewsstandWebSocket(page);
  stubWorldCatalogWebSocket(page);
  await page.goto('/');
  await seedCityStorage(page);
  await page.goto('/?boot=heavy'); // force overrides the seeded light path

  await expect(page.locator('#bootScreen')).toHaveClass(/is-heavy/);
  await expect(page.locator('#bootPipeline')).toHaveClass(/is-active/);
  // The still behind the pipeline is the CURRENT moment, not a day cycle.
  await expect(page.locator('#bootMomentCaption')).toContainText(expectedMomentLabel());

  // Full pipeline: download → scene → precompile → ready → reveal.
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 200_000 });
  expect(await page.evaluate(() => localStorage.getItem('minicityPrecacheDone'))).toBe('1');
  expect(await page.evaluate(() => localStorage.getItem('minicityBuildId'))).not.toBeNull();
  await waitForCityBooted(page);
});
