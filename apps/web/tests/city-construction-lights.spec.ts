import { expect, test } from '@playwright/test';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import { stubCityWebSocket, waitForCityReady } from './helpers';

// Server integration verifies this isolated fixture against every production plot.
import AREA_PLOTS from './fixtures/city-area-plots.json' with { type: 'json' };

test('constructed decorations use the city weather materials across creation and weather changes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/(?:WebGL.*(?:error|lost|INVALID)|shader error|VALIDATE_STATUS|GL_INVALID)/i.test(message.text())) errors.push(message.text());
  });
  const kinds = ['flowers', 'oak', 'pine', 'cherry', 'bench', 'lamp'] as const;
  const config: CityConfig = {
    schemaVersion: 1, version: 'construction-weather',
    projects: [{ id: 'weather-path', name: '公共绿道', description: '公共道路', kind: 'road', cost: 800, road: { x: 22, z: -40, width: 8, depth: 1 } }],
    personalPlots: AREA_PLOTS.slice(0, kinds.length),
    decorations: kinds.map((kind) => ({ id: kind, name: kind, kind, cost: 80 })),
    initialBuiltBuildingIds: ['commons'],
  };
  let state: CityState = { epoch: 'construction-weather', revision: 0, configVersion: config.version,
    projects: [{ id: 'weather-path', funded: 0, built: false }], decorations: [] };
  stubCityWebSocket(page, { user: 'weather-builder', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
    return route.continue();
  });
  await waitForCityReady(page, 'weather-builder');
  const inspect = () => page.evaluate(() => {
    const mini = (window as any)._mini;
    const materials = new Map<string, { uuid: string; color: number; baseColor: number; roughness: number; metalness: number }>();
    mini.scene.getObjectByName('city-construction').traverse((object: any) => {
      if (!object.isMesh) return;
      const material = object.material;
      materials.set(material.uuid, { uuid: material.uuid, color: material.color.getHex(),
        baseColor: material.userData.weatherBaseColor?.getHex() ?? -1,
        roughness: material.roughness, metalness: material.metalness });
    });
    return { materials: [...materials.values()], contextLost: mini.renderer.getContext().isContextLost(), frame: mini.renderer.info.render.frame };
  });
  const publish = () => page.evaluate(async (next) => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    const client = await import(modulePath) as typeof import('../src/city/cityGovernanceClient');
    client.applyCityState(next);
  }, state);

  await page.evaluate(() => (window as any)._mini.weather.set('rain'));
  state = { ...state, revision: 1, decorations: [{ plotId: AREA_PLOTS[0]!.id, decorationId: 'flowers', ownerId: 'weather-builder', ownerNickname: 'weather-builder' }] };
  await publish();
  const rainy = await inspect();
  expect(rainy.materials).toHaveLength(1);
  expect(rainy.materials[0]!.roughness).toBeLessThanOrEqual(0.48);
  expect(rainy.materials[0]!.metalness).toBeGreaterThanOrEqual(0.08);

  await page.evaluate(() => (window as any)._mini.weather.set('snow'));
  state = { ...state, revision: 2, projects: [{ id: 'weather-path', funded: 800, built: true }],
    decorations: kinds.map((kind, index) => ({ plotId: AREA_PLOTS[index]!.id, decorationId: kind, ownerId: 'weather-builder', ownerNickname: 'weather-builder' })) };
  await publish();
  const snowy = await inspect();
  expect(snowy.materials).toHaveLength(3);
  expect(snowy.materials.map(({ uuid }) => uuid)).toContain(rainy.materials[0]!.uuid);
  for (const material of snowy.materials) {
    expect(material.roughness).toBeGreaterThanOrEqual(0.86);
    expect(material.baseColor).not.toBe(-1);
    expect(material.color).not.toBe(material.baseColor);
  }
  await page.evaluate(() => (window as any)._mini.weather.set('clear'));
  const clear = await inspect();
  expect(clear.materials.map(({ uuid }) => uuid).sort()).toEqual(snowy.materials.map(({ uuid }) => uuid).sort());
  for (const material of clear.materials) {
    expect(material.roughness).toBeCloseTo(0.85);
    expect(material.metalness).toBe(0);
    expect(material.color).toBe(material.baseColor);
  }
  expect(clear.contextLost).toBe(false);
  await expect.poll(async () => (await inspect()).frame).toBeGreaterThan(clear.frame);
  expect(errors).toEqual([]);
});

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
    let activeLights = 0, totalLights = 0, globes = 0, illuminatedGlobes = 0, meshes = 0;
    root?.traverseVisible((object: any) => {
      if (object.isPointLight) { totalLights++; if (object.intensity > 0) activeLights++; }
      if (object.isMesh) meshes++;
      if (object.isMesh && object.material?.emissive?.getHex() === 0xffd9a1) {
        globes++;
        if (object.material.emissiveIntensity === 0.9) illuminatedGlobes++;
      }
    });
    return {
      lamps: root?.children.filter((child: any) => child.isGroup).length ?? 0, activeLights, totalLights, globes, illuminatedGlobes, meshes,
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
    expect(scene).toMatchObject({ lamps: 88, meshes: 176, totalLights: 8, globes: 88, illuminatedGlobes: night ? 88 : 0, contextLost: false, contextLosses: 0 });
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
  for (const kind of ['flowers', 'oak', 'pine', 'cherry', 'bench'] as const) {
    test(`88 ${kind} decorations share resources and bound draw calls at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (/(?:WebGL.*(?:error|lost|INVALID)|shader error|VALIDATE_STATUS|GL_INVALID)/i.test(message.text())) errors.push(message.text());
      });
      const config: CityConfig = {
        schemaVersion: 1, version: `${kind}-budget-test`, projects: [], personalPlots: AREA_PLOTS,
        decorations: [{ id: kind, name: kind, kind, cost: 80 }],
        initialBuiltBuildingIds: ['commons', 'commons_outer'],
      };
      const state: CityState = {
        epoch: `${kind}-budget-test`, revision: 1, configVersion: config.version, projects: [],
        decorations: AREA_PLOTS.map((plot) => ({ plotId: plot.id, decorationId: kind, ownerId: 'decoration-tester', ownerNickname: 'decoration-tester' })),
      };
      stubCityWebSocket(page, { user: 'decoration-tester', unlockedBuildings: ['commons'] });
      await page.route('**/town-api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path.endsWith('/city/config')) return route.fulfill({ status: 200, json: config });
        if (path.endsWith('/city/state')) return route.fulfill({ status: 200, json: state });
        if (path.endsWith('/telemetry/event')) return route.fulfill({ status: 204, body: '' });
        return route.continue();
      });
      await waitForCityReady(page, 'decoration-tester');
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
      // One call per decoration, plus the renderer's optional scene background pass.
      expect(metrics.calls).toBeGreaterThanOrEqual(88);
      expect(metrics.calls).toBeLessThanOrEqual(89);
      if (kind === 'oak') {
        const overview = await page.evaluate(() => {
          const mini = (window as any)._mini;
          const camera = mini.camera.clone();
          const aspect = mini.renderer.domElement.width / mini.renderer.domElement.height;
          camera.left = -65 * aspect; camera.right = 65 * aspect;
          camera.top = 65; camera.bottom = -65; camera.zoom = 1;
          camera.near = 0.1; camera.far = 500;
          camera.position.set(65, 90, 65); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
          mini.renderer.render(mini.scene, camera);
          return mini.renderer.domElement.toDataURL('image/png');
        });
        await testInfo.attach('real-area-far-view', { body: Buffer.from(overview.split(',')[1]!, 'base64'), contentType: 'image/png' });
      }
      await expect.poll(() => page.evaluate(() => (window as any)._mini.renderer.info.render.frame)).toBeGreaterThan(metrics.frame);
      await expect(page.locator('#c')).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
}
