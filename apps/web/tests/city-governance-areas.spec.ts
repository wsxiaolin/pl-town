import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';

// Personal construction is retired: the curated `personalBlocks` layout now
// ships as the default city scenery for every resident, with no build action.
test('curated personal layout renders by default without a personal construction tab', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const plots = [
    { id: 'garden-1', name: '花园一号', x: 30, z: -40, options: ['flowers', 'cherry'] },
    { id: 'garden-2', name: '花园二号', x: 34, z: -40, options: ['oak', 'flowers'] },
  ];
  const config: CityConfig = {
    schemaVersion: 1, version: 'default-layout-test', projects: [],
    personalPlots: plots,
    personalBlocks: [{ id: 'garden-block', name: '花园区块', areaId: null, description: '两处装饰一次呈现。', cost: 300,
      placements: [{ plotId: 'garden-1', decorationId: 'flowers' }, { plotId: 'garden-2', decorationId: 'oak' }] }],
    decorations: [
      { id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 },
      { id: 'oak', name: '橡树', kind: 'oak', cost: 180 },
      { id: 'cherry', name: '樱花树', kind: 'cherry', cost: 240 },
    ],
    initialBuiltBuildingIds: ['commons', 'commons_outer'],
  };
  const state: CityState = { epoch: 'default-layout', revision: 0, configVersion: config.version, projects: [], decorations: [] };
  stubCityWebSocket(page, { user: 'layout-tester', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ status: 200, json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ status: 200, json: state });
    if (path.endsWith('/city/votes')) return route.fulfill({ status: 200, json: { epoch: state.epoch, projectIds: [] } });
    if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
    return route.continue();
  });
  await waitForCityReady(page, 'layout-tester');

  const defaultPlotKeys = () => page.evaluate(() => {
    const root = (window as any)._mini.scene.getObjectByName('city-construction');
    return (root?.children ?? [])
      .map((child: any) => child.name)
      .filter((name: string) => name.startsWith('plot:'));
  });
  await expect.poll(async () => (await defaultPlotKeys()).sort()).toEqual(['plot:garden-1', 'plot:garden-2']);

  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  const panel = page.locator('.city-governance-panel');
  await expect(panel).toHaveAttribute('open', '');
  await expect(panel.locator('.city-governance-tabs')).toHaveCount(0);
  await expect(panel.locator('[data-city-block]')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '个人建设', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});
