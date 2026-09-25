import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

const scenarios = [
  ['donate', 'insufficient coins'], ['donate', 'lost response'],
  ['donate', 'invalid response'], ['decorate', 'insufficient coins'], ['decorate', 'lost response'],
  ['decorate', 'invalid response'],
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
    const committedRequestIds = new Set<string>();
    let funded = 0;
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    stubCityWebSocket(page, { user: 'error-tester', unlockedBuildings: ['commons'] });
    await page.route('**/town-api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/city/config')) return route.fulfill({ json: config });
      if (path.endsWith('/city/state')) {
        stateReads += 1;
        return route.fulfill({ json: state });
      }
      if (path.endsWith(`/city/${action}`)) {
        attempts += 1;
        const body = route.request().postDataJSON() as Record<string, unknown>;
        requests.push(body);
        if (attempts === 1 && failure === 'insufficient coins') return route.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
        const replayed = typeof body.requestId === 'string' && committedRequestIds.has(body.requestId);
        if (!replayed) {
          if (typeof body.requestId === 'string') committedRequestIds.add(body.requestId);
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
        }
        return route.fulfill({ json: { state } });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    await waitForCityReady(page, 'error-tester');
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    const panel = page.locator('.city-governance-panel');
    if (action === 'decorate') await panel.getByRole('button', { name: '个人建设', exact: true }).click();
    const targetCard = panel.locator('.city-governance-card').filter({ hasText: action === 'donate' ? '猫猫咖啡厅' : '测试花园' }).first();
    const input = action === 'donate' ? targetCard.getByRole('spinbutton') : targetCard.getByRole('combobox');
    if (action === 'donate') await input.fill('500');
    else await input.selectOption('pine');
    const actionButton = targetCard.getByRole('button', { name: action === 'donate' ? '捐款' : '建设', exact: true });
    await actionButton.click();
    const message = failure === 'insufficient coins' ? '金币不足' : failure === 'invalid response' ? '建设请求失败' : '网络连接异常';
    await expect(panel.getByRole('alert')).toContainText(message);
    await expect(actionButton).toBeEnabled();
    await expect(actionButton).toBeFocused();
    await expect(input).toHaveValue(action === 'donate' ? '500' : 'pine');
    if (failure === 'insufficient coins') expect(stateReads).toBeGreaterThanOrEqual(2);
    if (failure === 'lost response' || failure === 'invalid response') {
      if (action === 'donate') {
        await input.fill('600');
        await input.fill('500');
        await panel.getByRole('spinbutton').nth(1).fill('250');
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
    await expect(input).toHaveValue(action === 'donate' ? '500' : 'pine');
    await actionButton.click();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(panel).toContainText(action === 'donate' ? '500 金币 / 3,000 金币' : '已由 error-tester 建设：松树');
    expect(attempts).toBe(2);
    const { requestId: firstId, ...first } = requests[0]!;
    const { requestId: retryId, ...retry } = requests[1]!;
    expect(retry).toEqual(first);
    if (failure === 'lost response' || failure === 'invalid response') expect(retryId).toBe(firstId);
    expect(pageErrors).toEqual([]);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}
