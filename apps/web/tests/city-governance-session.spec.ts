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
    personalPlots: [...Array.from({ length: 4 }, (_, index) => ({
      id: `session-plot-${index}`, name: `会话花园 ${index + 1}`, x: 28 + index * 2, z: -40, options: ['flowers', 'pine'],
    })), { id: 'garden', name: '测试花园', x: 30, z: -44, options: ['flowers', 'pine'] }],
    personalAreas: [{ id: 'session-garden', name: '会话花园', plotIds: Array.from({ length: 4 }, (_, index) => `session-plot-${index}`) }],
    personalBlocks: [
      { id: 'session-block', name: '会话小区块', areaId: 'session-garden', description: '四方花坛一次投建。', cost: 320,
        placements: [0, 1, 2, 3].map((index) => ({ plotId: `session-plot-${index}`, decorationId: 'flowers' })) },
      { id: 'garden-block', name: '测试花园', areaId: null, description: '独享小花园，一次投建。', cost: 80,
        placements: [{ plotId: 'garden', decorationId: 'flowers' }] },
    ],
    decorations: [
      { id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 },
      { id: 'pine', name: '松树', kind: 'pine', cost: 120 },
    ],
  };
  configure?.(config);
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

test('conflicts during an older snapshot queue one fresh read after it completes', async ({ page }) => {
  let mutations = 0;
  const fixture = await openGovernance(page, (route) => {
    mutations += 1;
    return route.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
  });
  const staleState = structuredClone(fixture.state);
  let olderRead: Route | undefined;
  let stateReads = 0;
  await page.route('**/town-api/city/state', (route) => {
    stateReads += 1;
    if (stateReads === 1) olderRead = route;
    else return route.fulfill({ json: fixture.state });
  });
  await page.evaluate(async () => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
    void client.loadCityGovernance();
  });
  await expect.poll(() => stateReads).toBe(1);
  fixture.state = { ...fixture.state, revision: 1, projects: [
    { id: 'build-catcafe', funded: 250, built: false, votes: 0 },
    { id: 'build-library', funded: 0, built: false, votes: 0 },
  ] };
  const panel = page.locator('.city-governance-panel');
  await panel.locator('[data-city-project="build-catcafe"]').getByRole('button', { name: '捐款', exact: true }).click();
  await expect(panel.getByRole('alert')).toContainText('金币不足');
  const secondButton = panel.locator('[data-city-project="build-library"]').getByRole('button', { name: '捐款', exact: true });
  await secondButton.click();
  await expect.poll(() => mutations).toBe(2);
  await expect(secondButton).toBeEnabled();
  // Both conflicts arrived after the held GET captured its now-stale snapshot.
  expect(stateReads).toBe(1);
  await olderRead!.fulfill({ json: staleState });
  await expect(panel.locator('[data-city-status]')).toHaveText('云端进度 #1');
  await expect(panel.locator('[data-city-project="build-catcafe"]')).toContainText('250 金币 / 3,000 金币');
  expect(stateReads).toBe(2);
  expect(fixture.errors).toEqual([]);
});

test('a late failed donation leaves another card draft and focus in place', async ({ page }) => {
  let pending: Route | undefined;
  const fixture = await openGovernance(page, (route) => { pending = route; });
  const panel = page.locator('.city-governance-panel');
  const firstButton = panel.locator('[data-city-project="build-catcafe"]').getByRole('button', { name: '捐款', exact: true });
  const secondInput = panel.locator('[data-city-project="build-library"]').getByRole('spinbutton');
  await firstButton.click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await secondInput.fill('275');
  const inputNode = await secondInput.elementHandle();
  const scrollTop = await panel.locator('.city-governance-body').evaluate((body) => body.scrollTop);
  await pending!.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
  await expect(panel.getByRole('alert')).toContainText('金币不足');
  await expect(firstButton).toBeEnabled();
  await expect(secondInput).toBeFocused();
  await expect(secondInput).toHaveValue('275');
  expect(await inputNode!.evaluate((input) => input === document.activeElement)).toBe(true);
  expect(await panel.locator('.city-governance-body').evaluate((body) => body.scrollTop)).toBe(scrollTop);
  expect(fixture.errors).toEqual([]);
});

