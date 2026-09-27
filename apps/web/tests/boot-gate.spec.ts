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
  // Skip interaction (r8 nit: click-skip had no coverage): the splash binds a
  // capture-phase pointerdown listener; exercising THAT path via a real
  // locator.click() races the natural reveal — once cityReady + the 2.6 s
  // minimum land, is-ready makes the boot screen pointer-events:none behind
  // a fading opacity, the city canvas eats every hit, and the click retries
  // until the test budget dies (observed on CI: canvas#c "intercepts pointer
  // events"). dispatchEvent targets the listener directly, deterministically,
  // whenever the splash is up.
  await expect(page.locator('#bootScreen')).toHaveAttribute('data-moment-skip-bound', 'true');
  await page.locator('#bootScreen').dispatchEvent('pointerdown');
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 60_000 });
});

test('forced heavy boot runs the pipeline, marks precache, reveals', async ({ page }) => {
  stubCityWebSocket(page);
  stubNewsstandWebSocket(page);
  stubWorldCatalogWebSocket(page);
  await seedCityStorage(page);

  // Stage sequence coverage (r8 nit): collect the stage label history from
  // DOCUMENT START — a MutationObserver installed after goto misses the
  // early labels (on CI the localhost download finishes within the
  // assertion round trips, and "下载城市资源" was gone before the observer
  // existed; the received history only had 预编译渲染管线>即将进入小城).
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __bootStages: string[] }).__bootStages = seen;
    const record = () => {
      const text = document.getElementById('bootPipelineStage')?.textContent ?? '';
      if (text && seen[seen.length - 1] !== text) seen.push(text);
    };
    new MutationObserver(record).observe(document, { childList: true, subtree: true, characterData: true });
  });
  await page.goto('/?boot=heavy'); // query overrides the seeded light path

  await expect(page.locator('#bootScreen')).toHaveClass(/is-heavy/);
  await expect(page.locator('#bootPipeline')).toHaveClass(/is-active/);
  // The still behind the pipeline is the CURRENT moment, not a day cycle.
  // (The caption is display:none in heavy mode — assert what is visible.)
  const heavySrc = await page.locator('#bootMomentImg').getAttribute('src');
  expect(heavySrc).toMatch(new RegExp(`moments/(dawn|noon|dusk|night)\\.webp`));

  // Full pipeline: download → scene → precompile → ready → reveal.
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 190_000 });
  const stages = await page.evaluate(() => (window as unknown as { __bootStages?: string[] }).__bootStages ?? []);
  expect(stages.join('>')).toContain('下载城市资源');
  expect(stages.join('>')).toContain('预编译渲染管线');
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

test('degraded heavy boot reveals without writing completion markers', async ({ page }) => {
  // Short-circuit the watchdog BEFORE the module graph loads (the constant
  // is read at import time), stall every raw asset request past it, and
  // assert the visitor still gets in — with the marker invariant intact: no
  // precacheDone, no buildId, so the next visit retries the full pipeline.
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    (window as unknown as { __MINICITY_TEST_BOOT_WATCHDOG_MS__?: number }).__MINICITY_TEST_BOOT_WATCHDOG_MS__ = 8_000;
  });
  await page.route('**/assets/**', async (route) => {
    // Vite dev serves the module graph under /src/assets/…?import / …?url —
    // those MUST pass or the app never boots and even `load` never fires.
    // Raw asset fetches (downloadAllAssets) carry no query: stall those.
    if (route.request().url().includes('?')) await route.continue();
    else await new Promise(() => { /* never fulfil — watchdog aborts */ });
  });
  stubCityWebSocket(page);
  stubNewsstandWebSocket(page);
  stubWorldCatalogWebSocket(page);
  await seedCityStorage(page);
  // domcontentloaded, not load: the stalled splash image would otherwise
  // hold the load event hostage past every timeout.
  await page.goto('/?boot=heavy', { waitUntil: 'domcontentloaded' });

  await expect(page.locator('#bootScreen')).toHaveClass(/is-heavy/);
  // Watchdog fires at ~8s: degrade, release, reveal — markers untouched.
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 60_000 });
  expect(await page.evaluate(() => localStorage.getItem('minicityPrecacheDone'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('minicityBuildId'))).toBeNull();
});
