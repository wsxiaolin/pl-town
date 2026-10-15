import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { seedCityStorage, stubCityWebSocket } from './helpers';

// Vulkan stalls on this container's software GPU; use ANGLE's GL SwiftShader.
test.use({ launchOptions: { args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--no-sandbox',
] } });

for (const viewport of [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 844, height: 390 },
]) {
  test(`terrain rebuild ${viewport.name}: city, river and mountain camera sweep`, async ({ page }, testInfo) => {
    test.setTimeout(480_000);
    console.log(`terrain ${viewport.name}: browser ready`);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    stubCityWebSocket(page);
    await seedCityStorage(page, 'terrain-review');
    // Town time advances one game hour per real minute; :12 maps to noon.
    await page.clock.setFixedTime(new Date('2026-10-15T12:12:00+08:00'));
    await page.goto('/?dev=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.getElementById('bootScreen')?.dataset.momentSkipBound === 'true', undefined, { timeout: 120_000 });
    await page.locator('#bootSkipButton').evaluate((button: HTMLElement) => button.click());
    await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 120_000 });
    await page.waitForFunction(() => Boolean((window as any)._mini?.player));
    await expect(page.locator('#landscapeRequired')).toBeHidden();
    await expect(page.locator('body')).toHaveClass(/day/);
    console.log(`terrain ${viewport.name}: city booted`);

    const inventory = await page.evaluate(() => {
      const mini = (window as any)._mini;
      const scene = mini.scene;
      const lod = scene.getObjectByName('lanping-continuous-alpine-range');
      const nearCamera = mini.camera.clone();
      nearCamera.position.copy(lod.position).add(new mini.THREE.Vector3(0, 60, 0));
      nearCamera.updateMatrixWorld();
      lod.update(nearCamera);
      const near = lod.levels.map((level: any) => level.object.visible);
      nearCamera.position.y = 600;
      nearCamera.updateMatrixWorld();
      lod.update(nearCamera);
      const far = lod.levels.map((level: any) => level.object.visible);
      lod.update(mini.camera);
      let rivers = 0;
      let legacyMassifs = 0;
      scene.traverse((node: any) => {
        if (node.name === 'river-chenxi-water' || node.name === 'river-chenxi-estuary') rivers++;
        if (node.name.includes(':massif')) legacyMassifs++;
      });
      const district = scene.getObjectByName('city-district-ground');
      const heights = district.geometry.getAttribute('position');
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < heights.count; i++) {
        min = Math.min(min, heights.getY(i));
        max = Math.max(max, heights.getY(i));
      }
      const surfaces = scene.children.filter((node: any) => node.isMesh && node.renderOrder > 0 && node.renderOrder <= 6);
      const groundMaterials = surfaces.flatMap((node: any) => Array.isArray(node.material) ? node.material : [node.material]);
      return {
        lod: lod.isLOD,
        levels: lod.levels.map((level: any) => ({ distance: level.distance, mesh: level.object.isMesh, vertices: level.object.geometry.getAttribute('position').count })),
        near, far, rivers, legacyMassifs, min, max,
        opaqueGroundWritesDepth: groundMaterials.filter((material: any) => material.userData.citySurface).every((material: any) => material.depthWrite),
      };
    });
    expect(inventory.lod).toBe(true);
    expect(inventory.levels.map(level => level.distance)).toEqual([0, 480]);
    expect(inventory.levels.every(level => level.mesh && level.vertices > 0)).toBe(true);
    expect(inventory.levels[0]!.vertices).toBeGreaterThan(inventory.levels[1]!.vertices);
    expect(inventory.near).toEqual([true, false]);
    expect(inventory.far).toEqual([false, true]);
    expect(inventory.rivers).toBe(1);
    expect(inventory.legacyMassifs).toBe(0);
    expect(inventory.min).toBeGreaterThanOrEqual(0.004);
    expect(inventory.max).toBeLessThanOrEqual(0.022001);
    expect(inventory.opaqueGroundWritesDepth).toBe(true);

    // Static ray coverage isolates ground ownership from animated water/NPCs.
    const coverage = await page.evaluate(() => {
      const mini = (window as any)._mini;
      const ground = mini.scene.getObjectByName('world-far-ground');
      const lod = mini.scene.getObjectByName('lanping-continuous-alpine-range');
      mini.scene.updateMatrixWorld(true);
      const box = new mini.THREE.Box3().setFromObject(lod.levels[0].object);
      const ray = new mini.THREE.Raycaster();
      const results: number[] = [];
      for (const [x, z] of [
        [box.min.x - 0.1, -180], [box.min.x + 0.1, -180],
        [box.max.x - 0.1, -180], [box.max.x + 0.1, -180],
        [0, box.min.z - 0.1], [0, box.min.z + 0.1],
        [0, box.max.z - 0.1], [0, box.max.z + 0.1],
      ]) {
        ray.set(new mini.THREE.Vector3(x, 100, z), new mini.THREE.Vector3(0, -1, 0));
        const hits = ray.intersectObjects([ground, lod.levels[0].object], false);
        // A ray on a grid diagonal can hit both triangles of the same mesh.
        results.push(new Set(hits.map((hit: any) => hit.object.uuid)).size);
      }
      return { results, vertexColors: ground.material.vertexColors, depthWrite: ground.material.depthWrite };
    });
    expect(coverage.results, 'one static terrain owner on either side of every alpine edge').toEqual(Array(8).fill(1));
    expect(coverage.vertexColors).toBe(true);
    expect(coverage.depthWrite).toBe(true);

    for (const shot of [
      { name: 'city-near', x: 0, z: 0, zoom: 21 },
      { name: 'city-far', x: 0, z: -28, zoom: 85 },
      { name: 'river', x: -20, z: -99, zoom: 65 },
      { name: 'mountain', x: 45, z: -180, zoom: 170 },
      { name: 'city-river-mountain', x: 0, z: -65, zoom: 155 },
    ]) {
      await page.evaluate(({ x, z, zoom }) => (window as any)._mini.focus(x, z, zoom), shot);
      // Focus snaps the target; wait for actual rendered frames before readback.
      await page.evaluate(() => new Promise<void>(resolve => {
        let frames = 0;
        const tick = () => { if (++frames >= 3) resolve(); else requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
      }));
      const state = await page.evaluate(() => {
        const mini = (window as any)._mini;
        return { lost: mini.renderer.getContext().isContextLost(), calls: mini.renderer.info.render.calls };
      });
      expect(state.lost).toBe(false);
      expect(state.calls).toBeGreaterThan(0);
      const file = testInfo.outputPath(`${viewport.name}-${shot.name}.png`);
      const buffer = await page.locator('#c').screenshot({ path: file, timeout: 30_000 });
      const image = PNG.sync.read(buffer);
      const colors = new Set<number>();
      for (let i = 0; i < image.data.length; i += 64) {
        colors.add((image.data[i]! << 16) | (image.data[i + 1]! << 8) | image.data[i + 2]!);
      }
      expect(colors.size, `${shot.name} must contain a rendered scene`).toBeGreaterThan(100);
      await testInfo.attach(`${viewport.name}-${shot.name}`, { path: file, contentType: 'image/png' });
      console.log(`terrain screenshot: ${file}`);
    }

    // The follow loop resets the camera every frame. Apply the hero pose at
    // render time through the exposed mini renderer, after that camera update.
    await page.evaluate(() => {
      const mini = (window as any)._mini;
      mini.focus(35, -155, 130);
      const render = mini.renderer.render;
      mini.renderer.render = function(scene: any, camera: any) {
        if (scene === mini.scene && camera === mini.camera) {
          camera.position.set(35, 100, 65);
          camera.lookAt(35, 35, -190);
          camera.updateMatrixWorld(true);
        }
        return render.call(this, scene, camera);
      };
    });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const heroFile = testInfo.outputPath(`${viewport.name}-terrain-hero.png`);
    await page.locator('#c').screenshot({ path: heroFile, timeout: 30_000 });
    await testInfo.attach(`${viewport.name}-terrain-hero`, { path: heroFile, contentType: 'image/png' });
    expect(errors).toEqual([]);
  });
}
