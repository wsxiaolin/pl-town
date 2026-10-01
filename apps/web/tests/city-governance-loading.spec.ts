import { expect, test, type Route } from '@playwright/test';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import { pushCityState, stubCityWebSocket, waitForCityReady } from './helpers';

test('config refresh distinguishes loading from failure and preserves payment feedback', async ({ page }) => {
  const config: CityConfig = {
    schemaVersion: 1, version: 'loading-v1', initialBuiltBuildingIds: ['commons'],
    projects: [{ id: 'build-library', buildingId: 'library', name: '图书馆', description: '共同筹建', kind: 'building', cost: 3000 }],
    personalPlots: [], decorations: [],
  };
  const state: CityState = { epoch: 'loading-epoch', revision: 0, configVersion: config.version,
    projects: [{ id: 'build-library', funded: 0, built: false, votes: 0 }], decorations: [] };
  const mutations: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  let holdReads = false;
  let configRead: Route | undefined;
  let stateRead: Route | undefined;
  stubCityWebSocket(page, { user: 'loading-tester', unlockedBuildings: ['commons'] });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/town-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) {
      if (holdReads) { configRead = route; return; }
      return route.fulfill({ json: config });
    }
    if (path.endsWith('/city/state')) {
      if (holdReads) { stateRead = route; return; }
      return route.fulfill({ json: state });
    }
    if (path.endsWith('/city/donate')) {
      mutations.push(route.request().postDataJSON() as Record<string, unknown>);
      return route.fulfill({ status: 503, json: { error: 'Internal server error' } });
    }
    if (path.endsWith('/city/votes')) return route.fulfill({ json: { epoch: state.epoch, projectIds: [] } });
    if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 404, json: { error: 'Unexpected test endpoint' } });
  });
  await waitForCityReady(page, 'loading-tester');
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  const panel = page.locator('.city-governance-panel');
  await panel.getByRole('spinbutton', { name: '图书馆捐款金额' }).fill('250');
  await panel.getByRole('button', { name: '捐款', exact: true }).click();
  const feedback = panel.locator('[data-city-feedback]');
  await expect(feedback).toContainText('「图书馆」城市建设服务暂时异常');

  holdReads = true;
  config.version = 'loading-v2';
  state.configVersion = config.version;
  await pushCityState(page, state);
  const assertLoading = async () => {
    await expect(panel.locator('[data-city-status]')).toHaveText('正在加载建设进度…');
    await expect(panel.locator('.city-governance-body')).toHaveText('正在加载建设进度，请稍候…');
    await expect(panel.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: '捐款', exact: true })).toHaveCount(0);
    await expect(feedback).toContainText('「图书馆」城市建设服务暂时异常');
  };
  await expect.poll(() => Boolean(configRead)).toBe(true);
  await assertLoading();
  await configRead!.fulfill({ json: config });
  await expect.poll(() => Boolean(stateRead)).toBe(true);
  await assertLoading();
  await stateRead!.fulfill({ status: 503, json: { error: 'Unavailable' } });
  await expect(panel.locator('[data-city-status]')).toHaveText('城市建设数据暂时不可用');
  await expect(panel.getByRole('button', { name: '重试', exact: true })).toBeEnabled();
  await expect(feedback).toContainText('「图书馆」城市建设服务暂时异常');

  configRead = undefined;
  stateRead = undefined;
  await panel.getByRole('button', { name: '重试', exact: true }).click();
  await expect.poll(() => Boolean(configRead)).toBe(true);
  await assertLoading();
  await configRead!.fulfill({ json: config });
  await expect.poll(() => Boolean(stateRead)).toBe(true);
  await assertLoading();
  await stateRead!.fulfill({ json: state });
  await expect(panel.getByRole('spinbutton', { name: '图书馆捐款金额' })).toHaveValue('250');
  await expect(panel.locator('[data-city-status]')).toHaveText('云端进度 #0');
  await expect(feedback).toContainText('「图书馆」城市建设服务暂时异常');
  expect(mutations).toHaveLength(1);
  await panel.getByRole('button', { name: '捐款', exact: true }).click();
  await expect.poll(() => mutations.length).toBe(2);
  // An unrelated refresh cannot replace the original uncertain payment receipt.
  expect(mutations[1]).toEqual(mutations[0]);
  expect(errors).toEqual([]);
});
