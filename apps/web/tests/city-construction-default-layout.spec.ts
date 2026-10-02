import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';

// Personal construction is retired: the curated `personalBlocks` layout now
// ships as the default city scenery for every resident, with no build action.
const config = (): CityConfig => ({
  schemaVersion: 1, version: 'default-layout-test', projects: [],
  personalPlots: [
    { id: 'garden-1', name: '花园一号', x: 30, z: -40, options: ['flowers', 'cherry'] },
    { id: 'garden-2', name: '花园二号', x: 34, z: -40, options: ['oak', 'flowers'] },
  ],
  personalBlocks: [{ id: 'garden-block', name: '花园区块', areaId: null, description: '两处装饰一次呈现。', cost: 300,
    placements: [{ plotId: 'garden-1', decorationId: 'flowers' }, { plotId: 'garden-2', decorationId: 'oak' }] }],
  decorations: [
    { id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 },
    { id: 'oak', name: '橡树', kind: 'oak', cost: 180 },
    { id: 'cherry', name: '樱花树', kind: 'cherry', cost: 240 },
  ],
  initialBuiltBuildingIds: ['commons', 'commons_outer'],
});

async function stub(page: import('@playwright/test').Page, state: CityState): Promise<void> {
  stubCityWebSocket(page, { user: 'layout-tester', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ status: 200, json: config() });
    if (path.endsWith('/city/state')) return route.fulfill({ status: 200, json: state });
    if (path.endsWith('/city/votes')) return route.fulfill({ status: 200, json: { epoch: state.epoch, projectIds: [] } });
    if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
    return route.continue();
  });
}

const defaultPlotKeys = (page: import('@playwright/test').Page) => page.evaluate(() => {
  const root = (window as any)._mini.scene.getObjectByName('city-construction');
  return (root?.children ?? [])
    .map((child: any) => child.name)
    .filter((name: string) => name.startsWith('plot:'));
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 844, height: 390 }]) {
  test(`curated details render by default without a personal construction tab at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const state: CityState = { epoch: 'default-layout', revision: 0, configVersion: 'default-layout-test', projects: [], decorations: [] };
    await stub(page, state);
    await waitForCityReady(page, 'layout-tester');

    await expect.poll(async () => (await defaultPlotKeys(page)).sort()).toEqual(['plot:garden-1', 'plot:garden-2']);

    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    const panel = page.locator('.city-governance-panel');
    await expect(panel).toHaveAttribute('open', '');
    await expect(panel.locator('.city-governance-tabs')).toHaveCount(0);
    await expect(panel.locator('[data-city-block]')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: '个人建设', exact: true })).toHaveCount(0);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('a persisted decoration replaces the default preset on its plot', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  // garden-2 keeps a historical record, so its preset oak must not be placed;
  // the plot still exists under the resident's own decoration.
  const state: CityState = {
    epoch: 'default-layout', revision: 3, configVersion: 'default-layout-test', projects: [],
    decorations: [{ plotId: 'garden-2', decorationId: 'cherry', ownerId: 'legacy-resident', ownerNickname: '老居民' }],
  };
  await stub(page, state);
  await waitForCityReady(page, 'layout-tester');

  const plotKeys = () => page.evaluate(() => {
    const root = (window as any)._mini.scene.getObjectByName('city-construction');
    return (root?.children ?? [])
      .filter((child: any) => child.name.startsWith('plot:'))
      .map((child: any) => child.name);
  });
  await expect.poll(async () => (await plotKeys()).sort()).toEqual(['plot:garden-1', 'plot:garden-2']);
  // The legacy record (cherry) must win over the block's oak on garden-2; count
  // the cherry foliage signature the decoration factory emits.
  await expect.poll(() => page.evaluate(() => {
    const root = (window as any)._mini.scene.getObjectByName('city-construction');
    let cherry = 0;
    root?.traverse((object: any) => {
      if (object.isMesh && object.material?.color?.getHex() === 0xe5a2bd) cherry += 1;
    });
    return cherry;
  })).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
