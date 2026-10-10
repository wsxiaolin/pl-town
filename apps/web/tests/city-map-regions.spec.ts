import { expect, test } from '@playwright/test';
import type { MiniCityDebugApi } from '../src/city/debugApi';
import { stubCityWebSocket, waitForCityReady, waitForMapShotsPreloaded } from './helpers';

type CityWindow = Window & { _mini: MiniCityDebugApi };

// The city stub keeps two north-district buildings available (north_bistro at
// x=-6/z=-59.5 and north_pigeon_square) so the north page has icons to show;
// 'commons' anchors the main page; 'mall_south' (world 22.5,-22.5) is a
// main-city building that also falls inside the north page's frame band.
const config = {
  schemaVersion: 1, version: 'map-regions-test', initialBuiltBuildingIds: ['commons', 'north_bistro', 'mall_south'],
  projects: [], personalPlots: [], decorations: [],
};
const state = { epoch: 'map-regions-test', revision: 0, configVersion: config.version,
  projects: [], decorations: [] };

/** Average of the darkest pixel in a small patch around a world point on the
 *  currently shown atlas page. `centerZ` is the active page's centre, so the
 *  same probe works for both pages. The dark mall roof reads low on the main
 *  page and the sky background reads high on the north page. */
async function minBrightnessAt(
  page: Parameters<typeof stubCityWebSocket>[0],
  worldX: number,
  worldZ: number,
  centerZ: number,
): Promise<number> {
  return page.evaluate(async ({ x, z, cz }) => {
    const image = document.getElementById('mapImage') as HTMLImageElement;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(image, 0, 0);
    const px = Math.round(((x + 48) / 96) * (canvas.width - 1));
    const py = Math.round(((z - cz + 48) / 96) * (canvas.height - 1));
    const radius = 8;
    const size = radius * 2 + 1;
    // Clamp the ROI inside the image so edge-adjacent samples never throw.
    const sx = Math.max(0, Math.min(canvas.width - size, px - radius));
    const sy = Math.max(0, Math.min(canvas.height - size, py - radius));
    const patch = ctx.getImageData(sx, sy, size, size).data;
    let min = Infinity;
    for (let i = 0; i < patch.length; i += 4) {
      min = Math.min(min, (patch[i]! + patch[i + 1]! + patch[i + 2]!) / 3);
    }
    return min;
  }, { x: worldX, z: worldZ, cz: centerZ });
}

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
  // On their own page the player marker is shown.
  await expect(page.locator('#mapMarker')).toBeVisible();

  // Searching a north-district building by its ID and picking the result
  // flips the paper to the north page so the selection is visible there.
  const search = page.locator('#mapSearchInput');
  await search.fill('north_bistro');
  await expect(page.locator('.map-search-result[data-building-id="north_bistro"]')).toHaveCount(1);
  await page.locator('.map-search-result[data-building-id="north_bistro"]').click();
  await expect(page.locator('#mapTitle')).toHaveText('物实小城 · 星语北城');
  await expect(page.locator('.map-icon[data-building-id="north_bistro"]')).toHaveClass(/is-selected/);
  await expect(page.locator('#mapTipTitle')).toHaveText('会员制餐厅');
  // The player never left the main city, so the "you are here" dot has no
  // spot on the north page and must be hidden rather than clamped to an edge.
  await expect(page.locator('#mapMarker')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the north page capture hides main-city buildings inside its frame', async ({ page }) => {
  test.setTimeout(150_000);
  await page.clock.setFixedTime(new Date('2026-09-25T00:12:00Z'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await stubCityAndBoot(page, 'map-regions-hide-tester');
  await waitForCityReady(page, 'map-regions-hide-tester');
  await waitForMapShotsPreloaded(page);

  // Main page: mall_south is on its own page, so its dark roof is rendered.
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapTitle')).toHaveText('物实小城 · 主城');
  await expect(page.locator('.map-icon[data-building-id="mall_south"]')).toHaveCount(1);
  const mainBrightness = await minBrightnessAt(page, 22.5, -22.5, 0);

  // North page: the same world point falls inside the frame (the district's
  // centre is at z=-64, so z=-22.5 maps to the lower band) but belongs to the
  // main city, so the capture must paint sky there — not the building.
  await page.locator('#mapClose').click({ force: true });
  await page.evaluate(() => (window as unknown as CityWindow)._mini.teleport(0, -63));
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapTitle')).toHaveText('物实小城 · 星语北城');
  await expect(page.locator('.map-icon[data-building-id="mall_south"]')).toHaveCount(0);
  const northBrightness = await minBrightnessAt(page, 22.5, -22.5, -64);

  // The main page shows the dark mall roof; the north page shows only sky.
  // Thresholds stay well clear of both the roof and sky means so PNG
  // compression / antialiasing / DPR swings on software GL cannot flake them.
  expect(northBrightness).toBeGreaterThan(170);
  expect(northBrightness - mainBrightness).toBeGreaterThan(30);
  expect(errors).toEqual([]);
});
