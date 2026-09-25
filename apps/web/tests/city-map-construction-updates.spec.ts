import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

test('an open map updates construction access without creating more WebGL contexts', async ({ page }) => {
  const config = {
    schemaVersion: 1, version: 'map-construction-test', initialBuiltBuildingIds: ['commons'],
    projects: [{ id: 'build-library', buildingId: 'library', name: '图书馆', kind: 'building', description: '共同筹建', cost: 3000 }],
    personalPlots: [], decorations: [],
  };
  const state = { epoch: 'map-test', revision: 0, configVersion: config.version,
    projects: [{ id: 'build-library', funded: 0, built: false }], decorations: [] };
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    const canvases = new WeakSet<HTMLCanvasElement>();
    (window as any).mapTestWebGLContexts = 0;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(args[0]) && !canvases.has(this)) {
        canvases.add(this);
        (window as any).mapTestWebGLContexts += 1;
      }
      return (original as any).apply(this, args);
    } as typeof original;
  });
  stubCityWebSocket(page, { user: 'map-construction-tester', unlockedBuildings: ['commons', 'library'] });
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'map-construction-tester');
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
  await expect(page.locator('.map-icon[data-building-id="library"]')).toHaveCount(0);
  await page.locator('#mapSearchInput').fill('图书馆');
  await expect(page.locator('.map-search-result')).toHaveCount(0);
  const contexts = await page.evaluate(() => (window as any).mapTestWebGLContexts);
  const shot = await page.locator('#mapImage').getAttribute('src');
  await page.evaluate(async (initial) => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    const { applyCityState } = await import(modulePath);
    for (let revision = 1; revision <= 12; revision += 1) {
      applyCityState({ ...initial, revision, projects: [{ id: 'build-library', funded: 3000, built: true }] });
    }
  }, state);
  await expect(page.locator('.map-icon[data-building-id="library"]')).toHaveCount(1);
  await expect(page.locator('.map-search-result[data-building-id="library"]')).toHaveCount(1);
  expect(await page.evaluate(() => (window as any).mapTestWebGLContexts)).toBe(contexts);
  expect(await page.locator('#mapImage').getAttribute('src')).toBe(shot);
  await page.locator('#mapClose').click({ force: true });
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapImage')).not.toHaveAttribute('src', shot!);
  expect(await page.evaluate(() => (window as any)._mini.renderer.getContext().isContextLost())).toBe(false);
  expect(errors).toEqual([]);
});
