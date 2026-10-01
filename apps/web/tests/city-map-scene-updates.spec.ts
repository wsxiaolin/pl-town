import { expect, test, type Page } from '@playwright/test';
import type { WebGLRenderer } from 'three';
import { BUILDING_DEFS } from '../src/city/data/buildings';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import type { MiniCityDebugApi } from '../src/city/debugApi';
import { stubCityWebSocket, stubWorldCatalogWebSocket, waitForCityReady } from './helpers';

type MapSceneWindow = Window & {
  _mini: MiniCityDebugApi;
  sceneMapWebGLContexts: number;
  __pushWorldCatalog: (catalog: Record<string, unknown>) => void;
};

async function openMap(page: Page, catalogChanges = false) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.clock.setFixedTime(new Date('2026-09-25T00:12:00Z'));
  await page.addInitScript(() => {
    const testWindow = window as unknown as MapSceneWindow;
    testWindow.sceneMapWebGLContexts = 0;
    const canvases = new WeakSet<HTMLCanvasElement>();
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { configurable: true, value: new Proxy(original, {
      apply(target, canvas: HTMLCanvasElement, args: unknown[]) {
        const context = Reflect.apply(target, canvas, args);
        if (context && ['webgl', 'webgl2', 'experimental-webgl'].includes(String(args[0])) && !canvases.has(canvas)) {
          canvases.add(canvas);
          testWindow.sceneMapWebGLContexts += 1;
        }
        return context;
      },
    }) });
  });
  const config: CityConfig = {
    schemaVersion: 1, version: 'map-scene', initialBuiltBuildingIds: ['commons'],
    projects: BUILDING_DEFS.filter(({ id }) => id !== 'commons').map(({ id, label }) => ({
      id: `build-${id}`, buildingId: id, kind: 'building', name: label, description: '共同筹建', cost: 3000,
    })), personalPlots: [], decorations: [],
  };
  const state: CityState = {
    epoch: 'map-scene', revision: 0, configVersion: config.version,
    projects: config.projects.map(({ id, cost }) => ({ id, funded: cost, built: true, votes: 0 })), decorations: [],
  };
  if (catalogChanges) stubWorldCatalogWebSocket(page, 'map-scene-tester');
  else stubCityWebSocket(page, { user: 'map-scene-tester', unlockedBuildings: ['commons', 'library'] });
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'map-scene-tester');
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
  await expect(page.locator('#mapImage')).toHaveAttribute('src', /^data:image\/png/);
  return errors;
}

const contextCount = (page: Page) => page.evaluate(() => (window as unknown as MapSceneWindow).sceneMapWebGLContexts);

async function passAnimationFrames(page: Page) {
  await page.evaluate(async () => {
    for (let frame = 0; frame < 2; frame++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function expectSceneRefresh(page: Page, previousShot: string | null, previousContexts: number, query: string) {
  const image = page.locator('#mapImage');
  await expect.poll(async () => (await image.getAttribute('src')) !== previousShot, { timeout: 10_000 }).toBe(true);
  await passAnimationFrames(page);
  expect(await contextCount(page)).toBeLessThanOrEqual(previousContexts + 1);
  await expect(image).toBeVisible();
  await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
  await expect(page.locator('#mapSearchInput')).toHaveValue(query);
  await expect(page.locator('#mapSearchInput')).toBeFocused();
  expect(await image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  expect(await page.evaluate(() => ((window as unknown as MapSceneWindow)._mini.renderer as WebGLRenderer).getContext().isContextLost())).toBe(false);
}

test('an open map refreshes after debug damage and repair with one capture per batch', async ({ page }) => {
  const errors = await openMap(page);
  const search = page.locator('#mapSearchInput');
  const icon = page.locator('.map-icon[data-building-id="library"]');
  const result = page.locator('.map-search-result[data-building-id="library"]');
  await search.fill('图书馆');
  await expect(icon).toHaveCount(1);
  await expect(result).toHaveCount(1);
  for (const action of ['destroyBuilding', 'restoreBuilding', 'destroyAll', 'restoreAll'] as const) {
    await test.step(action, async () => {
      const previousShot = await page.locator('#mapImage').getAttribute('src');
      const previousContexts = await contextCount(page);
      const changed = await page.evaluate((command) => {
        const city = (window as unknown as MapSceneWindow)._mini;
        return command === 'destroyAll' || command === 'restoreAll' ? city[command]() : city[command]('library');
      }, action);
      if (typeof changed === 'number') expect(changed).toBeGreaterThan(1);
      else expect(changed).toBe(true);
      await expectSceneRefresh(page, previousShot, previousContexts, '图书馆');
      const restored = action.startsWith('restore');
      await expect(icon).toHaveCount(restored ? 1 : 0);
      await expect(result).toHaveCount(restored ? 1 : 0);
      if (action === 'destroyAll') await expect(page.locator('.map-icon')).toHaveCount(0);
    });
  }

  // Close synchronously before the queued frame: a hidden map must not spend
  // another WebGL context. Reopening captures the now-damaged scene once.
  const beforeClose = await contextCount(page);
  expect(await page.evaluate(() => {
    const changed = (window as unknown as MapSceneWindow)._mini.destroyBuilding('library');
    document.querySelector<HTMLButtonElement>('#mapClose')!.click();
    return changed;
  })).toBe(true);
  await expect(page.locator('#mapOverlay')).not.toHaveClass(/show/);
  await passAnimationFrames(page);
  expect(await contextCount(page)).toBe(beforeClose);
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
  expect(await contextCount(page)).toBe(beforeClose + 1);
  await expect(icon).toHaveCount(0);
  expect(await page.evaluate(() => ((window as unknown as MapSceneWindow)._mini.renderer as WebGLRenderer).getContext().isContextLost())).toBe(false);
  expect(errors).toEqual([]);
});

test('world catalog unlocks and locks refresh an open map scene and its controls', async ({ page }) => {
  const errors = await openMap(page, true);
  const search = page.locator('#mapSearchInput');
  const icon = page.locator('.map-icon[data-building-id="litreview"]');
  const result = page.locator('.map-search-result[data-building-id="litreview"]');
  await search.fill('litreview');
  await expect(icon).toHaveCount(0);
  await expect(result).toHaveCount(0);
  for (const unlocked of [true, false]) {
    const previousShot = await page.locator('#mapImage').getAttribute('src');
    const previousContexts = await contextCount(page);
    await page.evaluate((value) => {
      (window as unknown as MapSceneWindow).__pushWorldCatalog({
        initialCurrency: 0, buildingPrices: {}, buildingUnlockable: { litreview: true },
        globallyUnlockedBuildings: value ? ['litreview'] : [], achievementRewards: {}, products: {},
      });
    }, unlocked);
    await expectSceneRefresh(page, previousShot, previousContexts, 'litreview');
    await expect(icon).toHaveCount(unlocked ? 1 : 0);
    await expect(result).toHaveCount(unlocked ? 1 : 0);
  }
  expect(errors).toEqual([]);
});