test('a late failed block construction leaves the other block action and focus in place', async ({ page }) => {
  let pending: Route | undefined;
  const fixture = await openGovernance(page, (route) => { pending = route; });
  const panel = page.locator('.city-governance-panel');
  await panel.getByRole('button', { name: '个人建设', exact: true }).click();
  const block = panel.locator('[data-city-block="session-block"]');
  const other = panel.locator('[data-city-block="garden-block"]');
  const action = block.getByRole('button', { name: '投建这片', exact: true });
  const otherAction = other.getByRole('button', { name: '投建这片', exact: true });
  await action.click();
  await expect.poll(() => Boolean(pending)).toBe(true);
  await otherAction.focus();
  const scrollTop = await panel.locator('.city-governance-body').evaluate((body) => body.scrollTop);
  await pending!.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
  await expect(panel.getByRole('alert')).toContainText('金币不足');
  await expect(action).toBeEnabled();
  await expect(otherAction).toBeFocused();
  expect(await panel.locator('.city-governance-body').evaluate((body) => body.scrollTop)).toBe(scrollTop);
  expect(fixture.errors).toEqual([]);
});

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

  // The modal keeps focus on an available control while donation is pending;
  // success restores its enabled action if the resident has not moved on.
  await firstButton.click();
  const firstFallback = first.getByRole('button', { name: '投票建设', exact: true });
  await expect(firstFallback).toBeFocused();
  await expect.poll(() => pending.length).toBe(3);
  await expect(panel.getByRole('alert')).toContainText('金币不足');
  fixture.state = { ...fixture.state, revision: 2, projects: [
    { id: 'build-catcafe', funded: 200, built: false, votes: 0 },
    { id: 'build-library', funded: 0, built: false, votes: 0 },
  ] };
  await pending[2]!.fulfill({ json: { state: fixture.state } });
  await expect(firstButton).toBeEnabled();
  await expect(firstButton).toBeFocused();
  await expect(panel.getByRole('alert')).toContainText('金币不足');

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
  await secondButton.click();
  await expect.poll(() => pending.length).toBe(5);
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await pending[4]!.fulfill({ json: { state: fixture.state } });
  await expect(secondButton).toBeEnabled();
  expect(fixture.errors).toEqual([]);
});

test('construction and donation preserve errors from other targets and restore the block action', async ({ page }) => {
  const pending: Route[] = [];
  const fixture = await openGovernance(page, (route) => { pending.push(route); });
  const panel = page.locator('.city-governance-panel');
  await panel.locator('[data-city-project="build-catcafe"]').getByRole('button', { name: '捐款', exact: true }).click();
  await expect.poll(() => pending.length).toBe(1);
  await pending[0]!.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
  await expect(panel.getByRole('alert')).toContainText('金币不足');

  await panel.getByRole('button', { name: '个人建设', exact: true }).click();
  const block = panel.locator('[data-city-block="session-block"]');
  const blockButton = block.getByRole('button', { name: '投建这片', exact: true });
  await blockButton.click();
  await expect.poll(() => pending.length).toBe(2);
  await expect(panel.getByRole('alert')).toContainText('金币不足');
  fixture.state = { ...fixture.state, revision: 1, decorations: [0, 1, 2, 3].map((index) => ({
    plotId: `session-plot-${index}`, decorationId: 'flowers', ownerId: 'stub-user', ownerNickname: 'session-tester',
  })) };
  await pending[1]!.fulfill({ json: { state: fixture.state } });
  await expect(block).toContainText('已由 session-tester 投建');
  // A completed block is no longer actionable; focus falls back to the active tab.
  await expect(blockButton).toBeDisabled();
  await expect(panel.getByRole('button', { name: '个人建设', exact: true })).toBeFocused();
  await expect(panel.getByRole('alert')).toContainText('金币不足');

  const garden = panel.locator('[data-city-block="garden-block"]');
  const gardenButton = garden.getByRole('button', { name: '投建这片', exact: true });
  await gardenButton.click();
  await expect.poll(() => pending.length).toBe(3);
  await pending[2]!.fulfill({ status: 409, json: { error: 'Block plot already occupied' } });
  await expect(panel.getByRole('alert')).toContainText('无法整块投建');
  await expect(gardenButton).toBeFocused();
  expect(fixture.errors).toEqual([]);
});

