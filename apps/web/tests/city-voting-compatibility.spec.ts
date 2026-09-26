import { expect, test, type Page, type Route } from '@playwright/test';
import { pushCityState, stubCityWebSocket, waitForCityReady } from './helpers';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';

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
    if (path.endsWith('/city/votes')) return route.fulfill({ json: { epoch: state.epoch, projectIds: [] } });
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

type LegacyState = Omit<CityState, 'projects'> & { projects: Array<Omit<CityState['projects'][number], 'votes'> & { votes?: number }> };

async function compatibilityFixture(page: Page, status: 404 | 405) {
  const config: CityConfig = {
    schemaVersion: 1, version: 'capability-fixture', initialBuiltBuildingIds: ['commons'],
    projects: [{ id: 'library', buildingId: 'library', name: '图书馆', description: '共同建设', kind: 'building', cost: 3000 }],
    personalAreas: [{ id: 'garden', name: '小花园', plotIds: ['plot-1', 'plot-2'] }],
    personalPlots: [1, 2].map((index) => ({ id: `plot-${index}`, name: `花园 ${index}`, x: 30 + index * 2, z: -40, options: ['flowers'] })),
    decorations: [{ id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 }],
  };
  let state: LegacyState = { configVersion: config.version, epoch: 'capability-epoch', revision: 0,
    projects: [{ id: 'library', funded: 0, built: false }], decorations: [] };
  const errors: string[] = [];
  const api = { supported: false, reads: 0, donations: 0, decorations: 0, votes: 0, errors };
  page.on('pageerror', (error) => errors.push(error.message));
  stubCityWebSocket(page, { user: 'compat-resident', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    if (path.endsWith('/city/votes')) {
      api.reads += 1;
      return api.supported ? route.fulfill({ json: { epoch: state.epoch, projectIds: [] } })
        : route.fulfill({ status, contentType: 'text/html', body: '<html>Unsupported endpoint</html>' });
    }
    if (path.endsWith('/city/donate')) {
      api.donations += 1;
      state = { ...state, revision: state.revision + 1, projects: [{ id: 'library', funded: 100, built: false }] };
      return route.fulfill({ json: { state } });
    }
    if (path.endsWith('/city/decorate')) {
      api.decorations += 1;
      const request = route.request().postDataJSON();
      state = { ...state, revision: state.revision + 1, decorations: config.personalPlots.slice(0, request.quantity)
        .map(({ id }) => ({ plotId: id, decorationId: request.decorationId, ownerId: 'compat-resident', ownerNickname: 'compat-resident' })) };
      return route.fulfill({ json: { state } });
    }
    if (path.endsWith('/city/vote')) {
      api.votes += 1;
      state = { ...state, revision: state.revision + 1, projects: state.projects.map((project) => ({ ...project, votes: 1 })) };
      return route.fulfill({ json: { state, votes: { epoch: state.epoch, projectIds: ['library'] } } });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'compat-resident');
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  return api;
}

for (const status of [404, 405] as const) {
  test(`GET votes ${status} leaves construction usable and recovers after ${status === 404 ? 'reopening' : 'a retry'}`, async ({ page }) => {
    const api = await compatibilityFixture(page, status);
    const panel = page.getByRole('dialog', { name: '众议院', exact: true });
    const unavailable = panel.locator('[data-city-votes-unavailable]');
    const project = panel.locator('[data-city-project="library"]');
    await expect(unavailable).toContainText('当前服务端暂不支持投票');
    await expect(panel.locator('[data-city-vote-feedback]')).toBeHidden();
    await expect(panel.locator('[data-city-vote-count]')).toHaveCount(0);
    await expect(project.getByRole('button', { name: '投票建设', exact: true })).toHaveCount(0);
    await project.getByRole('button', { name: '捐款', exact: true }).click();
    await expect(project).toContainText('100 金币');
    expect(api.donations).toBe(1);
    await panel.getByRole('button', { name: '个人建设', exact: true }).click();
    const garden = panel.locator('[data-city-area="garden"]');
    await garden.getByRole('spinbutton').fill('2');
    await garden.getByRole('button', { name: '批量建设', exact: true }).click();
    await expect(garden).toContainText('已建 2 / 2 处');
    expect(api.decorations).toBe(1);
    await panel.getByRole('button', { name: '城市集体建设', exact: true }).click();
    await expect(unavailable).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    expect(api.votes).toBe(0);
    const previousReads = api.reads;
    api.supported = true;
    if (status === 404) {
      await panel.getByRole('button', { name: '关闭', exact: true }).click();
      await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    } else await unavailable.getByRole('button', { name: '重新检测投票', exact: true }).click();
    await expect.poll(() => api.reads).toBeGreaterThan(previousReads);
    await expect(unavailable).toHaveCount(0);
    await expect(project.locator('[data-city-vote-count]')).toHaveText('0 位居民支持建设');
    await project.getByRole('button', { name: '投票建设', exact: true }).click();
    await expect(project.getByRole('button', { name: '已投票', exact: true })).toBeDisabled();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    expect(api.votes).toBe(1);
    expect(api.errors).toEqual([]);
  });
}

for (const failure of ['503', 'network'] as const) {
  test(`a capability retry reports ${failure} without treating it as an unsupported backend`, async ({ page }) => {
    const api = await compatibilityFixture(page, 404);
    const panel = page.getByRole('dialog', { name: '众议院', exact: true });
    const unavailable = panel.locator('[data-city-votes-unavailable]');
    await expect(unavailable).toBeVisible();
    await page.route('**/town-api/city/votes', (route) => failure === 'network' ? route.abort('connectionreset')
      : route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
    await unavailable.getByRole('button', { name: '重新检测投票', exact: true }).click();
    await expect(panel.locator('[data-city-vote-feedback]')).toHaveText(failure === 'network'
      ? '网络连接中断，请稍后重试' : '暂时无法读取已投票记录，请重试');
    await expect(unavailable).toHaveCount(0);
    expect(api.errors).toEqual([]);
  });
}

test('an unknown POST project remains an operation error without disabling voting capability', async ({ page }) => {
  const api = await compatibilityFixture(page, 404);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const unavailable = panel.locator('[data-city-votes-unavailable]');
  await expect(unavailable).toBeVisible();
  api.supported = true;
  await unavailable.getByRole('button', { name: '重新检测投票', exact: true }).click();
  await expect(unavailable).toHaveCount(0);
  await page.route('**/town-api/city/vote', (route) => route.fulfill({ status: 404, json: { error: 'Unknown project' } }));
  const vote = panel.getByRole('button', { name: '投票建设', exact: true });
  await vote.click();
  await expect(panel.locator('[data-city-vote-feedback]')).toHaveText('投票项目不存在，请刷新建设列表后重试');
  await expect(vote).toBeEnabled();
  await expect(panel.locator('[data-city-vote-count]')).toHaveCount(1);
  await expect(unavailable).toHaveCount(0);
  expect(api.errors).toEqual([]);
});

test('unsupported capability and a late unsupported read do not carry into another resident', async ({ page }) => {
  const api = await compatibilityFixture(page, 405);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  await expect(panel.locator('[data-city-votes-unavailable]')).toBeVisible();
  let previousRead: Route | undefined;
  await page.route('**/town-api/city/votes', (route) => {
    if (route.request().headers().authorization === 'Bearer stub-token') { previousRead = route; return; }
    return route.fulfill({ json: { epoch: 'capability-epoch', projectIds: ['library'] } });
  });
  await page.evaluate(async () => {
    const path = '/src/city/cityVotingClient.ts';
    void (await import(path)).loadCityVotes().then((result: unknown) => { (window as any).oldCapabilityRead = { result }; });
  });
  await expect.poll(() => Boolean(previousRead)).toBe(true);
  await page.evaluate(async () => {
    const path = '/src/adapters/ui/cityGovernancePanel.ts';
    const controller = await import(path);
    controller.closeCityGovernancePanel();
    localStorage.setItem('minicityServerToken', 'next-capability-resident');
    controller.openCityGovernancePanel('commons');
  });
  await expect(panel.locator('[data-city-votes-unavailable]')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '已投票', exact: true })).toBeDisabled();
  await previousRead!.fulfill({ status: 404, body: 'Not found' });
  await expect.poll(() => page.evaluate(() => (window as any).oldCapabilityRead)).toEqual({ result: null });
  await expect(panel.locator('[data-city-votes-unavailable]')).toHaveCount(0);
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: '已投票', exact: true })).toBeDisabled();
  expect(api.errors).toEqual([]);
});
