import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

const scenarios = [
  ['donate', 'insufficient coins'], ['donate', 'lost response'],
  ['decorate', 'insufficient coins'], ['decorate', 'lost response'],
] as const;
for (const [action, failure] of scenarios) {
  test(`${action} preserves the draft across ${failure} and tab changes before retry`, async ({ page }) => {
    if (action === 'decorate') await page.setViewportSize({ width: 844, height: 390 });
    const config = {
      schemaVersion: 1, version: 'error-fixture',
      projects: [{ id: 'build-catcafe', buildingId: 'catcafe', name: '猫猫咖啡厅', description: '共同筹建', kind: 'building', cost: 3000 }],
      personalPlots: [{ id: 'garden', name: '测试花园', x: 30, z: -40, options: ['flowers', 'pine'] }],
      decorations: [{ id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 }, { id: 'pine', name: '松树', kind: 'pine', cost: 120 }],
      initialBuiltBuildingIds: ['commons'],
    };
    let state = {
      epoch: 'error-epoch', revision: 0, configVersion: config.version,
      projects: [{ id: 'build-catcafe', funded: 0, built: false }],
      decorations: [] as Array<{ plotId: string; decorationId: string; ownerId: string; ownerNickname: string }>,
    };
    let attempts = 0;
    let stateReads = 0;
    const requests: Array<Record<string, unknown>> = [];
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
        state = {
          ...state, revision: 1,
          projects: [{ id: 'build-catcafe', funded: action === 'donate' ? Number(body.amount) : 0, built: false }],
          decorations: action === 'decorate'
            ? [{ plotId: 'garden', decorationId: String(body.decorationId), ownerId: 'stub-user', ownerNickname: 'error-tester' }]
            : [],
        };
        // The server committed, but the browser never received its response.
        if (attempts === 1) return route.abort('connectionreset');
        return route.fulfill({ json: { state } });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    await waitForCityReady(page, 'error-tester');
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    const panel = page.locator('.city-governance-panel');
    if (action === 'decorate') await panel.getByRole('button', { name: '个人建设', exact: true }).click();
    const input = action === 'donate' ? panel.getByRole('spinbutton') : panel.getByRole('combobox');
    if (action === 'donate') await input.fill('500');
    else await input.selectOption('pine');
    const actionButton = panel.getByRole('button', { name: action === 'donate' ? '捐款' : '建设', exact: true });
    await actionButton.click();
    const message = failure === 'insufficient coins' ? '金币不足' : '网络连接异常';
    await expect(panel.getByRole('alert')).toContainText(message);
    await expect(actionButton).toBeEnabled();
    await expect(input).toHaveValue(action === 'donate' ? '500' : 'pine');
    if (failure === 'insufficient coins') expect(stateReads).toBeGreaterThanOrEqual(2);
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
    if (failure === 'lost response') expect(retryId).toBe(firstId);
    expect(pageErrors).toEqual([]);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}
