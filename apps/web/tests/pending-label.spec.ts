import { expect, test } from '@playwright/test';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import type { MiniCityDebugApi } from '../src/city/debugApi';
import { stubWorldCatalogWebSocket, waitForCityReady } from './helpers';

type CatalogWindow = Window & {
  _mini: MiniCityDebugApi;
  __pushWorldCatalog: (catalog: Record<string, unknown>) => void;
};

for (const lockBeforeBuild of [false, true]) {
  test(`global story unlock keeps pending labels hidden and building respects story lock ${lockBeforeBuild}`, async ({ page }) => {
    const config: CityConfig = {
      schemaVersion: 1, version: 'pending-label', initialBuiltBuildingIds: ['commons'],
      projects: [{ id: 'build-litreview', buildingId: 'litreview', name: '文学审核部', description: '共同筹建', kind: 'building', cost: 3000 }],
      personalPlots: [], decorations: [],
    };
    let state: CityState = {
      epoch: 'pending-label', revision: 0, configVersion: config.version,
      projects: [{ id: 'build-litreview', funded: 0, built: false }], decorations: [],
    };
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    stubWorldCatalogWebSocket(page, 'pending-label-tester');
    await page.route('**/town-api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/city/config')) return route.fulfill({ json: config });
      if (path.endsWith('/city/state')) return route.fulfill({ json: state });
      return route.fulfill({ status: 204, body: '' });
    });
    await waitForCityReady(page, 'pending-label-tester');
    const label = page.locator('.b-label-item[data-building-id="litreview"]');
    const interact = () => page.evaluate(() => (window as unknown as CatalogWindow)._mini.interactBuilding('litreview'));
    const updateCatalog = (unlocked: boolean) => page.evaluate((value) => {
      (window as unknown as CatalogWindow).__pushWorldCatalog({
        initialCurrency: 0, buildingPrices: {}, buildingUnlockable: { litreview: true },
        globallyUnlockedBuildings: value ? ['litreview'] : [], achievementRewards: {}, products: {},
      });
    }, unlocked);
    await expect(label).toHaveCount(0);
    expect(await interact()).toBe(false);
    await updateCatalog(true);
    await expect(label).toHaveCount(0);
    expect(await interact()).toBe(false);

    // Re-locking while pending must still update the independent story policy.
    if (lockBeforeBuild) await updateCatalog(false);
    state = { ...state, revision: 1, projects: [{ id: 'build-litreview', funded: 3000, built: true }] };
    await page.evaluate(async () => {
      const modulePath = '/src/city/cityGovernanceClient.ts';
      await (await import(modulePath)).loadCityGovernance();
    });
    if (lockBeforeBuild) {
      await expect(label).toHaveCount(0);
      expect(await interact()).toBe(false);
      await updateCatalog(true);
    }
    await expect(label).toHaveCount(1);
    expect(await interact()).toBe(true);
    await updateCatalog(false);
    await expect(label).toHaveCount(0);
    expect(await interact()).toBe(false);
    expect(errors).toEqual([]);
  });
}
