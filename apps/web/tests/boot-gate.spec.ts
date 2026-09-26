import { expect, test } from '@playwright/test';
import { seedCityStorage, stubCityWebSocket, stubNewsstandWebSocket, stubWorldCatalogWebSocket, waitForCityBooted } from './helpers';

// The boot gate is the front door of the city: these specs pin the two boot
// paths end to end (light moment splash vs heavy pipeline) so refactors of
// bootGate/bootPipeline/momentSplash cannot silently break entry.
// Retries stay OFF for this file: the heavy pipeline takes minutes, and a
// flaky retry must not eat the CI job's 15-minute budget (review Blocker 3).
test.describe.configure({ retries: 0 });
test.setTimeout(200_000);

function expectedMomentLabel(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return '清晨';
  if (hour >= 11 && hour < 17) return '正午';
  if (hour >= 17 && hour < 20) return '黄昏';
  return '夜晚';
}

test('light boot shows the current real-world moment still and enters', async ({ page }) => {
  stubCityWebSocket(page);
  stubNewsstandWebSocket(page);
  stubWorldCatalogWebSocket(page);
  // Seed BEFORE any navigation: addInitScript applies to the next document,
  // so one goto boots the light path directly (no wasted first-visit load).
  await seedCityStorage(page);
  await page.goto('/');

  await expect(page.locator('#bootScreen')).toHaveClass(/is-splash/);
  await expect(page.locator('#bootPipeline')).not.toHaveClass(/is-active/);
  const src = await page.locator('#bootMomentImgA, #bootMomentImgB.is-front').first().getAttribute('src');
  expect(src).toMatch(/moments\/(dawn|noon|dusk|night)\.webp/);
  await expect(page.locator('#bootMomentCaption')).toContainText(expectedMomentLabel());
  await waitForCityBooted(page);
});

test('forced heavy boot runs the pipeline, marks precache, reveals', async ({ page }) => {
  stubCityWebSocket(page);
  stubNewsstandWebSocket(page);
  stubWorldCatalogWebSocket(page);
  await seedCityStorage(page);
  await page.goto('/?boot=heavy'); // query overrides the seeded light path

  await expect(page.locator('#bootScreen')).toHaveClass(/is-heavy/);
  await expect(page.locator('#bootPipeline')).toHaveClass(/is-active/);
  // The still behind the pipeline is the CURRENT moment, not a day cycle.
  await expect(page.locator('#bootMomentCaption')).toContainText(expectedMomentLabel());

  // Full pipeline: download → scene → precompile → ready → reveal.
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 190_000 });
  expect(await page.evaluate(() => localStorage.getItem('minicityPrecacheDone'))).toBe('1');
  expect(await page.evaluate(() => localStorage.getItem('minicityBuildId'))).not.toBeNull();
  await waitForCityBooted(page);
});
