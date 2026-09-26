import { expect, test, type Page, type Route } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';

async function openGovernance(page: Page, mutate: (route: Route) => void | Promise<void>) {
  const config: CityConfig = {
    schemaVersion: 1, version: 'session-fixture', initialBuiltBuildingIds: ['commons'],
    projects: [
      { id: 'build-catcafe', buildingId: 'catcafe', name: '猫猫咖啡厅', description: '共同筹建', kind: 'building', cost: 3000 },
      { id: 'build-library', buildingId: 'library', name: '图书馆', description: '共同筹建', kind: 'building', cost: 2000 },
    ],
    personalPlots: Array.from({ length: 4 }, (_, index) => ({
      id: `session-plot-${index}`, name: `会话花园 ${index + 1}`, x: 28 + index * 2, z: -40, options: ['flowers', 'pine'],
    })),
    personalAreas: [{ id: 'session-garden', name: '会话花园', plotIds: Array.from({ length: 4 }, (_, index) => `session-plot-${index}`) }],
    decorations: [
      { id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 },
      { id: 'pine', name: '松树', kind: 'pine', cost: 120 },
    ],
  };
  const fixture = {
    state: {
      epoch: 'session-epoch', revision: 0, configVersion: config.version,
      projects: config.projects.map(({ id }) => ({ id, funded: 0, built: false, votes: 0 })), decorations: [],
    } as CityState,
    errors: [] as string[],
  };
  page.on('pageerror', (error) => fixture.errors.push(error.message));
  stubCityWebSocket(page, { user: 'session-tester', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/votes')) return route.fulfill({ json: { epoch: fixture.state.epoch, projectIds: [] } });
    if (path.endsWith('/city/state')) return route.fulfill({ json: fixture.state });
    if (path.endsWith('/city/donate') || path.endsWith('/city/decorate')) return mutate(route);
    if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ status: 404, json: { error: 'Unexpected test endpoint' } });
  });
  await waitForCityReady(page, 'session-tester');
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  return fixture;
}

async function publishState(page: Page, state: CityState): Promise<void> {
  await page.evaluate(async (next) => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
    client.applyCityState(next);
  }, state);
}

test('concurrent submissions restore their own focus without interrupting another card', async ({ page }) => {
  const pending: Route[] = [];
  const fixture = await openGovernance(page, (route) => { pending.push(route); });
  const panel = page.locator('.city-governance-panel');
  const first = panel.locator('[data-city-project="build-catcafe"]');
  const second = panel.locator('[data-city-project="build-library"]');
  const firstButton = first.getByRole('button', { name: '捐款', exact: true });
  const secondButton = second.getByRole('button', { name: '捐款', exact: true });

  await firstButton.click();
  await secondButton.click();
  await expect.poll(() => pending.length).toBe(2);
  await pending[1]!.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
  await expect(panel.getByRole('alert')).toContainText('金币不足');
  await expect(secondButton).toBeFocused();
  fixture.state = { ...fixture.state, revision: 1, projects: [
    { id: 'build-catcafe', funded: 100, built: false, votes: 0 },
    { id: 'build-library', funded: 0, built: false, votes: 0 },
  ] };
  await pending[0]!.fulfill({ json: { state: fixture.state } });
  await expect(firstButton).toBeEnabled();
  await expect(secondButton).toBeFocused();
  await expect(panel.getByRole('alert')).toContainText('金币不足');

  // An ordinary successful action restores the button lost during its pending render.
  await firstButton.click();
  await expect.poll(() => pending.length).toBe(3);
  fixture.state = { ...fixture.state, revision: 2, projects: [
    { id: 'build-catcafe', funded: 200, built: false, votes: 0 },
    { id: 'build-library', funded: 0, built: false, votes: 0 },
  ] };
  await pending[2]!.fulfill({ json: { state: fixture.state } });
  await expect(firstButton).toBeEnabled();
  await expect(firstButton).toBeFocused();

  await firstButton.click();
  await expect.poll(() => pending.length).toBe(4);
  await second.getByRole('spinbutton').focus();
  fixture.state = { ...fixture.state, revision: 3 };
  await pending[3]!.fulfill({ json: { state: fixture.state } });
  await expect(firstButton).toBeEnabled();
  await expect(second.getByRole('spinbutton')).toBeFocused();

  // Even an untouched focused value becomes a draft, and survives later blur/renders.
  await expect(second.getByRole('spinbutton')).toHaveValue('100');
  fixture.state = { ...fixture.state, revision: 4, projects: [
    { id: 'build-catcafe', funded: 200, built: false, votes: 0 },
    { id: 'build-library', funded: 1950, built: false, votes: 0 },
  ] };
  await publishState(page, fixture.state);
  await expect(second.getByRole('spinbutton')).toHaveValue('100');
  await first.getByRole('spinbutton').focus();
  await publishState(page, { ...fixture.state, revision: 5 });
  await expect(second.getByRole('spinbutton')).toHaveValue('100');
  await panel.getByRole('button', { name: '个人建设', exact: true }).click();
  await panel.getByRole('button', { name: '城市集体建设', exact: true }).click();
  await expect(second.getByRole('spinbutton')).toHaveValue('100');
  expect(fixture.errors).toEqual([]);
});