for (const completion of ['full-block', 'built-project', 'resident-moved'] as const) {
  test(`successful construction keeps safe focus after ${completion}`, async ({ page }) => {
    let pending: Route | undefined;
    const fixture = await openGovernance(page, (route) => { pending = route; });
    const panel = page.locator('.city-governance-panel');
    const personal = completion !== 'built-project';
    const activeTab = panel.getByRole('button', { name: personal ? '个人建设' : '城市集体建设', exact: true });
    if (personal) await activeTab.click();
    const block = panel.locator('[data-city-block="session-block"]');
    const project = panel.locator('[data-city-project="build-catcafe"]');
    const action = personal ? block.getByRole('button', { name: '投建这片', exact: true })
      : project.getByRole('button', { name: '捐款', exact: true });
    if (!personal) await project.getByRole('spinbutton').fill('3000');
    await action.click();
    await expect.poll(() => Boolean(pending)).toBe(true);
    const otherAction = panel.locator('[data-city-block="garden-block"]').getByRole('button', { name: '投建这片', exact: true });
    if (completion === 'resident-moved') await otherAction.focus();
    fixture.state = { ...fixture.state, revision: 1,
      projects: fixture.state.projects.map((entry) => !personal && entry.id === 'build-catcafe'
        ? { ...entry, funded: 3000, built: true } : entry),
      decorations: personal ? Array.from({ length: completion === 'full-block' ? 4 : 1 }, (_, index) => ({
        plotId: `session-plot-${index}`, decorationId: 'flowers', ownerId: 'stub-user', ownerNickname: 'session-tester',
      })) : [],
    };
    await pending!.fulfill({ json: { state: fixture.state } });
    if (completion === 'resident-moved') {
      // A partially filled block can no longer be bought; focus stays where
      // the resident moved it instead of returning to the completed action.
      await expect(action).toBeDisabled();
      await expect(otherAction).toBeFocused();
    } else {
      if (personal) await expect(action).toBeDisabled();
      else await expect(action).toHaveCount(0);
      await expect(activeTab).toBeFocused();
    }
    expect(fixture.errors).toEqual([]);
  });
}

for (const action of ['donate', 'decorate'] as const) {
  test(`${action} ${action === 'donate' ? 'requires confirming an uncertain target before changing its payment parameters' : 'replays the retained block request after an uncertain outcome'}`, async ({ page }) => {
    test.setTimeout(90_000);
    const requests: Array<Record<string, unknown>> = [];
    const committed = new Map<string, Record<string, unknown>>();
    const outerFailures = [
      { status: 429, error: 'Too many requests', message: '请求过于频繁' },
      { status: 403, error: 'Request origin is not allowed', message: '当前访问来源无法提交建设' },
      { status: 500, error: 'Internal server error', message: '城市建设服务暂时异常' },
    ];
    const fixture = await openGovernance(page, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      requests.push(body);
      const failure = outerFailures[requests.length - 2];
      if (failure) return route.fulfill({ status: failure.status, json: { error: failure.error } });
      const requestId = String(body.requestId);
      const replayed = committed.has(requestId);
      if (replayed) expect(body).toEqual(committed.get(requestId));
      else {
        committed.set(requestId, body);
        fixture.state = { ...fixture.state, revision: fixture.state.revision + 1,
          projects: fixture.state.projects.map((project) => project.id === body.projectId
            ? { ...project, funded: project.funded + Number(body.amount) } : project),
          decorations: action === 'decorate'
            ? [{ plotId: 'garden', decorationId: 'flowers', ownerId: 'stub-user', ownerNickname: 'session-tester' }]
            : fixture.state.decorations };
      }
      if (requests.length === 1) return route.abort('connectionreset');
      return route.fulfill({ json: { state: fixture.state, replayed } });
    });
    const panel = page.locator('.city-governance-panel');
    if (action === 'decorate') await panel.getByRole('button', { name: '个人建设', exact: true }).click();
    const card = panel.locator(action === 'donate' ? '[data-city-project="build-catcafe"]' : '[data-city-block="garden-block"]');
    const input = card.getByRole(action === 'donate' ? 'spinbutton' : 'button');
    const original = '500';
    const setValue = (value: string) => action === 'donate' ? input.fill(value) : Promise.resolve();
    // Donate buttons keep their label; block buttons relabel with the receipt
    // state (投建这片/确认投建结果), so match the card's single action button.
    const button = action === 'donate'
      ? card.getByRole('button', { name: '捐款', exact: true })
      : card.getByRole('button');
    if (action === 'donate') await setValue(original);
    await button.click();
    await expect(panel.getByRole('alert')).toContainText('网络连接异常');
    if (action === 'donate') {
      await input.fill('600');
      await button.click();
      await expect(panel.getByRole('alert')).toContainText('结果尚未确认');
      await expect(panel.getByRole('alert')).toContainText('500');
      await expect(panel.getByRole('alert')).toContainText('猫猫咖啡厅');
      await expect(input).toHaveValue('600');
      expect(requests).toHaveLength(1);
      expect(committed.size).toBe(1);
      await setValue(original);
    } else {
      // A block purchase has no free parameters: the retry replays the exact
      // retained body, so the uncertain receipt is confirmed, never replaced.
      // The fixture recorded the first (aborted) request as committed, like a
      // server whose response was lost after the write.
      await expect(card.locator('[data-city-block-total]')).toContainText('结果待确认');
      expect(requests).toHaveLength(1);
      expect(committed.size).toBe(1);
    }
    for (const failure of outerFailures) {
      await button.click();
      await expect(panel.getByRole('alert')).toContainText(failure.message);
      await expect(panel.getByRole('alert')).not.toContainText(failure.error);
    }
    await button.click();
    await expect(panel.getByRole('status', { name: '建设结果', exact: true })).toHaveText('上一笔已成功，未重复扣费。');
    expect(requests).toHaveLength(5);
    for (const retry of requests.slice(1)) expect(retry).toEqual(requests[0]);
    expect(committed.size).toBe(1);
    expect(fixture.errors).toEqual([]);
  });
}

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

