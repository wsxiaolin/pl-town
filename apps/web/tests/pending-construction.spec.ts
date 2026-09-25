import { expect, test } from '@playwright/test';
import { BUILDING_DEFS } from '../src/city/data/buildings';
import { stubCityWebSocket, waitForCityReady } from './helpers';

for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }]) {
  test(`pending buildings hide models, lots, labels and map entries at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const projects = BUILDING_DEFS.filter((entry) => !entry.disabled && entry.id !== 'commons').map((building) => ({
      id: `build-${building.id}`, buildingId: building.id, name: building.label ?? building.id,
      description: `共同筹建${building.label}`, kind: 'building', cost: 3000,
    }));
    const config = { schemaVersion: 1, version: 'pending-test', projects, initialBuiltBuildingIds: ['commons'], personalPlots: [], decorations: [] };
    let state = { epoch: 'pending-test', revision: 0, configVersion: config.version,
      projects: projects.map((project) => ({ id: project.id, funded: 0, built: false })), decorations: [] };
    stubCityWebSocket(page, { user: 'pending-tester', unlockedBuildings: ['commons', 'library'] });
    await page.route('**/town-api/telemetry/event', (route) => route.fulfill({ status: 204, body: '' }));
    await page.route('**/town-api/city/**', async (route) => {
      const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
      if (endpoint === 'donate') {
        state = { ...state, revision: state.revision + 1, projects: state.projects.map((project) => project.id === 'build-library' ? { ...project, funded: 3000, built: true } : project) };
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
    await expect(page.locator('.b-label-item')).toHaveCount(1);
    await expect(page.locator('.b-label-item[data-building-id="commons"]')).toHaveCount(1);
    await page.screenshot({ path: testInfo.outputPath('pending-near.png') });
    for (let i = 0; i < 20; i++) await page.locator('#c').dispatchEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
    await expect.poll(() => page.evaluate(() => (window as any)._mini.cameraZoom)).toBe(15);
    await page.screenshot({ path: testInfo.outputPath('pending-far.png') });
    expect(await page.evaluate(() => (window as any)._mini.interactBuilding('library'))).toBe(false);
    expect(await page.evaluate(() => (window as any)._mini.openBuildingDialog('library'))).toBe(false);
    await page.locator('#mapToggle').click({ force: true });
    await expect(page.locator('#mapOverlay')).toHaveClass(/show/);
    await expect(page.locator('.map-icon')).toHaveCount(1);
    await page.locator('#mapSearchInput').fill('图书馆');
    await expect(page.locator('.map-search-result')).toHaveCount(0);
    await page.locator('#mapClose').click({ force: true });
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    const panel = page.locator('.city-governance-panel');
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
