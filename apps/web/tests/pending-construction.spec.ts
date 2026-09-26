import { expect, test } from '@playwright/test';
import { BUILDING_DEFS } from '../src/city/data/buildings';
import type { CityConfig } from '../src/city/cityGovernanceClient';
import { pushCityState, stubCityWebSocket, waitForCityReady } from './helpers';

for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }]) {
  test(`pending buildings hide models, lots, labels and map entries at ${viewport.width}px`, async ({ page }, testInfo) => {
    // This covers archive, memorial, map and construction with several WebGL
    // captures. Software rendering needs a larger overall flow budget.
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // Exercise every client building without coupling the browser fixture to
    // server source loading. Server integration tests verify the real catalog.
    let config: CityConfig = {
      schemaVersion: 1, version: 'pending-test', initialBuiltBuildingIds: ['commons'],
      projects: [...BUILDING_DEFS.filter((building) => building.id !== 'commons').map((building) => ({
        id: `build-${building.id}`, buildingId: building.id, name: building.label,
        kind: 'building' as const, description: '共同筹建', cost: 3000,
      })), { id: 'greenbelt-benches', name: '绿道座椅', kind: 'decoration', description: '公共休憩点', cost: 300 }],
      personalPlots: [], decorations: [],
    };
    const libraryProject = config.projects.find((project) => project.buildingId === 'library')!;
    let state = { epoch: 'pending-test', revision: 0, configVersion: config.version,
      projects: config.projects.map((project) => ({ id: project.id, funded: 0, built: false })), decorations: [] };
    let blockReload = false;
    let configRequests = 0;
    let releaseReload!: () => void;
    const reloadGate = new Promise<void>((resolve) => { releaseReload = resolve; });
    stubCityWebSocket(page, { user: 'pending-tester', unlockedBuildings: ['commons', 'library'] });
    await page.route('**/town-api/telemetry/event', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('**/town-api/city/**', async (route) => {
      const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
      if (endpoint === 'config') {
        configRequests += 1;
        if (blockReload) await reloadGate;
      }
      if (endpoint === 'donate') {
        state = { ...state, revision: state.revision + 1, projects: state.projects.map((project) => project.id === libraryProject.id ? { ...project, funded: libraryProject.cost, built: true } : project) };
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(endpoint === 'config' ? config : endpoint === 'donate' ? { state } : state) });
    });
    await waitForCityReady(page, 'pending-tester');
    const renderedBuildingIds = () => page.evaluate(() => {
      const ids = new Set<string>();
      (window as any)._mini.scene.traverse((object: any) => {
        if (object.isMesh && object.userData.buildingId) ids.add(object.userData.buildingId);
      });
      return [...ids].sort();
    });
    await expect.poll(renderedBuildingIds).toEqual(['commons']);
    for (const id of ['stats', 'elevator', 'commons_outer']) {
      expect(await page.evaluate((buildingId) => (window as any)._mini.interactBuilding(buildingId), id)).toBe(false);
    }
    const archive = page.getByRole('button', { name: '档案', exact: true });
    await archive.click({ force: true });
    await expect(page.locator('#statsPanel')).toHaveClass(/open/);
    await expect(archive).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#spBody')).toContainText('ACHIEVEMENTS');
    await expect(page.locator('#spBody .sp-cards')).toBeVisible();
    await expect.poll(() => page.locator('#statsPanel').evaluate((panel) => {
      const bounds = panel.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth + 0.5;
    })).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('new-town-archive.png') });
    await page.getByRole('button', { name: '永退纪念碑', exact: true }).click();
    await expect(page.locator('#statsPanel')).not.toHaveClass(/open/);
    await expect(page.locator('#memorialOverlay')).toHaveClass(/open/);
    await expect(page.locator('#memorialTitle')).toHaveText('物实永退用户纪念碑');
    await expect(page.locator('.memorial-name')).toHaveCount(30);
    await expect(page.locator('#memorialClose')).toBeFocused();
    await page.locator('#memorialNext').click();
    await expect(page.locator('#memorialPager')).toHaveText('2 / 4');
    await page.screenshot({ path: testInfo.outputPath('new-town-memorial.png') });
    await page.locator('#memorialClose').press('Escape');
    await expect(page.locator('#memorialOverlay')).not.toHaveClass(/open/);
    await expect(archive).toBeFocused();
    expect(await renderedBuildingIds()).toEqual(['commons']);
    expect(await page.evaluate(() => {
      const header = document.querySelector('.ui-header')!;
      return [...header.querySelectorAll('button')].every((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width === 0 || (rect.left >= 0 && rect.right <= innerWidth);
      });
    })).toBe(true);
    blockReload = true;
    config = { ...config, version: 'pending-test-next' };
    state = { ...state, configVersion: config.version };
    // Delay the config reload triggered by a real WebSocket broadcast.
    await pushCityState(page, state);
    await expect.poll(() => configRequests).toBe(2);
    expect(await renderedBuildingIds()).toEqual(['commons']);
    expect(await page.evaluate(() => (window as any)._mini.interactBuilding('library'))).toBe(false);
    const reloadedState = page.waitForResponse('**/town-api/city/state');
    releaseReload();
    await reloadedState;
    await expect(page.locator('.b-label-item')).toHaveCount(1);
    await expect(page.locator('.b-label-item[data-building-id="commons"]')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('pending-near.png') });
    for (let i = 0; i < 20; i++) await page.locator('#c').dispatchEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    await expect.poll(() => page.evaluate(() => (window as any)._mini.cameraZoom)).toBe(15);
    await page.screenshot({ path: testInfo.outputPath('pending-far.png') });
    expect(await page.evaluate(() => (window as any)._mini.interactBuilding('library'))).toBe(false);
    expect(await page.evaluate(() => (window as any)._mini.openBuildingDialog('library'))).toBe(false);
    expect(await page.evaluate(() => (window as any)._mini.interactBuilding('photostudio'))).toBe(false);
    await page.locator('#mapToggle').click({ force: true });
    await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
    await expect(page.locator('.map-icon')).toHaveCount(1);
    await page.locator('#mapSearchInput').fill('图书馆');
    await expect(page.locator('.map-search-result')).toHaveCount(0);
    await page.locator('#mapClose').click({ force: true });
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    const panel = page.locator('.city-governance-panel');
    await panel.getByRole('navigation', { name: '建设项目分类' }).getByRole('button', { name: '道路与绿化' }).click();
    await expect(panel.getByRole('heading', { name: '道路与绿化' })).toBeFocused();
    await expect(panel.locator('[data-project-id="greenbelt-benches"]')).toBeInViewport();
    await page.screenshot({ path: testInfo.outputPath('public-works-jump.png') });
    await panel.locator('[data-building-id="library"]').getByRole('button', { name: '捐款', exact: true }).click();
    await expect.poll(renderedBuildingIds).toEqual(['commons', 'library']);
    await expect(page.locator('.b-label-item[data-building-id="library"]')).toHaveCount(1);
    // Completion restores both the building and its separate ground plot.
    expect(await page.evaluate(() => (window as any)._mini.scene.children.some((object: any) => object.isMesh && object.userData.buildingId === 'library' && object.visible))).toBe(true);
    await panel.getByRole('button', { name: '关闭' }).click();
    await expect(panel).not.toBeVisible();
    await page.locator('#mapToggle').click({ force: true });
    await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
    await expect(page.locator('.map-icon[data-building-id="library"]')).toHaveCount(1);
    await page.locator('#mapClose').click({ force: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const canvas = page.locator('#c');
    await expect(canvas).toBeVisible();
    expect(await page.evaluate(() => (window as any)._mini.renderer.getContext().isContextLost())).toBe(false);
    expect(errors).toEqual([]);
  });
}
