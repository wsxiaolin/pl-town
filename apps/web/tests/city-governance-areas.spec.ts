import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';

const scenarios = [{ width: 1280, height: 800 }, { width: 844, height: 390 }]
  .flatMap((viewport) => [false, true].map((committedBeforeLoss) => ({ viewport, committedBeforeLoss })));
for (const { viewport, committedBeforeLoss } of scenarios) {
  test(`area construction retries ${committedBeforeLoss ? 'a committed full area' : 'an uncommitted batch'} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
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
    const receipts = new Map<string, string>();
    let charged = 0;
    stubCityWebSocket(page, { user: 'area-tester', unlockedBuildings: ['commons'] });
    await page.route('**/town-api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/city/config')) return route.fulfill({ status: 200, json: config });
      if (path.endsWith('/city/state')) return route.fulfill({ status: 200, json: state });
      if (path.endsWith('/city/decorate')) {
        const body = route.request().postDataJSON();
        requests.push(body);
        if (requests.length === 1 && !committedBeforeLoss) return route.abort('connectionreset');
        if (requests.length === 2) return route.fulfill({ status: 503, json: { error: '请稍后重试' } });
        const fingerprint = JSON.stringify([body.areaId, body.decorationId, body.quantity, body.configVersion]);
        const replayed = receipts.has(body.requestId);
        if (replayed && receipts.get(body.requestId) !== fingerprint) {
          return route.fulfill({ status: 409, json: { error: 'requestId already used with different parameters' } });
        }
        if (!replayed) {
          receipts.set(body.requestId, fingerprint);
          charged += body.quantity * 240;
          state = { ...state, revision: state.revision + 1, decorations: plots.slice(0, body.quantity).map((plot) => ({ plotId: plot.id, decorationId: body.decorationId, ownerId: 'area-tester', ownerNickname: 'area-tester' })) };
        }
        if (requests.length === 1) return route.abort('connectionreset');
        return route.fulfill({ status: 200, json: { state, replayed } });
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
    for (const invalid of ['', '0', '21', '1.5']) {
      await quantity.fill(invalid);
      await expect(action).toBeDisabled();
    }
    await quantity.fill('6');
    await area.getByRole('combobox').selectOption('cherry');
    await expect(area.locator('[data-city-area-total]')).toContainText('总价 1,440 金币');
    await expect(area.locator('.city-area-cell.selected')).toHaveCount(6);
    await quantity.focus();
    state = { ...state, revision: state.revision + 1 };
    await page.evaluate(async (next) => {
      const modulePath = '/src/city/cityGovernanceClient.ts';
      const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
      client.applyCityState(next);
    }, state);
    await expect(quantity).toBeFocused();
    await quantity.fill('');
    state = { ...state, revision: state.revision + 1 };
    await page.evaluate(async (next) => {
      const modulePath = '/src/city/cityGovernanceClient.ts';
      const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
      client.applyCityState(next);
    }, state);
    await expect(quantity).toHaveValue('');
    await expect(quantity).toBeFocused();
    await expect(action).toBeDisabled();
    await quantity.fill('0');
    await expect(action).toBeDisabled();
    await quantity.fill('5');
    await expect(area.locator('[data-city-area-total]')).toContainText('总价 1,200 金币');
    await expect(area.locator('.city-area-cell.selected')).toHaveCount(5);
    await expect(action).toBeEnabled();
    const chosenQuantity = committedBeforeLoss ? 20 : 6;
    await quantity.fill(String(chosenQuantity));
    await action.click();
    await expect(action).toBeEnabled();
    await expect(panel.getByRole('alert')).toBeVisible();
    const mismatchedRetries = await page.evaluate(async (count) => {
      const modulePath = '/src/city/cityGovernanceClient.ts';
      const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
      const errors: string[] = [];
      for (const [decorationId, quantity] of [['cherry', count - 1], ['flowers', count]] as const) {
        try { await client.decorateCityArea('north-meadow', decorationId, quantity); }
        catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
      }
      return errors;
    }, chosenQuantity);
    expect(mismatchedRetries).toHaveLength(2);
    for (const message of mismatchedRetries) expect(message).toContain('请先按原装饰和数量重试');
    expect(requests).toHaveLength(1);
    if (committedBeforeLoss) {
      // The original response was lost after committing. The city broadcast now
      // fills every slot, but the unconfirmed receipt must still be retryable.
      await page.evaluate(async (next) => {
        const modulePath = '/src/city/cityGovernanceClient.ts';
        const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
        client.applyCityState(next);
      }, state);
      await expect(area.locator('.city-area-cell.occupied')).toHaveCount(20);
      await expect(area.locator('[data-city-area-total]')).toContainText('结果待确认');
      await expect(action).toBeEnabled();
    }
    config.version = 'area-test-v2';
    state = { ...state, configVersion: config.version };
    await page.evaluate(async () => {
      const modulePath = '/src/city/cityGovernanceClient.ts';
      const client = await import(/* @vite-ignore */ modulePath);
      await client.loadCityGovernance();
    });
    await expect(quantity).toHaveValue(String(chosenQuantity));
    await expect(quantity).toBeDisabled();
    await action.click();
    await expect(action).toBeEnabled();
    await expect(panel.getByRole('alert')).toBeVisible();
    await action.click();
    await expect(area).toContainText(`已建 ${chosenQuantity} / 20 处`);
    await expect(area.locator('.city-area-cell.occupied')).toHaveCount(chosenQuantity);
    expect(requests).toHaveLength(3);
    for (const request of requests) expect(request).toMatchObject({ areaId: 'north-meadow', decorationId: 'cherry', quantity: chosenQuantity, requestId: requests[0]!.requestId, configVersion: 'area-test' });
    expect(receipts.size).toBe(1);
    expect(charged).toBe(chosenQuantity * 240);
    if (committedBeforeLoss) {
      await expect(panel.getByRole('status')).toHaveText('上一笔已成功，未重复扣费。');
      await expect(action).toBeDisabled();
    }
    await expect(panel.getByRole('alert')).toHaveCount(0);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await panel.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.locator('#c')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
