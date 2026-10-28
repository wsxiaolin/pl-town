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

test('boot preloads all three atlas map pages before the map is ever opened', async ({ page }) => {
  // Keep the town clock in daytime: theme flips invalidate atlas pages and
  // would race the preload assertions.
  await page.clock.setFixedTime(new Date('2026-09-25T00:12:00Z'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await stubCityAndBoot(page, 'map-regions-preload-tester');
  await waitForCityReady(page, 'map-regions-preload-tester');
  await waitForMapShotsPreloaded(page);
  // All three atlas pages (main, north, and the year-town archipelago sea
  // chart) are cached without the overlay ever having opened: the captures
  // came from the boot-time preload, and the <img> is still untouched.
  const ready = await page.evaluate(() => (window as unknown as CityWindow)._mini.mapShotsReady());
  expect(ready).toEqual({ main: true, north: true, archipelago: true });
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
  // Same budget bump as the two walk-through tests below: the boot preload now
  // captures a third atlas page (the archipelago sea chart), and one SwiftShader
  // boot alone eats 30–40 s of the default 60 s budget.
  test.setTimeout(150_000);
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

// T6R-b5 (设计 §5.3「8 镇名标注」): the sea chart page carries a persistent
// 「年份·镇名」 label for each of the 8 year towns, anchored on the same
// projection percentages as the T3a town icons (towns.ts town centres), while
// the click-to-tip interaction stays on the icon button itself.
test('the sea chart page labels the eight year towns by name', async ({ page }) => {
  test.setTimeout(150_000);
  await page.clock.setFixedTime(new Date('2026-09-25T00:12:00Z'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await stubCityAndBoot(page, 'map-town-labels-tester');
  await waitForCityReady(page, 'map-town-labels-tester');
  await waitForMapShotsPreloaded(page);

  // Standing on 盛夏镇's island flips the paper to the sea chart page.
  await page.evaluate(() => (window as unknown as CityWindow)._mini.teleport(-126, 232));
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
  await expect(page.locator('#mapTitle')).toHaveText('物实小城 · 群岛海图');
  await expect(page.locator('.map-town-icon')).toHaveCount(8);

  // Every town gets one label with the「年份·镇名」wording, anchored exactly on
  // its icon (same left/top percentages — the label never drifts off the
  // island) and fully inside the chart frame.
  const labels = await page.evaluate(() => {
    const wrap = document.getElementById('mapIcons')!;
    const frame = document.getElementById('mapImageWrap')!.getBoundingClientRect();
    return Array.from(wrap.querySelectorAll<HTMLElement>('.map-town-label')).map((label) => {
      const icon = wrap.querySelector<HTMLElement>(`.map-town-icon[data-town-id="${label.dataset.townId}"]`);
      const box = label.getBoundingClientRect();
      return {
        text: label.textContent,
        className: label.className,
        anchored: icon?.style.left === label.style.left && icon?.style.top === label.style.top,
        insideFrame: box.left >= frame.left - 0.5 && box.right <= frame.right + 0.5
          && box.top >= frame.top - 0.5 && box.bottom <= frame.bottom + 0.5,
      };
    });
  });
  expect(labels.map((label) => label.text)).toEqual([
    '2019·起源村', '2020·启明镇', '2021·潮声镇', '2022·盛夏镇',
    '2023·回响镇', '2024·微光镇', '2025·长风镇', '2026·星港',
  ]);
  for (const label of labels) {
    expect(label.anchored).toBe(true);
    expect(label.insideFrame).toBe(true);
  }

  // The eastern/western edge towns flip their label alignment instead of
  // spilling past the chart frame (.map-image-wrap clips overflow).
  expect(labels.find((label) => label.text === '2019·起源村')?.className).toContain('map-town-label--e');
  expect(labels.find((label) => label.text === '2024·微光镇')?.className).toContain('map-town-label--w');

  // The labels are read-only annotations: picking the 盛夏 icon still opens the
  // town tip — the interaction paradigm stays on the icon button (T3a).
  await page.locator('.map-town-icon[data-town-id="island-2022"]').click({ force: true });
  await expect(page.locator('#mapTipTitle')).toHaveText('2022·盛夏镇');
  expect(errors).toEqual([]);
});
