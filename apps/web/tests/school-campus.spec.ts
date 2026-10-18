import { expect, test } from '@playwright/test';
import { seedCityStorage, stubCityWebSocket, stubWorldCatalogWebSocket, waitForCityBooted } from './helpers';

// 学校重建回归：两座学校都必须以「完整校园」的多体量网格出现在各自锚点，
// 而不是退回单体盒子或落到原点。几何断言在页面里做，避免依赖截图。
test('rebuilt school campuses render as multi-volume groups at their anchors', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  stubCityWebSocket(page);
  stubWorldCatalogWebSocket(page);
  await seedCityStorage(page);
  await waitForCityBooted(page);

  const stats = await page.evaluate(() => {
    const mini = (window as any)._mini;
    const result: Record<string, { meshes: number; width: number; depth: number; height: number; minY: number; x: number; z: number }> = {};
    for (const id of ['school_north', 'school_east']) {
      let meshes = 0;
      const box = new mini.THREE.Box3();
      mini.scene.traverse((object: any) => {
        if (object.isMesh && object.userData.buildingId === id) {
          meshes += 1;
          box.expandByObject(object);
        }
      });
      const size = box.getSize(new mini.THREE.Vector3());
      result[id] = {
        meshes,
        width: size.x,
        depth: size.z,
        height: size.y,
        minY: box.min.y,
        x: (box.min.x + box.max.x) / 2,
        z: (box.min.z + box.max.z) / 2,
      };
    }
    return result;
  });

  const north = stats.school_north!;
  const east = stats.school_east!;
  for (const [id, entry, anchor] of [
    ['school_north', north, { x: -22.5, z: 15 }],
    ['school_east', east, { x: 31.5, z: -15.25 }],
  ] as const) {
    expect(entry.meshes, `${id} mesh count`).toBeGreaterThanOrEqual(80);
    expect(entry.width, `${id} width`).toBeGreaterThanOrEqual(7.0);
    expect(entry.width, `${id} width`).toBeLessThanOrEqual(8.2);
    expect(entry.depth, `${id} depth`).toBeGreaterThanOrEqual(3.5);
    expect(entry.depth, `${id} depth`).toBeLessThanOrEqual(4.4);
    expect(entry.height, `${id} height`).toBeGreaterThanOrEqual(2.8);
    expect(entry.minY, `${id} must not sink into the ground`).toBeGreaterThanOrEqual(-0.01);
    expect(Math.abs(entry.x - anchor.x), `${id} x anchor`).toBeLessThanOrEqual(0.35);
    expect(Math.abs(entry.z - anchor.z), `${id} z anchor`).toBeLessThanOrEqual(0.35);
  }

  await expect(page.locator('a.b-label-item[data-building-id="school_north"]')).toHaveCount(1);
  await expect(page.locator('a.b-label-item[data-building-id="school_east"]')).toHaveCount(1);
});
