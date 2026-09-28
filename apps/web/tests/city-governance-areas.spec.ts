import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';

const scenarios = [{ width: 1280, height: 800 }, { width: 844, height: 390 }]
  .flatMap((viewport) => [false, true].map((committedBeforeLoss) => ({ viewport, committedBeforeLoss })));
for (const { viewport, committedBeforeLoss } of scenarios) {
  test(`block construction retries ${committedBeforeLoss ? 'a committed patch' : 'an uncommitted patch'} at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    // The full retry/config-rollover flow renders the city throughout. Allow
    // software WebGL enough total time without relaxing individual assertions.
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const plots = Array.from({ length: 20 }, (_, index) => ({
      id: `north-${index}`, name: `北侧花海 ${index + 1} 号`, x: -13 + (index % 5) * 2.5, z: -41 + Math.floor(index / 5) * 2.5, options: ['flowers', 'cherry'],
    }));
    const blockPlacements = (ids: string[], decorationIds: string[]) => ids.map((plotId, index) => ({ plotId, decorationId: decorationIds[index % decorationIds.length]! }));
    const blocks = [
      { id: 'north-block-a', name: '北侧花海 · 一区', areaId: 'north-meadow', description: '一区的花境。', cost: 640, placements: blockPlacements(plots.slice(0, 4).map((plot) => plot.id), ['flowers', 'cherry']) },
      { id: 'north-block-b', name: '北侧花海 · 二区', areaId: 'north-meadow', description: '二区的花境。', cost: 320, placements: blockPlacements(plots.slice(4, 8).map((plot) => plot.id), ['flowers']) },
      { id: 'north-block-c', name: '北侧花海 · 三区', areaId: 'north-meadow', description: '三区的花境。', cost: 640, placements: blockPlacements(plots.slice(8, 12).map((plot) => plot.id), ['cherry', 'flowers']) },
      { id: 'north-block-d', name: '北侧花海 · 四区', areaId: 'north-meadow', description: '四区的花境。', cost: 480, placements: blockPlacements(plots.slice(12, 16).map((plot) => plot.id), ['flowers', 'cherry']) },
      { id: 'north-block-e', name: '北侧花海 · 五区', areaId: 'north-meadow', description: '五区的花境。', cost: 640, placements: blockPlacements(plots.slice(16, 20).map((plot) => plot.id), ['cherry', 'flowers']) },
    ];
    const config: CityConfig = {
      schemaVersion: 1, version: 'area-test', projects: [],
      personalPlots: plots, personalAreas: [{ id: 'north-meadow', name: '北侧花海', plotIds: plots.map((plot) => plot.id) }],
      personalBlocks: blocks,
      decorations: [{ id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 }, { id: 'cherry', name: '樱花树', kind: 'cherry', cost: 240 }],
      initialBuiltBuildingIds: ['commons', 'commons_outer'],
    };
    let state: CityState = { epoch: 'area-test', revision: 0, configVersion: config.version, projects: [], decorations: [] };
    const requests: Array<{ blockId: string; requestId: string; configVersion: string }> = [];
    const receipts = new Map<string, string>();
    let charged = 0;
    const builtBlock = () => blocks[0]!.placements.map((placement) => ({ plotId: placement.plotId, decorationId: placement.decorationId, ownerId: 'area-tester', ownerNickname: 'area-tester' }));
    stubCityWebSocket(page, { user: 'area-tester', unlockedBuildings: ['commons'] });
    await page.route('**/town-api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/city/config')) return route.fulfill({ status: 200, json: config });
      if (path.endsWith('/city/state')) return route.fulfill({ status: 200, json: state });
      if (path.endsWith('/city/votes')) return route.fulfill({ status: 200, json: { epoch: state.epoch, projectIds: [] } });
      if (path.endsWith('/city/decorate')) {
        const body = route.request().postDataJSON();
        requests.push(body);
        if (requests.length === 1 && !committedBeforeLoss) return route.abort('connectionreset');
        if (requests.length === 2) return route.fulfill({ status: 503, json: { error: '请稍后重试' } });
        const fingerprint = JSON.stringify([body.blockId, body.configVersion]);
        const replayed = receipts.has(body.requestId);
        if (replayed && receipts.get(body.requestId) !== fingerprint) {
          return route.fulfill({ status: 409, json: { error: 'requestId already used with different parameters' } });
        }
        if (!replayed) {
          receipts.set(body.requestId, fingerprint);
          charged += body.blockId === 'north-block-a' ? 640 : 320;
          state = { ...state, revision: state.revision + 1, decorations: builtBlock() };
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
    const block = panel.locator('[data-city-block="north-block-a"]');
    const action = block.getByRole('button');
    await expect(block.locator('.city-area-cell')).toHaveCount(4);
    await expect(block.locator('[data-city-block-total]')).toContainText('整片投建 4 处 · 花坛 ×2 · 樱花树 ×2 · 640 金币');
    await expect(block.locator('.city-area-cell', { hasText: '花坛' })).toHaveCount(2);
    await expect(block.locator('.city-area-cell', { hasText: '樱花树' })).toHaveCount(2);
    await expect(block.locator('.city-area-cell.occupied')).toHaveCount(0);
    await expect(action).toBeEnabled();
    await expect(panel.locator('[data-city-block]')).toHaveCount(5);
    await action.click();
    await expect(action).toBeEnabled();
    await expect(panel.getByRole('alert')).toBeVisible();
    if (committedBeforeLoss) {
      // The original response was lost after committing. The city broadcast now
      // fills the whole patch, but the unconfirmed receipt must still be retryable.
      await page.evaluate(async (next) => {
        const modulePath = '/src/city/cityGovernanceClient.ts';
        const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
        client.applyCityState(next);
      }, state);
      await expect(block.locator('.city-area-cell.occupied')).toHaveCount(4);
      await expect(block.locator('[data-city-block-total]')).toContainText('结果待确认');
      await expect(action).toBeEnabled();
    }
    config.version = 'area-test-v2';
    state = { ...state, configVersion: config.version };
    await page.evaluate(async () => {
      const modulePath = '/src/city/cityGovernanceClient.ts';
      const client = await import(/* @vite-ignore */ modulePath);
      await client.loadCityGovernance();
    });
    await expect(block.locator('[data-city-block-total]')).toContainText('结果待确认');
    await expect(action).toBeEnabled();
    await action.click();
    await expect(action).toBeEnabled();
    await expect(panel.getByRole('alert')).toBeVisible();
    await action.click();
    await expect(block).toContainText('已由 area-tester 投建');
    await expect(block.locator('.city-area-cell.occupied')).toHaveCount(4);
    await expect(action).toBeDisabled();
    expect(requests).toHaveLength(3);
    for (const request of requests) expect(request).toMatchObject({ blockId: 'north-block-a', requestId: requests[0]!.requestId, configVersion: 'area-test' });
    expect(receipts.size).toBe(1);
    expect(charged).toBe(640);
    if (committedBeforeLoss) {
      await expect(panel.getByRole('status', { name: '建设结果', exact: true })).toHaveText('上一笔已成功，未重复扣费。');
    }
    await expect(panel.getByRole('alert')).toHaveCount(0);
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await panel.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(page.locator('#c')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
