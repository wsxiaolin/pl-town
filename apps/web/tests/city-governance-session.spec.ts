import { expect, test, type Page, type Route } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';

async function openGovernance(
  page: Page, mutate: (route: Route) => void | Promise<void>, configure?: (config: CityConfig) => void,
) {
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
  configure?.(config);
  const fixture = {
    state: {
      epoch: 'session-epoch', revision: 0, configVersion: config.version,
      projects: config.projects.map(({ id }) => ({ id, funded: 0, built: false })), decorations: [],
    } as CityState,
    errors: [] as string[],
  };
  page.on('pageerror', (error) => fixture.errors.push(error.message));
  stubCityWebSocket(page, { user: 'session-tester', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
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
  const first = panel.locator('[data-project-id="build-catcafe"]');
  const second = panel.locator('[data-project-id="build-library"]');
  const firstButton = first.getByRole('button', { name: '捐款', exact: true });
  const secondButton = second.getByRole('button', { name: '捐款', exact: true });

  await firstButton.click();
  await secondButton.click();
  await expect.poll(() => pending.length).toBe(2);
  await pending[1]!.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
  await expect(panel.getByRole('alert')).toContainText('金币不足');
  await expect(secondButton).toBeFocused();
  fixture.state = { ...fixture.state, revision: 1, projects: [
    { id: 'build-catcafe', funded: 100, built: false },
    { id: 'build-library', funded: 0, built: false },
  ] };
  await pending[0]!.fulfill({ json: { state: fixture.state } });
  await expect(firstButton).toBeEnabled();
  await expect(secondButton).toBeFocused();
  await expect(panel.getByRole('alert')).toContainText('金币不足');

  // An ordinary successful action restores the button lost during its pending render.
  await firstButton.click();
  await expect.poll(() => pending.length).toBe(3);
  fixture.state = { ...fixture.state, revision: 2, projects: [
    { id: 'build-catcafe', funded: 200, built: false },
    { id: 'build-library', funded: 0, built: false },
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
    { id: 'build-catcafe', funded: 200, built: false },
    { id: 'build-library', funded: 1950, built: false },
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
  const target = panel.locator(kind === 'area' ? '[data-city-area="session-garden"]' : '[data-project-id="build-catcafe"]');
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

test('personal construction refreshes cross-tab sessions before rendering area drafts', async ({ page, context }) => {
  const requests: Array<{ quantity: number; decorationId: string }> = [];
  const fixture = await openGovernance(page, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
  });
  const panel = page.locator('.city-governance-panel');
  const personalTab = panel.getByRole('button', { name: '个人建设', exact: true });
  const area = panel.locator('[data-city-area="session-garden"]');
  await personalTab.click();
  await area.getByRole('spinbutton').fill('2');
  await area.getByRole('combobox').selectOption('pine');
  await panel.getByRole('button', { name: '城市集体建设', exact: true }).click();

  // A second tab changes storage without calling this page's client helpers.
  // The next ordinary panel render must detect that change before using drafts.
  const otherTab = await context.newPage();
  try {
    await otherTab.route('**/session-source', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Session source</title>' }));
    await otherTab.goto(new URL('/session-source', page.url()).href);
    await otherTab.evaluate(() => localStorage.setItem('minicityServerToken', 'cross-tab-resident'));
  } finally { await otherTab.close(); }

  await personalTab.click();
  await expect(panel.locator('.city-governance-list')).toHaveCount(1);
  await expect(area).toHaveCount(1);
  await expect(area.getByRole('spinbutton')).toHaveValue('4');
  await expect(area.getByRole('combobox')).toHaveValue('flowers');
  await area.getByRole('spinbutton').fill('3');
  await area.getByRole('button', { name: '批量建设', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ quantity: 3, decorationId: 'flowers' });
  await expect(panel.getByRole('alert')).toContainText('金币不足');
  await expect(panel.locator('.city-governance-list')).toHaveCount(1);
  await expect(area.getByRole('spinbutton')).toHaveValue('3');
  expect(fixture.errors).toEqual([]);
});

test('area availability explains decoration limits and scales narrow previews', async ({ page }) => {
  const fixture = await openGovernance(page, (route) => route.fulfill({ status: 409, json: { error: 'Insufficient currency' } }), (config) => {
    config.personalPlots.forEach((plot, index) => { plot.options = index < 2 ? ['pine'] : ['flowers']; });
    const narrowPlots = Array.from({ length: 2 }, (_, index) => ({
      id: `narrow-${index}`, name: `窄花园 ${index + 1}`, x: 38, z: -40 + index * 2, options: ['flowers'],
    }));
    config.personalPlots.push(...narrowPlots);
    config.personalAreas!.push({ id: 'narrow-garden', name: '窄花园', plotIds: narrowPlots.map(({ id }) => id) });
  });
  fixture.state = { ...fixture.state, revision: 1, decorations: [0, 1].map((index) => ({
    plotId: `session-plot-${index}`, decorationId: 'pine', ownerId: 'another-resident', ownerNickname: '其他居民',
  })) };
  await publishState(page, fixture.state);
  const panel = page.locator('.city-governance-panel');
  await panel.getByRole('button', { name: '个人建设', exact: true }).click();
  const area = panel.locator('[data-city-area="session-garden"]');
  await area.getByRole('combobox').selectOption('pine');
  await expect(area.locator('[data-city-area-total]')).toHaveText('该区域没有适合松树的空地，请选择其他装饰。');
  await expect(area.getByRole('button', { name: '批量建设', exact: true })).toBeDisabled();
  await area.getByRole('combobox').selectOption('flowers');
  await area.getByRole('spinbutton').fill('2');
  await expect(area.getByRole('button', { name: '批量建设', exact: true })).toBeEnabled();
  const widePreview = await area.locator('.city-area-preview').boundingBox();
  const narrowPreview = await panel.locator('[data-city-area="narrow-garden"] .city-area-preview').boundingBox();
  expect(widePreview!.width).toBeGreaterThan(narrowPreview!.width * 3);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  fixture.state = { ...fixture.state, revision: 2, decorations: [...fixture.state.decorations, ...[2, 3].map((index) => ({
    plotId: `session-plot-${index}`, decorationId: 'flowers', ownerId: 'another-resident', ownerNickname: '其他居民',
  }))] };
  await publishState(page, fixture.state);
  await expect(area.locator('[data-city-area-total]')).toHaveText('该区域已无可用地块');
  expect(fixture.errors).toEqual([]);
});
