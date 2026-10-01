import { expect, test } from '@playwright/test';
import type { WebGLRenderer } from 'three';
import type { MiniCityDebugApi } from '../src/city/debugApi';
import { stubCityWebSocket, waitForCityReady } from './helpers';

type CityWindow = Window & { _mini: MiniCityDebugApi };

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 844, height: 390 }]) {
  test(`an open map refreshes at dusk and dawn while preserving search on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // A real minute is one town hour. Fixed Date leaves animation frames and
    // the application's clock synchronization interval running normally.
    const midnight = new Date('2026-09-25T00:00:00Z').getTime();
    await page.clock.setFixedTime(new Date(midnight + 18 * 60_000));
    const config = {
      schemaVersion: 1, version: 'map-theme', initialBuiltBuildingIds: ['commons', 'library'],
      projects: [], personalPlots: [], decorations: [],
    };
    const state = { epoch: 'map-theme', revision: 0, configVersion: config.version, projects: [], decorations: [] };
    stubCityWebSocket(page, { user: 'map-theme-tester', unlockedBuildings: ['commons', 'library'] });
    await page.route('**/town-api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/city/config')) return route.fulfill({ json: config });
      if (path.endsWith('/city/state')) return route.fulfill({ json: state });
      return route.fulfill({ status: 204, body: '' });
    });
    await waitForCityReady(page, 'map-theme-tester');
    await expect(page.locator('#communityTime')).toHaveText('18:00');
    await page.locator('#mapToggle').click({ force: true });
    const overlay = page.locator('#mapOverlay');
    const map = page.locator('#mapImage');
    const search = page.locator('#mapSearchInput');
    await expect(overlay).toHaveClass(/show/);
    await expect(map).toBeVisible();
    await search.fill('图书馆');
    await expect(page.locator('.map-search-result')).toHaveCount(1);
    await expect(search).toBeFocused();
    const selected = await search.getAttribute('aria-activedescendant');
    let previousShot = await map.getAttribute('src');
    expect(previousShot).toMatch(/^data:image\/png/);

    for (const hour of [19, 6]) {
      await page.clock.setFixedTime(new Date(midnight + hour * 60_000));
      await expect(page.locator('#communityTime')).toHaveText(`${hour === 6 ? '06' : '19'}:00`);
      await expect(page.locator('body')).toHaveClass(hour === 19 ? /night/ : /day/);
      // The scene transition lasts 0.72 s and its clock invalidates the map
      // after 1 s. Poll the real image update without skipping these callbacks.
      await expect.poll(async () => (await map.getAttribute('src')) !== previousShot, { timeout: 15_000 }).toBe(true);
      previousShot = await map.getAttribute('src');
      await expect(map).toBeVisible();
      expect(await map.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
      await expect(overlay).toHaveClass(/show/);
      await expect(search).toHaveValue('图书馆');
      await expect(search).toBeFocused();
      await expect(search).toHaveAttribute('aria-activedescendant', selected!);
      await expect(page.locator('.map-search-result')).toHaveCount(1);
      expect(await page.evaluate(() => {
        const renderer = (window as unknown as CityWindow)._mini.renderer as WebGLRenderer;
        return renderer.getContext().isContextLost();
      })).toBe(false);
    }
    expect(errors).toEqual([]);
  });
}
