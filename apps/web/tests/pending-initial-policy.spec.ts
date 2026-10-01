import { expect, test } from '@playwright/test';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import type { MiniCityDebugApi } from '../src/city/debugApi';
import { pushCityState, stubCityWebSocket, waitForCityReady } from './helpers';

type CityWindow = Window & { _mini: MiniCityDebugApi };

test('new initial policy reveals a previously pending building even when state refresh fails', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let config: CityConfig = {
    schemaVersion: 1, version: 'pending-initial-v1', initialBuiltBuildingIds: ['commons'],
    projects: ['library', 'research', 'academy'].map((id) => ({
      id: `build-${id}`, buildingId: id, kind: 'building', name: id, description: '共同筹建', cost: 3000,
    })), personalPlots: [], decorations: [],
  };
  let state: CityState = {
    epoch: 'pending-initial', revision: 0, configVersion: config.version,
    projects: config.projects.map(({ id }) => ({ id, funded: id === 'build-research' ? 3000 : 0, built: id === 'build-research', votes: 0 })), decorations: [],
  };
  let failState = false;
  let stateRequests = 0;
  stubCityWebSocket(page, { user: 'pending-initial-tester', unlockedBuildings: ['commons', 'library', 'research'] });
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) {
      stateRequests++;
      return failState ? route.fulfill({ status: 503, body: '' }) : route.fulfill({ json: state });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'pending-initial-tester');
  const library = page.locator('.b-label-item[data-building-id="library"]');
  const research = page.locator('.b-label-item[data-building-id="research"]');
  const academy = page.locator('.b-label-item[data-building-id="academy"]');
  await expect(library).toHaveCount(0);
  await expect(research).toHaveCount(1);
  await expect(academy).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.interactBuilding('library'))).toBe(false);

  config = {
    ...config, version: 'pending-initial-v2', initialBuiltBuildingIds: ['commons', 'library'],
    projects: [...config.projects.filter(({ buildingId }) => buildingId !== 'library'), {
      id: 'build-photostudio', buildingId: 'photostudio', kind: 'building', name: '照相馆', description: '共同筹建', cost: 3000,
    }],
  };
  state = { ...state, configVersion: config.version };
  failState = true;
  // A config-version broadcast triggers the actual client reload path. The
  // configuration now defines library as initial; HTTP progress is unavailable.
  await pushCityState(page, state);
  await expect.poll(() => stateRequests).toBe(2);
  await expect(library).toHaveCount(1);
  await expect(research).toHaveCount(1);
  await expect(academy).toHaveCount(0);
  await expect(page.locator('.b-label-item[data-building-id="photostudio"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.interactBuilding('library'))).toBe(true);
  expect(errors).toEqual([]);
});
