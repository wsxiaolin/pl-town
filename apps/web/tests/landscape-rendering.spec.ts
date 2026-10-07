import { expect, test } from '@playwright/test';
import { seedCityStorage, stubCityWebSocket, waitForCityBooted } from './helpers';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';

test.beforeEach(async ({ page }) => {
  // This rendering suite runs without a backend. Keep HTTP traffic isolated
  // as well as WebSocket traffic so proxy failures cannot pollute console QA.
  const config: CityConfig = {
    schemaVersion: 1, version: 'landscape-test', projects: [],
    personalPlots: [], decorations: [], initialBuiltBuildingIds: [],
  };
  const state: CityState = {
    epoch: 'landscape-test', revision: 0, configVersion: config.version,
    projects: [], decorations: [],
  };
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    if (path.endsWith('/city/votes')) return route.fulfill({ json: { epoch: state.epoch, projectIds: [] } });
    if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
    return route.continue();
  });
});

// The product requires landscape on phones; portrait shows the rotation prompt.
for (const viewport of [{ width: 1280, height: 800 }, { width: 660, height: 390 }]) {
  test(`sea renders at near and far views (${viewport.width})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    stubCityWebSocket(page);
    await seedCityStorage(page);
    await page.clock.setFixedTime(new Date('2026-10-07T00:12:00Z'));
    await waitForCityBooted(page);
    expect(await page.evaluate(() => (window as any)._mini.scene.getObjectByName('shore-surf') !== undefined)).toBe(true);
    for (const [x, z, zoom] of [[-42, 0, 6], [-42, 0, 10], [0, 0, 21]]) {
      const frame = await page.evaluate(([x, z, zoom]) => {
        const mini = (window as any)._mini;
        mini.focus(x, z, zoom);
        return mini.renderer.info.render.frame;
      }, [x, z, zoom]);
      await expect.poll(() => page.evaluate(() => (window as any)._mini.renderer.info.render.frame)).toBeGreaterThan(frame + 5);
      expect(await page.evaluate(() => (window as any)._mini.renderer.getContext().isContextLost())).toBe(false);
      await page.screenshot({ path: test.info().outputPath(`landscape-${x}-${zoom}.png`) });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: test.info().outputPath('landscape.png') });
    expect(errors).toEqual([]);
  });
}

test('energy-saving settings retain a flat landscape without animated water', async ({ page }) => {
  stubCityWebSocket(page);
  await seedCityStorage(page);
  await page.addInitScript(() => {
    const settings = JSON.parse(localStorage.getItem('minicityRenderSettings')!);
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ ...settings, resolution: 0.5, waterRendering: false }));
  });
  await waitForCityBooted(page);
  expect(await page.evaluate(() => {
    let count = 0;
    (window as any)._mini.scene.traverse((object: any) => { if (object.name === 'shore-surf') count++; });
    return count;
  })).toBe(0);
  expect(await page.evaluate(() => (window as any)._mini.renderer.getContext().isContextLost())).toBe(false);
});
