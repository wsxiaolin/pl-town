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
  ['donate', 'invalid response'], ['decorate', 'insufficient coins'], ['decorate', 'lost response'],
  ['decorate', 'invalid response'],
  ['donate', 'sign in'], ['donate', 'unknown error'],
] as const;
for (const [action, failure] of scenarios) {
  test(`${action} preserves the draft across ${failure} and tab changes before retry`, async ({ page }) => {
    if (action === 'decorate') await page.setViewportSize({ width: 600, height: 390 });
    const config = {
      schemaVersion: 1, version: 'error-fixture',
      projects: [
        { id: 'build-catcafe', buildingId: 'catcafe', name: '猫猫咖啡厅', description: '共同筹建', kind: 'building', cost: 3000 },
        { id: 'build-library', buildingId: 'library', name: '图书馆', description: '共同筹建图书馆', kind: 'building', cost: 2000 },
      ],
      personalPlots: [{ id: 'garden', name: '测试花园', x: 30, z: -40, options: ['flowers', 'pine'] }],
      decorations: [{ id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 }, { id: 'pine', name: '松树', kind: 'pine', cost: 120 }],
      initialBuiltBuildingIds: ['commons'],
    };
    let state = {
      epoch: 'error-epoch', revision: 0, configVersion: config.version,
      projects: [
        { id: 'build-catcafe', funded: 0, built: false },
        { id: 'build-library', funded: 0, built: false },
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
        const fingerprint = JSON.stringify([body.projectId ?? body.plotId, body.amount ?? body.decorationId, body.configVersion]);
        const replayed = committedRequests.has(requestId);
        if (replayed && committedRequests.get(requestId) !== fingerprint) {
          return route.fulfill({ status: 409, json: { error: 'requestId already used with different parameters' } });
        }
        if (!replayed) {
          if (body.configVersion !== config.version) {
            return route.fulfill({ status: 409, json: { error: 'City config changed; reload config' } });
          }
          committedRequests.set(requestId, fingerprint);
          funded += action === 'donate' ? Number(body.amount) : 0;
          state = {
            ...state, revision: state.revision + 1,
            projects: [
              { id: 'build-catcafe', funded, built: false },
              { id: 'build-library', funded: 0, built: false },
            ],
            decorations: action === 'decorate'
              ? [{ plotId: 'garden', decorationId: String(body.decorationId), ownerId: 'stub-user', ownerNickname: 'error-tester' }]
              : state.decorations,
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
    if (action === 'decorate') {
      expect(await panel.locator('.city-governance-head').evaluate((header) => {
        const panelBounds = header.parentElement!.getBoundingClientRect();
        const headerBounds = header.getBoundingClientRect();
        return Math.abs(headerBounds.left - panelBounds.left) < 1 && Math.abs(headerBounds.right - panelBounds.right) < 1;
      })).toBe(true);
    }
    const feedback = await panel.locator('[data-city-feedback]').elementHandle();
    if (action === 'decorate') await panel.getByRole('button', { name: '个人建设', exact: true }).click();
    const targetCard = panel.locator('.city-governance-card').filter({ hasText: action === 'donate' ? '猫猫咖啡厅' : '测试花园' }).first();
    const input = action === 'donate' ? targetCard.getByRole('spinbutton') : targetCard.getByRole('combobox');
    if (action === 'donate') await input.fill('500');
    else await input.selectOption('pine');
    const actionButton = targetCard.getByRole('button', { name: action === 'donate' ? '捐款' : '建设', exact: true });
    await actionButton.click();
    await expect.poll(() => attempts).toBe(1);
    await expect(actionButton).toBeDisabled();
    state = { ...state, revision: state.revision + 1 };
    await broadcastCityState(page, state);
    await expect(actionButton).toBeDisabled();
    await panel.getByRole('button', { name: '关闭', exact: true }).click();
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    await expect(panel).toHaveClass(/open/);
    await expect(input).toHaveValue(action === 'donate' ? '500' : 'pine');
    await expect(actionButton).toBeDisabled();
    expect(attempts).toBe(1);
    releaseMutation();
    const message = failure === 'insufficient coins' ? '金币不足' : failure === 'sign in' ? '请先登录'
      : failure === 'invalid response' || failure === 'unknown error' ? '建设请求失败' : '网络连接异常';
    await expect(panel.getByRole('alert')).toContainText(message);
    if (failure === 'sign in') {
      await expect.poll(() => page.evaluate(() => (window as unknown as { cityLoginRequests: number }).cityLoginRequests)).toBe(1);
      await expect(page.locator('#loginOverlay')).toBeVisible();
      await expect(input).toHaveValue('500');
      expect(pageErrors).toEqual([]);
      return;
    }
    if (failure === 'unknown error') await expect(panel.getByRole('alert')).not.toContainText('unmapped internal server detail');
    await expect(actionButton).toBeEnabled();
    await expect(actionButton).toBeFocused();
    await expect(input).toHaveValue(action === 'donate' ? '500' : 'pine');
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
      if (action === 'donate') expect(await focusedInput?.evaluate((node) => node === document.activeElement)).toBe(true);
    }
    if (failure !== 'insufficient coins') {
      if (action === 'donate') {
        await input.fill('600');
        await input.fill('500');
        await panel.getByRole('spinbutton').nth(1).fill('250');
        config.version = 'error-fixture-v2';
        state = { ...state, configVersion: config.version };
        await reloadCityState(page);
      } else {
        await input.selectOption('flowers');
        await input.selectOption('pine');
      }
    }
    // Drafts must survive removal of their controls, not just an immediate refresh.
    const currentTab = action === 'donate' ? '城市集体建设' : '个人建设';
    const otherTab = action === 'donate' ? '个人建设' : '城市集体建设';
    await panel.getByRole('button', { name: otherTab, exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText(message);
    await panel.getByRole('button', { name: currentTab, exact: true }).click();
    expect(await feedback?.evaluate((node) => node === document.querySelector('[data-city-feedback]'))).toBe(true);
    await expect(input).toHaveValue(action === 'donate' ? '500' : 'pine');
    await actionButton.click();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(panel).toContainText(action === 'donate' ? '500 金币 / 3,000 金币' : '已由 error-tester 建设：松树');
    expect(attempts).toBe(2);
    const { requestId: firstId, ...first } = requests[0]!;
    const { requestId: retryId, ...retry } = requests[1]!;
    expect(retry).toEqual(first);
    if (failure !== 'insufficient coins') expect(retryId).toBe(firstId);
    else expect(retryId).not.toBe(firstId);
    if (failure !== 'insufficient coins') await expect(panel.getByRole('status')).toHaveText('上一笔已成功，未重复扣费。');
    if (action === 'donate') {
      // A confirmed replay releases the old ID; another donation is a new charge.
      await actionButton.click();
      await expect(targetCard).toContainText('1,000 金币 / 3,000 金币');
      expect(requests[2]!.requestId).not.toBe(retryId);
      expect(requests[2]!.configVersion).toBe(config.version);
      expect(committedRequests.size).toBe(2);
      await expect(panel.getByRole('status')).toHaveCount(0);
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
    }
    expect(pageErrors).toEqual([]);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}
