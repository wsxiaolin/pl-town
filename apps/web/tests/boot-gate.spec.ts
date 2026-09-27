import { expect, test } from '@playwright/test';
import { seedCityStorage, stubCityWebSocket, stubNewsstandWebSocket, stubWorldCatalogWebSocket, waitForCityBooted } from './helpers';

// The boot gate is the front door of the city: these specs pin the two boot
// paths end to end (light moment splash vs heavy pipeline) so refactors of
// bootGate/bootPipeline/momentSplash cannot silently break entry.
// Retries stay OFF for this file: the heavy pipeline takes minutes, and a
// flaky retry must not eat the CI job's budget (25 min since review r4).
test.describe.configure({ retries: 0 });
test.setTimeout(200_000);

function expectedMomentCaption(): string {
  // Substring each caption actually contains ("夜幕下的…" has 夜幕, not 夜晚).
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return '清晨';
  if (hour >= 11 && hour < 17) return '正午';
  if (hour >= 17 && hour < 20) return '黄昏';
  return '夜幕';
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
  // Only the FRONT layer carries a src (the back one is the swap buffer).
  const src = await page.locator('#bootMomentImg').getAttribute('src');
  expect(src).toMatch(/moments\/(dawn|noon|dusk|night)\.webp/);
  await expect(page.locator('#bootMomentCaption')).toContainText(expectedMomentCaption());
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
  // (The caption is display:none in heavy mode — assert what is visible.)
  const heavySrc = await page.locator('#bootMomentImg').getAttribute('src');
  expect(heavySrc).toMatch(new RegExp(`moments/(dawn|noon|dusk|night)\\.webp`));

  // Full pipeline: download → scene → precompile → ready → reveal.
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 190_000 });
  expect(await page.evaluate(() => localStorage.getItem('minicityPrecacheDone'))).toBe('1');
  expect(await page.evaluate(() => localStorage.getItem('minicityBuildId'))).not.toBeNull();

  // Round trip: the markers the heavy boot wrote must make the NEXT visit
  // light with NO force flag. Disabling the init-script seeding first —
  // otherwise every navigation re-seeds minicityForceBoot='light' and the
  // assertion would pass even with garbage markers (review r5#B2).
  await page.evaluate(() => {
    sessionStorage.setItem('disableBootSeed', '1');
    localStorage.removeItem('minicityForceBoot');
  });
  await page.goto('/');
  // The splash paints before the decision; light mode keeps it (no pipeline).
  await expect(page.locator('#bootScreen')).toHaveClass(/is-splash/);
  await expect(page.locator('#bootScreen')).not.toHaveClass(/is-heavy/);
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 60_000 });
});
