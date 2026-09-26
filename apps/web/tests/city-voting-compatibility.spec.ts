import { expect, test } from '@playwright/test';
import { pushCityState, stubCityWebSocket, waitForCityReady } from './helpers';

test('pre-voting server snapshots preserve construction while mutation receipts stay strict', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const config = {
    schemaVersion: 1, version: 'pre-voting-server', initialBuiltBuildingIds: ['commons'],
    projects: [{ id: 'library', buildingId: 'library', name: '图书馆', description: '共同建设', kind: 'building', cost: 3000 }],
    personalPlots: [], decorations: [],
  };
  let state = { configVersion: config.version, epoch: 'old-server', revision: 1,
    projects: [{ id: 'library', funded: 3000, built: true }], decorations: [] };
  const requests: string[] = [];
  stubCityWebSocket(page, { user: 'compat-resident', unlockedBuildings: ['commons', 'library'] });
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    if (path.endsWith('/city/votes')) return route.fulfill({ status: 404, json: { error: 'Unknown city endpoint' } });
    if (path.endsWith('/city/donate')) {
      state = { ...state, revision: 3, projects: [{ id: 'library', funded: 100, built: false }] };
      return route.fulfill({ json: { state } });
    }
    if (path.endsWith('/city/vote')) {
      requests.push(route.request().postDataJSON().requestId);
      return route.fulfill({ json: { state: requests.length === 1 ? state : {
        ...state, revision: 4, projects: [{ id: 'library', funded: 0, built: false, votes: 1 }],
      }, votes: { epoch: state.epoch, projectIds: ['library'] } } });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'compat-resident');
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  const panel = page.locator('.city-governance-panel');
  const project = panel.locator('[data-city-project="library"]');
  await expect(project).toContainText('已建成');
  const visibleLibrary = () => page.evaluate(() => {
    let found = false;
    (window as any)._mini.scene.traverse((object: any) => {
      if (object.isMesh && object.userData.buildingId === 'library') found = true;
    });
    return found;
  });
  await expect.poll(visibleLibrary).toBe(true);
  // Legacy broadcasts follow the same additive read path.
  state = { ...state, revision: 2, projects: [{ id: 'library', funded: 0, built: false }] };
  await pushCityState(page, state);
  await expect(project.getByRole('button', { name: '捐款', exact: true })).toBeVisible();
  await expect.poll(visibleLibrary).toBe(false);
  await pushCityState(page, { ...state, revision: 3, projects: [{ ...state.projects[0], votes: 'invalid' }] });
  await expect(panel.locator('[data-city-status]')).toHaveText('云端进度 #2');
  await project.getByRole('button', { name: '捐款', exact: true }).click();
  await expect(project).toContainText('100 金币');
  await expect(panel.locator('[data-city-feedback]')).toBeHidden();
  // A missing count in a write response is still unconfirmed and retains its ID.
  await project.getByRole('button', { name: '投票建设', exact: true }).click();
  await expect(panel.locator('[data-city-vote-feedback]')).toContainText('投票结果暂时不可用');
  await project.getByRole('button', { name: '投票建设', exact: true }).click();
  await expect(project.getByRole('button', { name: '已投票', exact: true })).toBeDisabled();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
  expect(errors).toEqual([]);
});
