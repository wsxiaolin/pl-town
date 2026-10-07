import { expect, test } from '@playwright/test';
import type { MiniCityDebugApi } from '../src/city/debugApi';
import { stubCityWebSocket, waitForCityReady, waitForMapShotsPreloaded } from './helpers';

type CityWindow = Window & { _mini: MiniCityDebugApi };

// The city stub keeps two north-district buildings available (north_bistro at
// x=-6/z=-59.5 and north_pigeon_square) so the north page has icons to show;
// 'commons' anchors the main page.
const config = {
  schemaVersion: 1, version: 'map-regions-test', initialBuiltBuildingIds: ['commons', 'north_bistro'],
  projects: [], personalPlots: [], decorations: [],
};
const state = { epoch: 'map-regions-test', revision: 0, configVersion: config.version,
  projects: [], decorations: [] };

async function stubCityAndBoot(page: Parameters<typeof stubCityWebSocket>[0], user: string): Promise<void> {
  stubCityWebSocket(page, { user, unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    return route.fulfill({ status: 204, body: '' });
  });
}

test('boot preloads both district map pages before the map is ever opened', async ({ page }) => {
  // Keep the town clock in daytime: theme flips invalidate atlas pages and
  // would race the preload assertions.
  await page.clock.setFixedTime(new Date('2026-09-25T00:12:00Z'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await stubCityAndBoot(page, 'map-regions-preload-tester');
  await waitForCityReady(page, 'map-regions-preload-tester');
  await waitForMapShotsPreloaded(page);
  // Both atlas pages are cached without the overlay ever having opened: the
  // captures came from the boot-time preload, and the <img> is still untouched.
  const ready = await page.evaluate(() => (window as unknown as CityWindow)._mini.mapShotsReady());
  expect(ready).toEqual({ main: true, north: true });
  await expect(page.locator('#mapOverlay')).not.toHaveClass(/show/);
  expect(await page.locator('#mapImage').getAttribute('src')).toBeNull();
  expect(errors).toEqual([]);
});

// This spec boots the city and opens the atlas twice per test. Under the
// SwiftShader software GL used by CI, a boot alone eats 30–40 s, so the
// default 60 s budget is not enough for the full walk-through below.
test('the atlas page follows where the player stands', async ({ page }) => {
  test.setTimeout(150_000);
  await page.clock.setFixedTime(new Date('2026-09-25T00:12:00Z'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await stubCityAndBoot(page, 'map-regions-north-tester');
  await waitForCityReady(page, 'map-regions-north-tester');
  await waitForMapShotsPreloaded(page);

  // Standing on the central avenue of 星语北城 opens the north page.
  await page.evaluate(() => (window as unknown as CityWindow)._mini.teleport(0, -63));
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
  await expect(page.locator('#mapTitle')).toHaveText('物实小城 · 星语北城');
  await expect(page.locator('#mapImage')).toHaveAttribute('alt', '星语北城全景地图');
  await expect(page.locator('.map-icon[data-building-id="north_bistro"]')).toHaveCount(1);
  // Main-city icons stay on their own page — they do not leak into the frame.
  await expect(page.locator('.map-icon[data-building-id="commons"]')).toHaveCount(0);
  // The player marker projects inside the north page's frame.
  const markerBox = await page.evaluate(() => {
    const marker = document.getElementById('mapMarker')!;
    return { left: marker.style.left, top: marker.style.top };
  });
  expect(parseFloat(markerBox.left)).toBeGreaterThan(0);
  expect(parseFloat(markerBox.top)).toBeGreaterThan(0);
  await page.locator('#mapClose').click({ force: true });
  await expect(page.locator('#mapOverlay')).not.toHaveClass(/show/);

  // Back in the main city, the same control opens the main page.
  await page.evaluate(() => (window as unknown as CityWindow)._mini.teleport(0, 0));
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapTitle')).toHaveText('物实小城 · 主城');
  await expect(page.locator('.map-icon[data-building-id="commons"]')).toHaveCount(1);
  await expect(page.locator('.map-icon[data-building-id="north_bistro"]')).toHaveCount(0);
  await page.locator('#mapClose').click({ force: true });
  await expect(page.locator('#mapOverlay')).not.toHaveClass(/show/);
  expect(errors).toEqual([]);
});

test('a search hit across the district boundary turns the page', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-25T00:12:00Z'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await stubCityAndBoot(page, 'map-regions-search-tester');
  await waitForCityReady(page, 'map-regions-search-tester');
  await waitForMapShotsPreloaded(page);

  // The player stands in the main city; the map opens on the main page.
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapTitle')).toHaveText('物实小城 · 主城');

  // Searching a north-district building by its ID and picking the result
  // flips the paper to the north page so the selection is visible there.
  const search = page.locator('#mapSearchInput');
  await search.fill('north_bistro');
  await expect(page.locator('.map-search-result[data-building-id="north_bistro"]')).toHaveCount(1);
  await page.locator('.map-search-result[data-building-id="north_bistro"]').click();
  await expect(page.locator('#mapTitle')).toHaveText('物实小城 · 星语北城');
  await expect(page.locator('.map-icon[data-building-id="north_bistro"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#mapTipTitle')).toHaveText('会员制餐厅');
  await expect(errors).toEqual([]);
});
