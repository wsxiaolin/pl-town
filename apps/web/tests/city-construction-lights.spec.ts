import { expect, test } from '@playwright/test';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import { stubCityWebSocket, waitForCityReady } from './helpers';

// Self-contained fixture at the current catalog's full 88-plot capacity.
const AREA_PLOTS = Array.from({ length: 88 }, (_, index) => ({
  id: `plot-${index}`, name: `地块 ${index + 1}`, x: -40 + (index % 11) * 8,
  z: -35 + Math.floor(index / 11) * 10, options: ['lamp', 'flowers'],
}));

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
    personalPlots: AREA_PLOTS,
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
    let activeLights = 0, totalLights = 0, globes = 0, illuminatedGlobes = 0;
    root?.traverseVisible((object: any) => {
      if (object.isPointLight) { totalLights++; if (object.intensity > 0) activeLights++; }
      if (object.isMesh && object.material?.emissive?.getHex() === 0xffd9a1) {
        globes++;
        if (object.material.emissiveIntensity === 0.9) illuminatedGlobes++;
      }
    });
    return {
      lamps: root?.children.filter((child: any) => child.isGroup).length ?? 0, activeLights, totalLights, globes, illuminatedGlobes,
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
    expect(scene).toMatchObject({ lamps: 88, totalLights: 8, globes: 88, illuminatedGlobes: night ? 88 : 0, contextLost: false, contextLosses: 0 });
    // Verify the renderer keeps producing frames across dusk/day transitions.
    await expect.poll(async () => (await inspect()).frame).toBeGreaterThan(scene.frame);
    expect((await inspect()).contextLost).toBe(false);
  }
  // Moving to opposite sides must retarget the pool to the closest lamps.
  for (const x of [-40, 40]) {
    await page.evaluate((x) => (window as any)._mini.player.position.set(x, 0, -35), x);
    await expect.poll(() => page.evaluate(() => {
      const mini = (window as any)._mini;
      const root = mini.scene.getObjectByName('city-construction');
      const lamps = root.children.filter((child: any) => child.isGroup)
        .sort((a: any, b: any) => a.position.distanceToSquared(mini.player.position) - b.position.distanceToSquared(mini.player.position))
        .slice(0, 8).map((child: any) => `${child.position.x}:${child.position.z}`).sort();
      const lit = root.children.filter((child: any) => child.isPointLight && child.intensity > 0)
        .map((child: any) => `${child.position.x}:${child.position.z}`).sort();
      return JSON.stringify(lamps) === JSON.stringify(lit);
    })).toBe(true);
  }
  await expect(page.locator('#c')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }]) {
  test(`88 flower beds share resources and bound draw calls at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const config: CityConfig = {
      schemaVersion: 1, version: 'flower-budget-test', projects: [], personalPlots: AREA_PLOTS,
      decorations: [{ id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 }],
      initialBuiltBuildingIds: ['commons', 'commons_outer'],
    };
    const state: CityState = {
      epoch: 'flower-budget-test', revision: 1, configVersion: config.version, projects: [],
      decorations: AREA_PLOTS.map((plot) => ({ plotId: plot.id, decorationId: 'flowers', ownerId: 'flower-tester', ownerNickname: 'flower-tester' })),
    };
    stubCityWebSocket(page, { user: 'flower-tester', unlockedBuildings: ['commons'] });
    await page.route('**/town-api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/city/config')) return route.fulfill({ status: 200, json: config });
      if (path.endsWith('/city/state')) return route.fulfill({ status: 200, json: state });
      if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    await waitForCityReady(page, 'flower-tester');
    const metrics = await page.evaluate(() => {
      const mini = (window as any)._mini;
      const root = mini.scene.getObjectByName('city-construction');
      const geometryIds = new Set(), materialIds = new Set();
      let meshes = 0;
      root.traverse((object: any) => {
        if (!object.isMesh) return;
        meshes++; geometryIds.add(object.geometry.uuid); materialIds.add(object.material.uuid);
      });
      // Render just the construction geometry with the existing renderer: no
      // extra WebGL context, and a far camera that includes the entire area.
      const visibility = mini.scene.children.map((child: any) => [child, child.visible]);
      const shadows = mini.renderer.shadowMap.enabled;
      const autoReset = mini.renderer.info.autoReset;
      const camera = mini.camera.clone();
      camera.left = camera.bottom = -50; camera.right = camera.top = 50;
      camera.zoom = 1; camera.position.set(0, 80, 0); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
      let calls = 0;
      try {
        for (const [child] of visibility) child.visible = child === root || Boolean(child.isLight);
        mini.renderer.shadowMap.enabled = false;
        mini.renderer.info.autoReset = true;
        mini.renderer.render(mini.scene, camera);
        calls = mini.renderer.info.render.calls;
      } finally {
        for (const [child, visible] of visibility) child.visible = visible;
        mini.renderer.shadowMap.enabled = shadows;
        mini.renderer.info.autoReset = autoReset;
      }
      return { meshes, geometries: geometryIds.size, materials: materialIds.size, calls,
        frame: mini.renderer.info.render.frame, contextLost: mini.renderer.getContext().isContextLost() };
    });
    expect(metrics).toMatchObject({ meshes: 88, geometries: 1, materials: 1, contextLost: false });
    // One call per bed, plus the renderer's optional scene background pass.
    expect(metrics.calls).toBeGreaterThanOrEqual(88);
    expect(metrics.calls).toBeLessThanOrEqual(89);
    await expect.poll(() => page.evaluate(() => (window as any)._mini.renderer.info.render.frame)).toBeGreaterThan(metrics.frame);
    await expect(page.locator('#c')).toBeVisible();
    expect(errors).toEqual([]);
  });
}
