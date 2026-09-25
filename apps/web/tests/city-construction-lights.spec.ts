import { expect, test } from '@playwright/test';
import { AREA_PLOTS, PERSONAL_AREAS } from '../../server/src/data/cityConstructionAreas';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import { stubCityWebSocket, waitForCityReady } from './helpers';

test('88 constructed lamps keep their globes and a bounded night light budget', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/(?:WebGL.*(?:error|lost|INVALID)|shader error|VALIDATE_STATUS|GL_INVALID)/i.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(() => {
    (window as any).__constructionContextLosses = 0;
    document.addEventListener('webglcontextlost', () => { (window as any).__constructionContextLosses++; }, true);
  });
  // The town clock maps one real minute to one game hour. Fixed Date time
  // leaves real animation frames and the clock synchronization interval running.
  const midnight = new Date('2026-09-25T00:00:00Z').getTime();
  await page.clock.setFixedTime(new Date(midnight + 21 * 60_000));
  const config: CityConfig = {
    schemaVersion: 1, version: 'lamp-budget-test', projects: [],
    personalAreas: PERSONAL_AREAS, personalPlots: AREA_PLOTS,
    decorations: [{ id: 'lamp', name: '路灯', kind: 'lamp', cost: 120 }],
    initialBuiltBuildingIds: ['commons', 'commons_outer'],
  };
  const state: CityState = {
    epoch: 'lamp-budget-test', revision: 1, configVersion: config.version, projects: [],
    decorations: AREA_PLOTS.map((plot) => ({ plotId: plot.id, decorationId: 'lamp', ownerId: 'lamp-tester', ownerNickname: 'lamp-tester' })),
  };
  stubCityWebSocket(page, { user: 'lamp-tester', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ status: 200, json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ status: 200, json: state });
    if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
    return route.continue();
  });
  await waitForCityReady(page, 'lamp-tester');
  const inspect = () => page.evaluate(() => {
    const mini = (window as any)._mini;
    const root = mini.scene.getObjectByName('city-construction');
    let activeLights = 0, globes = 0, illuminatedGlobes = 0;
    root?.traverseVisible((object: any) => {
      if (object.isPointLight) activeLights++;
      if (object.isMesh && object.material?.emissive?.getHex() === 0xffd9a1) {
        globes++;
        if (object.material.emissiveIntensity === 0.9) illuminatedGlobes++;
      }
    });
    return {
      lamps: root?.children.length ?? 0, activeLights, globes, illuminatedGlobes,
      contextLost: mini.renderer.getContext().isContextLost(),
      contextLosses: (window as any).__constructionContextLosses,
      frame: mini.renderer.info.render.frame,
    };
  });
  for (const hour of [21, 12, 21]) {
    await page.clock.setFixedTime(new Date(midnight + hour * 60_000));
    const night = hour === 21;
    await expect.poll(async () => (await inspect()).activeLights).toBe(night ? 8 : 0);
    const scene = await inspect();
    expect(scene).toMatchObject({ lamps: 88, globes: 88, illuminatedGlobes: night ? 88 : 0, contextLost: false, contextLosses: 0 });
    // Verify the real renderer keeps producing frames after each shader change.
    await expect.poll(async () => (await inspect()).frame).toBeGreaterThan(scene.frame);
    expect((await inspect()).contextLost).toBe(false);
  }
  await expect(page.locator('#c')).toBeVisible();
  expect(errors).toEqual([]);
});
