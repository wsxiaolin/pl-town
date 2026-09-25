import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';

for (const viewport of [{ width: 1280, height: 800 }, { width: 844, height: 390 }]) {
  test(`area construction previews quantity and total and retries one batch at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const plots = Array.from({ length: 20 }, (_, index) => ({
      id: `north-${index}`, name: `北侧花海 ${index + 1} 号`, x: -13 + (index % 5) * 2.5, z: -41 + Math.floor(index / 5) * 2.5, options: ['flowers', 'cherry'],
    }));
    const config: CityConfig = {
      schemaVersion: 1, version: 'area-test', projects: [],
      personalPlots: plots, personalAreas: [{ id: 'north-meadow', name: '北侧花海', plotIds: plots.map((plot) => plot.id) }],
      decorations: [{ id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 }, { id: 'cherry', name: '樱花树', kind: 'cherry', cost: 240 }],
      initialBuiltBuildingIds: ['commons', 'commons_outer'],
    };
    let state: CityState = { epoch: 'area-test', revision: 0, configVersion: config.version, projects: [], decorations: [] };
    const requests: Array<{ areaId: string; decorationId: string; quantity: number; requestId: string; configVersion: string }> = [];
    stubCityWebSocket(page, { user: 'area-tester', unlockedBuildings: ['commons'] });
    await page.route('**/town-api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/city/config')) return route.fulfill({ status: 200, json: config });
      if (path.endsWith('/city/state')) return route.fulfill({ status: 200, json: state });
      if (path.endsWith('/city/votes')) return route.fulfill({ status: 200, json: { epoch: state.epoch, projectIds: [] } });
      if (path.endsWith('/city/decorate')) {
        const body = route.request().postDataJSON();
        requests.push(body);
        if (requests.length === 1) return route.abort('connectionreset');
        if (requests.length === 2) return route.fulfill({ status: 503, json: { error: '请稍后重试' } });
        state = { ...state, revision: 1, decorations: plots.slice(0, body.quantity).map((plot) => ({ plotId: plot.id, decorationId: body.decorationId, ownerId: 'area-tester', ownerNickname: 'area-tester' })) };
        return route.fulfill({ status: 200, json: { state } });
      }
      if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    await waitForCityReady(page, 'area-tester');
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    const panel = page.locator('.city-governance-panel');
    await panel.getByRole('button', { name: '个人建设' }).click();
    const area = panel.locator('[data-city-area="north-meadow"]');
    await expect(area.locator('.city-area-cell')).toHaveCount(20);
    await expect(area.locator('.city-area-cell.selected')).toHaveCount(20);
    await expect(area.locator('[data-city-area-total]')).toContainText('总价 1,600 金币');
    const quantity = area.getByRole('spinbutton', { name: '北侧花海建设数量' });
    const action = area.getByRole('button', { name: '批量建设' });
    for (const invalid of ['0', '21', '1.5']) {
      await quantity.fill(invalid);
      await expect(action).toBeDisabled();
    }
    await quantity.fill('6');
    await area.getByRole('combobox').selectOption('cherry');
    await expect(area.locator('[data-city-area-total]')).toContainText('总价 1,440 金币');
    await expect(area.locator('.city-area-cell.selected')).toHaveCount(6);
    await action.click();
    await expect(action).toBeEnabled();
    await expect(panel.getByRole('alert')).toBeVisible();
    config.version = 'area-test-v2';
    state = { ...state, configVersion: config.version };
    await page.evaluate(async () => {
      const modulePath = '/src/city/cityGovernanceClient.ts';
      const client = await import(/* @vite-ignore */ modulePath);
      await client.loadCityGovernance();
    });
    await expect(quantity).toHaveValue('6');
    await expect(quantity).toBeDisabled();
    await action.click();
    await expect(action).toBeEnabled();
    await expect(panel.getByRole('alert')).toBeVisible();
    await action.click();
    await expect(area).toContainText('已建 6 / 20 处');
    await expect(area.locator('.city-area-cell.occupied')).toHaveCount(6);
    expect(requests).toHaveLength(3);
    for (const request of requests) expect(request).toMatchObject({ areaId: 'north-meadow', decorationId: 'cherry', quantity: 6, requestId: requests[0].requestId, configVersion: 'area-test' });
    await expect(panel.getByRole('alert')).toHaveCount(0);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await panel.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.locator('#c')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
