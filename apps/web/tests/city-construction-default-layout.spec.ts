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
    placements: [{ plotId: 'garden-1', decorationId: 'oak' }, { plotId: 'garden-2', decorationId: 'oak' }] }],
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
  // Both plots preset to oak. garden-2 keeps a historical record, so its preset
  // must not be placed; the plot renders the resident's cherry instead.
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

  // Decoration colours are baked into vertex colours, so identify the foliage
  // by channel ordering rather than the (always white) material colour. Cherry
  // foliage 0xe5a2bd is the only preset pigment with red and blue above green;
  // oak foliage 0x68944f and the 0x795b43 trunk both keep green highest.
  const pinkVertices = (plotName: string) => page.evaluate((name) => {
    const root = (window as any)._mini.scene.getObjectByName('city-construction');
    const group = root?.children.find((child: any) => child.name === name);
    let pink = 0;
    group?.traverse((object: any) => {
      const colors = object.geometry?.attributes?.color?.array as ArrayLike<number> | undefined;
      if (!colors) return;
      for (let index = 0; index + 2 < colors.length; index += 3) {
        if (colors[index]! > colors[index + 1]! && colors[index + 2]! > colors[index + 1]!) pink += 1;
      }
    });
    return pink;
  }, plotName);

  await expect.poll(() => pinkVertices('plot:garden-2')).toBeGreaterThan(0);
  expect(await pinkVertices('plot:garden-1')).toBe(0);
  expect(errors).toEqual([]);
});
