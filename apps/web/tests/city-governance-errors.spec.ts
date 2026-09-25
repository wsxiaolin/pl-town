import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

for (const action of ['donate', 'decorate'] as const) {
  test(`${action} shows insufficient coins after a conflict refresh and can retry`, async ({ page }) => {
    if (action === 'decorate') await page.setViewportSize({ width: 844, height: 390 });
    const config = {
      schemaVersion: 1, version: 'error-fixture',
      projects: [{ id: 'build-catcafe', buildingId: 'catcafe', name: '猫猫咖啡厅', description: '共同筹建', kind: 'building', cost: 3000 }],
      personalPlots: [{ id: 'garden', name: '测试花园', x: 30, z: -40, options: ['flowers'] }],
      decorations: [{ id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 }],
      initialBuiltBuildingIds: ['commons'],
    };
    let state = {
      epoch: 'error-epoch', revision: 0, configVersion: config.version,
      projects: [{ id: 'build-catcafe', funded: 0, built: false }],
      decorations: [] as Array<{ plotId: string; decorationId: string; ownerId: string; ownerNickname: string }>,
    };
    let attempts = 0;
    let stateReads = 0;
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
        if (attempts === 1) return route.fulfill({ status: 409, json: { error: 'Insufficient currency' } });
        state = {
          ...state, revision: 1,
          projects: [{ id: 'build-catcafe', funded: action === 'donate' ? 100 : 0, built: false }],
          decorations: action === 'decorate'
            ? [{ plotId: 'garden', decorationId: 'flowers', ownerId: 'stub-user', ownerNickname: 'error-tester' }]
            : [],
        };
        return route.fulfill({ json: { state } });
      }
      return route.fulfill({ status: 204, body: '' });
    });
    await waitForCityReady(page, 'error-tester');
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    const panel = page.locator('.city-governance-panel');
    if (action === 'decorate') await panel.getByRole('button', { name: '个人建设', exact: true }).click();
    const actionButton = panel.getByRole('button', { name: action === 'donate' ? '捐款' : '建设', exact: true });
    await actionButton.click();
    await expect(panel.getByRole('alert')).toContainText('金币不足');
    await expect(actionButton).toBeEnabled();
    expect(stateReads).toBeGreaterThanOrEqual(2);
    // Another render must retain the feedback, even when the visible card changes.
    await panel.getByRole('button', { name: '城市集体建设', exact: true }).click();
    await expect(panel.getByRole('alert')).toContainText('金币不足');
    if (action === 'decorate') await panel.getByRole('button', { name: '个人建设', exact: true }).click();
    await actionButton.click();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(panel).toContainText(action === 'donate' ? '100 金币 / 3,000 金币' : '已由 error-tester 建设');
    expect(attempts).toBe(2);
    expect(pageErrors).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