for (const kind of ['donation', 'block'] as const) {
test(`${kind} login sessions keep separate receipts and ignore previous session responses`, async ({ page }) => {
  test.setTimeout(90_000);
  const pending: Route[] = [];
  const requests: Array<{ requestId: string; blockId?: string }> = [];
  const fixture = await openGovernance(page, (route) => {
    requests.push(route.request().postDataJSON() as { requestId: string });
    pending.push(route);
  });
  const panel = page.locator('.city-governance-panel');
  if (kind === 'block') await panel.getByRole('button', { name: '个人建设', exact: true }).click();
  const target = panel.locator(kind === 'block' ? '[data-city-block="session-block"]' : '[data-city-project="build-catcafe"]');
  const button = kind === 'donation'
    ? target.getByRole('button', { name: '捐款', exact: true })
    : target.getByRole('button');
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
  await button.click();
  await expect.poll(() => pending.length).toBe(2);
  expect(requests[1]!.requestId).not.toBe(requests[0]!.requestId);

  // The old 401 must neither reopen login nor clear the new session's pending action.
  await pending[0]!.fulfill({ status: 401, json: { error: 'Please sign in' } });
  await expect(button).toBeDisabled();
  await expect(page.locator('#loginOverlay')).not.toBeVisible();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await pending[1]!.abort('connectionreset');
  await expect(panel.getByRole('alert')).toContainText('网络连接异常');
  await button.click();
  await expect.poll(() => pending.length).toBe(3);
  expect(requests[2]!.requestId).toBe(requests[1]!.requestId);

  // Returning to the original still-valid token retains its uncertain receipt.
  await switchSession('stub-token');
  await button.click();
  await expect.poll(() => pending.length).toBe(4);
  expect(requests[3]!.requestId).toBe(requests[0]!.requestId);
  if (kind === 'block') {
    expect(requests[0]).toMatchObject({ blockId: 'session-block' });
    expect(requests[1]).toMatchObject({ blockId: 'session-block' });
    expect(requests[2]).toMatchObject({ blockId: 'session-block' });
    expect(requests[3]).toMatchObject({ blockId: 'session-block' });
  }
  await pending[2]!.fulfill({ json: { state: { ...fixture.state, epoch: 'old-session', revision: 900 }, replayed: true } });
  await expect(button).toBeDisabled();
  await expect(panel.locator('[data-city-status]')).toHaveText('云端进度 #0');
  await expect(panel.getByRole('status', { name: '建设结果', exact: true })).toHaveText('');

  fixture.state = { ...fixture.state, revision: 1 };
  await pending[3]!.fulfill({ json: { state: fixture.state, replayed: true } });
  await expect(button).toBeEnabled();
  await expect(panel.locator('[data-city-status]')).toHaveText('云端进度 #1');
  await expect(panel.getByRole('status', { name: '建设结果', exact: true })).toContainText('上一笔已成功');
  expect(fixture.errors).toEqual([]);
});
}

