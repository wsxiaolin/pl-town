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
  for (let revision = 1; revision <= 13; revision += 1) {
    const built = revision % 2 === 1;
    await page.evaluate(async (nextState) => {
      // Playwright uses the Vite dev harness; exercise its real state receiver
      // without adding a production-only debug API for governance updates.
      const modulePath = '/src/city/cityGovernanceClient.ts';
      const { applyCityState } = await import(modulePath);
      applyCityState(nextState);
    }, { ...state, revision, projects: [{ id: 'build-library', funded: built ? 3000 : 0, built }] });
    await expect(page.locator('.map-icon[data-building-id="library"]')).toHaveCount(built ? 1 : 0);
    await expect(page.locator('.map-search-result[data-building-id="library"]')).toHaveCount(built ? 1 : 0);
  }
  expect(await page.evaluate(() => (window as any).mapTestWebGLContexts)).toBe(contexts);
  expect(await page.locator('#mapImage').getAttribute('src')).toBe(shot);
  await page.locator('#mapClose').click({ force: true });
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapImage')).not.toHaveAttribute('src', shot!);
  expect(await page.evaluate(() => (window as any)._mini.renderer.getContext().isContextLost())).toBe(false);
  expect(errors).toEqual([]);
});

test('construction updates retain map search selection, focus and dismissed results', async ({ page }) => {
  const config = {
    schemaVersion: 1, version: 'map-search-update-test', initialBuiltBuildingIds: ['commons', 'mall_south', 'mall_west'],
    projects: [{ id: 'build-library', buildingId: 'library', name: '图书馆', kind: 'building', description: '共同筹建', cost: 3000 }],
    personalPlots: [], decorations: [],
  };
  const state = { epoch: 'map-search-test', revision: 0, configVersion: config.version,
    projects: [{ id: 'build-library', funded: 0, built: false }], decorations: [] };
  stubCityWebSocket(page, { user: 'map-search-update-tester', unlockedBuildings: ['commons', 'mall_south', 'mall_west', 'library'] });
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'map-search-update-tester');
  await page.locator('#mapToggle').click({ force: true });
  const search = page.locator('#mapSearchInput');
  const results = page.locator('#mapSearchResults');
  await search.fill('mall');
  await expect(page.locator('.map-search-result')).toHaveCount(2);
  await search.press('ArrowDown');
  const activeId = await page.locator('.map-search-result.is-active').getAttribute('data-building-id');
  await expect(search).toHaveAttribute('aria-activedescendant', 'mapSearchResult-1');
  const updateLibrary = async (revision: number, built: boolean) => {
    await page.evaluate(async (nextState) => {
      // The Vite dev harness shares this module with the running city.
      const modulePath = '/src/city/cityGovernanceClient.ts';
      const { applyCityState } = await import(modulePath);
      applyCityState(nextState);
    }, { ...state, revision, projects: [{ id: 'build-library', funded: built ? 3000 : 0, built }] });
    await expect(page.locator('.map-icon[data-building-id="library"]')).toHaveCount(built ? 1 : 0);
  };
  await updateLibrary(1, true);
  await expect(page.locator('.map-search-result.is-active')).toHaveAttribute('data-building-id', activeId!);
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute('aria-activedescendant', 'mapSearchResult-1');

  await search.press('Escape');
  await expect(results).toBeHidden();
  await updateLibrary(2, false);
  await expect(results).toBeHidden();
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute('aria-expanded', 'false');
  await expect(search).not.toHaveAttribute('aria-activedescendant', /.+/);

  await search.fill('mall ');
  await search.press('Enter');
  await expect(page.locator('#mapTip')).toHaveClass(/open/);
  await expect(results).toBeHidden();
  const confirmedId = await page.locator('.map-icon.is-confirmed').getAttribute('data-building-id');
  await updateLibrary(3, true);
  await expect(results).toBeHidden();
  await expect(page.locator('.map-icon.is-confirmed')).toHaveAttribute('data-building-id', confirmedId!);
  await expect(page.locator('#mapTip')).toHaveClass(/open/);
});
