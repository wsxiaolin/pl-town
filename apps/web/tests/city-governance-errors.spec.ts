import { expect, test, type Page } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';
import type { CityState } from '../src/city/cityGovernanceClient';

async function broadcastCityState(page: Page, state: CityState): Promise<void> {
  await page.evaluate(async (next) => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
    client.applyCityState(next);
  }, state);
}

async function reloadCityState(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
    await client.loadCityGovernance();
  });
}

const scenarios = [
  ['donate', 'insufficient coins'], ['donate', 'lost response'],
  ['donate', 'invalid response'],
  ['donate', 'sign in'], ['donate', 'unknown error'],
] as const;
for (const [action, failure] of scenarios) {
  test(`${action} preserves the draft across ${failure} and reopening before retry`, async ({ page }) => {
    const config = {
      schemaVersion: 1, version: 'error-fixture',
      projects: [
        { id: 'build-catcafe', buildingId: 'catcafe', name: '猫猫咖啡厅', description: '共同筹建', kind: 'building', cost: 3000 },
        { id: 'build-library', buildingId: 'library', name: '图书馆', description: '共同筹建图书馆', kind: 'building', cost: 2000 },
      ],
      personalPlots: [],
      decorations: [],
      initialBuiltBuildingIds: ['commons'],
    };
    let state = {
      epoch: 'error-epoch', revision: 0, configVersion: config.version,
      projects: [
        { id: 'build-catcafe', funded: 0, built: false, votes: 0 },
        { id: 'build-library', funded: 0, built: false, votes: 0 },
      ],
      decorations: [] as Array<{ plotId: string; decorationId: string; ownerId: string; ownerNickname: string }>,
    };
    let attempts = 0;
    let stateReads = 0;
    const requests: Array<Record<string, unknown>> = [];
    const committedRequests = new Map<string, string>();
    let releaseRefresh = () => {};
    const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    let releaseMutation = () => {};
    const mutationGate = new Promise<void>((resolve) => { releaseMutation = resolve; });
    let funded = 0;
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    stubCityWebSocket(page, { user: 'error-tester', unlockedBuildings: ['commons'] });
    if (failure === 'sign in') await page.addInitScript(() => {
      const events = window as unknown as { cityLoginRequests: number };
      events.cityLoginRequests = 0;
      window.addEventListener('minicity:login-required', () => { events.cityLoginRequests += 1; });
    });
    await page.route('**/town-api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/city/votes')) return route.fulfill({ json: { epoch: state.epoch, projectIds: [] } });
      if (path.endsWith('/city/config')) return route.fulfill({ json: config });
      if (path.endsWith('/city/state')) {
        stateReads += 1;
        const snapshot = structuredClone(state);
        if (attempts === 1 && failure === 'insufficient coins') await refreshGate;
        return route.fulfill({ json: snapshot });
      }
      if (path.endsWith(`/city/${action}`)) {
        attempts += 1;
        const body = route.request().postDataJSON() as Record<string, unknown>;
        requests.push(body);
        if (attempts === 1) await mutationGate;
        if (attempts === 1 && failure === 'insufficient coins') return route.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
        if (attempts === 1 && failure === 'sign in') return route.fulfill({ status: 401, json: { error: 'Please sign in' } });
        const requestId = String(body.requestId);
        const fingerprint = JSON.stringify([body.projectId, body.amount ?? null, body.configVersion]);
        const replayed = committedRequests.has(requestId);
        if (replayed && committedRequests.get(requestId) !== fingerprint) {
          return route.fulfill({ status: 409, json: { error: 'requestId already used with different parameters' } });
        }
        if (!replayed) {
          if (body.configVersion !== config.version) {
            return route.fulfill({ status: 409, json: { error: 'City config changed; reload config' } });
          }
          committedRequests.set(requestId, fingerprint);
          funded += Number(body.amount);
          state = {
            ...state, revision: state.revision + 1,
            projects: [
              { id: 'build-catcafe', funded, built: false, votes: 0 },
              { id: 'build-library', funded: 0, built: false, votes: 0 },
            ],
          };
        }
        // The server committed, but the browser received either no response or an unusable payload.
        if (attempts === 1 && !replayed) {
          if (failure === 'lost response') return route.abort('connectionreset');
          if (failure === 'invalid response') return route.fulfill({ json: { state: { revision: state.revision } } });
          if (failure === 'unknown error') return route.fulfill({ status: 503, json: { error: 'unmapped internal server detail' } });
        }
        return route.fulfill({ json: { state, replayed } });
      }
      if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ status: 404, json: { error: 'Unexpected test endpoint' } });
    });
    await waitForCityReady(page, 'error-tester');
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    const panel = page.locator('.city-governance-panel');
    const feedback = await panel.locator('[data-city-feedback]').elementHandle();
    const targetCard = panel.locator('[data-city-project="build-catcafe"]');
    const input = targetCard.getByRole('spinbutton');
    await input.fill('500');
    const actionButton = targetCard.getByRole('button', { name: '捐款', exact: true });
    await actionButton.click();
    await expect.poll(() => attempts).toBe(1);
    await expect(actionButton).toBeDisabled();
    state = { ...state, revision: state.revision + 1 };
    await broadcastCityState(page, state);
    await expect(actionButton).toBeDisabled();
    await panel.getByRole('button', { name: '关闭', exact: true }).click();
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    await expect(panel).toHaveAttribute('open', '');
    await expect(input).toHaveValue('500');
    await expect(actionButton).toBeDisabled();
    expect(attempts).toBe(1);
    releaseMutation();
    const message = failure === 'insufficient coins' ? '金币不足' : failure === 'sign in' ? '请先登录'
      : failure === 'invalid response' || failure === 'unknown error' ? '建设请求失败' : '网络连接异常';
    if (failure === 'sign in') {
      await expect.poll(() => page.evaluate(() => (window as unknown as { cityLoginRequests: number }).cityLoginRequests)).toBe(1);
      await expect(page.locator('#loginOverlay')).toBeVisible();
      await expect(panel).not.toHaveAttribute('open');
      await expect(page.locator('#loginInput')).toBeFocused();
      await expect(panel.locator('[data-city-feedback]')).toBeHidden();
      expect(attempts).toBe(1);
      expect(pageErrors).toEqual([]);
      return;
    }
    await expect(panel.getByRole('alert')).toContainText(message);
    if (failure === 'unknown error') await expect(panel.getByRole('alert')).not.toContainText('unmapped internal server detail');
    await expect(actionButton).toBeEnabled();
    // Reopening focuses Close. A late failure must preserve whichever control
    // the resident chose after the panel was rebuilt.
    await expect(panel.getByRole('button', { name: '关闭', exact: true })).toBeFocused();
    await expect(input).toHaveValue('500');
    if (failure === 'insufficient coins') {
      // The alert must appear while the 409 refresh is still blocked.
      await expect.poll(() => stateReads).toBeGreaterThanOrEqual(2);
      await input.focus();
      state = { ...state, revision: state.revision + 1 };
      const latestRevision = state.revision;
      const focusedInput = await input.elementHandle();
      await broadcastCityState(page, state);
      // Capture this exact in-flight load before releasing its stale response;
      // starting another load afterwards could conceal a temporary rollback.
      await page.evaluate(async () => {
        const modulePath = '/src/city/cityGovernanceClient.ts';
        const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
        (window as unknown as { pendingCityRefresh: Promise<void> }).pendingCityRefresh = client.loadCityGovernance();
      });
      releaseRefresh();
      await page.evaluate(async () => {
        const loading = window as unknown as { pendingCityRefresh?: Promise<void> };
        await loading.pendingCityRefresh;
        delete loading.pendingCityRefresh;
      });
      await expect(panel.locator('[data-city-status]')).toHaveText(`云端进度 #${latestRevision}`);
      await expect(input).toBeFocused();
      state = { ...state, revision: state.revision + 1 };
      await broadcastCityState(page, state);
      await expect(input).toBeFocused();
      await expect(panel.getByRole('alert')).toContainText(message);
      expect(await focusedInput?.evaluate((node) => node === document.activeElement)).toBe(true);
    }
    if (failure !== 'insufficient coins') {
      await input.fill('600');
      await input.fill('500');
      await panel.getByRole('spinbutton').nth(1).fill('250');
      config.version = 'error-fixture-v2';
      state = { ...state, configVersion: config.version };
      await reloadCityState(page);
    }
    // The draft must survive removal of its control, not just an immediate refresh.
    await expect(panel.getByRole('alert')).toContainText(message);
    await expect(panel.getByRole('alert')).toContainText('「猫猫咖啡厅」');
    expect(await feedback?.evaluate((node) => node === document.querySelector('[data-city-feedback]'))).toBe(true);
    await expect(input).toHaveValue('500');
    await actionButton.click();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(panel).toContainText('500 金币 / 3,000 金币');
    expect(attempts).toBe(2);
    const { requestId: firstId, ...first } = requests[0]!;
    const { requestId: retryId, ...retry } = requests[1]!;
    expect(retry).toEqual(first);
    if (failure !== 'insufficient coins') expect(retryId).toBe(firstId);
    else expect(retryId).not.toBe(firstId);
    if (failure !== 'insufficient coins') await expect(panel.getByRole('status', { name: '建设结果', exact: true })).toHaveText('上一笔已成功，未重复扣费。');
    // A confirmed replay releases the old ID; another donation is a new charge.
    await actionButton.click();
    await expect(targetCard).toContainText('1,000 金币 / 3,000 金币');
    expect(requests[2]!.requestId).not.toBe(retryId);
    expect(requests[2]!.configVersion).toBe(config.version);
    expect(committedRequests.size).toBe(2);
    await expect(panel.getByRole('status', { name: '建设结果', exact: true })).toHaveText('');
    if (failure === 'insufficient coins') {
      // After focus restoration, the action's original input may be detached.
      await input.fill('450');
      state = { ...state, revision: state.revision + 1 };
      await broadcastCityState(page, state);
      await input.fill('475');
      await actionButton.click();
      await expect(targetCard).toContainText('1,475 金币 / 3,000 金币');
      expect(requests[3]!.amount).toBe(475);
      config.version = 'error-fixture-restored';
      state = { ...state, configVersion: config.version, epoch: 'restored-epoch', revision: 0 };
      await reloadCityState(page);
      await expect(panel.locator('[data-city-status]')).toHaveText('云端进度 #0');
    }
    expect(pageErrors).toEqual([]);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}