test('personal construction refreshes cross-tab sessions before rendering block cards', async ({ page, context }) => {
  const requests: Array<{ blockId: string }> = [];
  const fixture = await openGovernance(page, async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
  });
  const panel = page.locator('.city-governance-panel');
  const personalTab = panel.getByRole('button', { name: '个人建设', exact: true });
  const block = panel.locator('[data-city-block="session-block"]');
  await personalTab.click();
  await expect(block.locator('.city-area-cell')).toHaveCount(4);
  await panel.getByRole('button', { name: '城市集体建设', exact: true }).click();

  // A second tab changes storage without calling this page's client helpers.
  // The next ordinary panel render must detect that change before any action.
  const otherTab = await context.newPage();
  try {
    await otherTab.route('**/session-source', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Session source</title>' }));
    await otherTab.goto(new URL('/session-source', page.url()).href);
    await otherTab.evaluate(() => localStorage.setItem('minicityServerToken', 'cross-tab-resident'));
  } finally { await otherTab.close(); }

  await personalTab.click();
  await expect(panel.locator('.city-governance-list')).toHaveCount(1);
  await expect(block).toHaveCount(1);
  await block.getByRole('button', { name: '投建这片', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toMatchObject({ blockId: 'session-block' });
  await expect(panel.getByRole('alert')).toContainText('金币不足');
  await expect(panel.locator('.city-governance-list')).toHaveCount(1);
  expect(fixture.errors).toEqual([]);
});

test('block cards explain partial occupancy and scale narrow previews', async ({ page }) => {
  const fixture = await openGovernance(page, (route) => route.fulfill({ status: 409, json: { error: 'Insufficient currency' } }), (config) => {
    const narrowPlots = Array.from({ length: 2 }, (_, index) => ({
      id: `narrow-${index}`, name: `窄花园 ${index + 1}`, x: 38, z: -40 + index * 2, options: ['flowers'],
    }));
    config.personalPlots.push(...narrowPlots);
    config.personalBlocks!.push({ id: 'narrow-block', name: '窄花园小区块', areaId: null, description: '两处竖排花坛一次投建。', cost: 160,
      placements: narrowPlots.map(({ id }) => ({ plotId: id, decorationId: 'flowers' })) });
  });
  fixture.state = { ...fixture.state, revision: 1, decorations: [0, 1].map((index) => ({
    plotId: `session-plot-${index}`, decorationId: 'flowers', ownerId: 'another-resident', ownerNickname: '其他居民',
  })) };
  await publishState(page, fixture.state);
  const panel = page.locator('.city-governance-panel');
  await panel.getByRole('button', { name: '个人建设', exact: true }).click();
  const block = panel.locator('[data-city-block="session-block"]');
  // Two plots are owned by another resident: the whole block locks.
  await expect(block.locator('[data-city-block-total]')).toHaveText('部分地块已有装饰（其他居民），暂不能整块投建。');
  await expect(block.getByRole('button', { name: '投建这片', exact: true })).toBeDisabled();
  const widePreview = await block.locator('.city-area-preview').boundingBox();
  const narrowPreview = await panel.locator('[data-city-block="narrow-block"] .city-area-preview').boundingBox();
  expect(widePreview!.width).toBeGreaterThan(narrowPreview!.width * 3);
  expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);

  fixture.state = { ...fixture.state, revision: 2, decorations: [...fixture.state.decorations, ...[2, 3].map((index) => ({
    plotId: `session-plot-${index}`, decorationId: 'flowers', ownerId: 'another-resident', ownerNickname: '其他居民',
  }))] };
  await publishState(page, fixture.state);
  await expect(block.locator('[data-city-block-total]')).toHaveText('已由 其他居民 投建 · 花坛 ×4');
  expect(fixture.errors).toEqual([]);
});