test('receipt retries release definite 400 and 404 rejections but retain uncertain requests through 429', async ({ page }) => {
  const requests: Array<{ amount: number; requestId: string }> = [];
  const attempts = new Map<number, number>();
  const committed = new Map<string, number>();
  const fixture = await openGovernance(page, async (route) => {
    const body = route.request().postDataJSON() as { amount: number; requestId: string };
    requests.push(body);
    const attempt = (attempts.get(body.amount) ?? 0) + 1;
    attempts.set(body.amount, attempt);
    if (body.amount === 10 && attempt === 1) return route.fulfill({ status: 400, json: { error: 'Invalid target' } });
    if (body.amount === 20 && attempt === 1) return route.fulfill({ status: 404, json: { error: 'Unknown project' } });
    if (body.amount === 30 && attempt === 2) return route.fulfill({ status: 429, json: { error: 'Too many city mutations' } });
    const replayed = committed.has(body.requestId);
    if (!replayed) committed.set(body.requestId, body.amount);
    if (body.amount === 30 && attempt === 1) return route.abort('connectionreset');
    return route.fulfill({ json: { state: fixture.state, replayed } });
  });
  const donate = (amount: number) => page.evaluate(async (value) => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
    try { return { result: await client.donateCity('build-catcafe', value), error: '' }; }
    catch (error) { return { result: null, error: (error as Error).message }; }
  }, amount);
  for (const amount of [10, 20]) {
    expect((await donate(amount)).error).not.toBe('');
    expect((await donate(amount)).result?.replayed).toBe(false);
    const pair = requests.filter((request) => request.amount === amount);
    expect(pair[1]!.requestId).not.toBe(pair[0]!.requestId);
  }
  expect((await donate(30)).error).toContain('网络连接异常');
  expect((await donate(30)).error).toContain('操作太频繁');
  expect((await donate(30)).result?.replayed).toBe(true);
  expect(new Set(requests.filter((request) => request.amount === 30).map((request) => request.requestId)).size).toBe(1);
  expect([...committed.values()].reduce((total, amount) => total + amount, 0)).toBe(60);
  expect(fixture.errors).toEqual([]);
});

for (const kind of ['donation', 'area'] as const) {
test(`${kind} login sessions keep separate receipts and ignore previous session responses`, async ({ page }) => {
  const pending: Route[] = [];
  const requests: Array<{ requestId: string; decorationId?: string; quantity?: number }> = [];
  const fixture = await openGovernance(page, (route) => {
    requests.push(route.request().postDataJSON() as { requestId: string });
    pending.push(route);
  });
  const panel = page.locator('.city-governance-panel');
  if (kind === 'area') await panel.getByRole('button', { name: '个人建设', exact: true }).click();
  const target = panel.locator(kind === 'area' ? '[data-city-area="session-garden"]' : '[data-city-project="build-catcafe"]');
  const button = target.getByRole('button', { name: kind === 'area' ? '批量建设' : '捐款', exact: true });
  if (kind === 'area') {
    await target.getByRole('spinbutton').fill('2');
    await target.getByRole('combobox').selectOption('pine');
  }
  const switchSession = (token: string) => page.evaluate(async (nextToken) => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
    // Mirrors MultiplayerClient's hello/authentication-failure boundary.
    localStorage.setItem('minicityServerToken', nextToken);
    client.refreshCityGovernanceSession();
  }, token);

  await button.click();
  await expect.poll(() => pending.length).toBe(1);
  await switchSession('second-test-session');
  await expect(button).toBeEnabled();
  if (kind === 'area') {
    await expect(target.getByRole('spinbutton')).toHaveValue('4');
    await expect(target.getByRole('combobox')).toHaveValue('flowers');
    await target.getByRole('spinbutton').fill('3');
  }
  await button.click();
  await expect.poll(() => pending.length).toBe(2);
  expect(requests[1]!.requestId).not.toBe(requests[0]!.requestId);

  // The old 401 must neither reopen login nor clear the new session's pending action.
  await pending[0]!.fulfill({ status: 401, json: { error: 'Please sign in' } });
  await expect(button).toBeDisabled();
  if (kind === 'area') {
    await expect(target.getByRole('spinbutton')).toHaveValue('3');
    await expect(target.getByRole('combobox')).toHaveValue('flowers');
  }
  await expect(page.locator('#loginOverlay')).not.toBeVisible();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await pending[1]!.abort('connectionreset');
  await expect(panel.getByRole('alert')).toContainText('网络连接异常');
  await button.click();
  await expect.poll(() => pending.length).toBe(3);
  expect(requests[2]!.requestId).toBe(requests[1]!.requestId);

  // Returning to the original still-valid token retains its uncertain receipt.
  await switchSession('stub-token');
  if (kind === 'area') {
    await expect(target.getByRole('spinbutton')).toHaveValue('2');
    await expect(target.getByRole('combobox')).toHaveValue('pine');
    await expect(target.getByRole('spinbutton')).toBeDisabled();
  }
  await button.click();
  await expect.poll(() => pending.length).toBe(4);
  expect(requests[3]!.requestId).toBe(requests[0]!.requestId);
  if (kind === 'area') {
    expect(requests[0]).toMatchObject({ decorationId: 'pine', quantity: 2 });
    expect(requests[1]).toMatchObject({ decorationId: 'flowers', quantity: 3 });
    expect(requests[2]).toMatchObject({ decorationId: 'flowers', quantity: 3 });
    expect(requests[3]).toMatchObject({ decorationId: 'pine', quantity: 2 });
  }
  await pending[2]!.fulfill({ json: { state: { ...fixture.state, epoch: 'old-session', revision: 900 }, replayed: true } });
  await expect(button).toBeDisabled();
  await expect(panel.locator('[data-city-status]')).toHaveText('云端进度 #0');
  await expect(panel.getByRole('status')).toHaveCount(0);

  fixture.state = { ...fixture.state, revision: 1 };
  await pending[3]!.fulfill({ json: { state: fixture.state, replayed: true } });
  await expect(button).toBeEnabled();
  await expect(panel.locator('[data-city-status]')).toHaveText('云端进度 #1');
  await expect(panel.getByRole('status')).toContainText('上一笔已成功');
  expect(fixture.errors).toEqual([]);
});
}
