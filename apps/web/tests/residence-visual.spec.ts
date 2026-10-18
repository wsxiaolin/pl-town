import { expect, test, type Page } from '@playwright/test';
import { seedCityStorage, waitForCityBooted } from './helpers';

// Smoke coverage for the expanded residence catalog: every lot must carry real
// geometry, the printed window-reflection glass, the facade/prop feature tags,
// and no transparent residence materials (which would escape static batching).
async function enterCity(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    class OfflineWebSocket extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readyState = OfflineWebSocket.CONNECTING;
      constructor() {
        super();
        queueMicrotask(() => {
          this.readyState = OfflineWebSocket.OPEN;
          this.dispatchEvent(new Event('open'));
        });
      }
      send() {}
      close() {
        this.readyState = OfflineWebSocket.CLOSED;
        this.dispatchEvent(new Event('close'));
      }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: OfflineWebSocket });
  });
  await seedCityStorage(page, 'residence-visual-tester');
  await waitForCityBooted(page);
  return errors;
}

test('residence lots render the detailed catalog with facade and yard dressing', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const errors = await enterCity(page);

  const snapshot = await page.evaluate(() => {
    const mini = (window as any)._mini;
    const styles = new Set<number>();
    const features = new Set<string>();
    const yardProps = new Set<string>();
    const textures = new Set<string>();
    let houses = 0;
    let minMeshes = Number.POSITIVE_INFINITY;
    let transparentMeshes = 0;
    mini.scene.traverse((object: any) => {
      if (typeof object.userData?.residenceStyleId !== 'number') return;
      houses += 1;
      styles.add(object.userData.residenceStyleId);
      for (const feature of object.userData.residenceFeatures ?? []) features.add(feature);
      for (const prop of object.userData.residenceYardProps ?? []) yardProps.add(prop);
      for (const texture of object.userData.residenceTextures ?? []) textures.add(texture);
      let meshes = 0;
      object.traverse((child: any) => {
        if (!child.isMesh) return;
        meshes += 1;
        if (child.material?.transparent === true) transparentMeshes += 1;
      });
      minMeshes = Math.min(minMeshes, meshes);
    });
    return {
      houses,
      styles: [...styles],
      features: [...features],
      yardProps: [...yardProps],
      textures: [...textures],
      minMeshes: Number.isFinite(minMeshes) ? minMeshes : 0,
      transparentMeshes,
    };
  });

  expect(snapshot.houses).toBeGreaterThan(100);
  expect(snapshot.styles.length).toBeGreaterThanOrEqual(24);
  expect(snapshot.styles.every((style) => style >= 0 && style < 64)).toBe(true);

  // New printed reflection plus the family wall textures.
  expect(snapshot.textures).toEqual(
    expect.arrayContaining(['window_reflection', 'residence_plaster', 'residence_wood', 'residence_tile']),
  );

  // Every detail family added by this PR must appear somewhere in the city.
  expect(snapshot.features).toEqual(
    expect.arrayContaining([
      'windows',
      'window-reflection',
      'shutters',
      'flower-box',
      'doors',
      'transom',
      'canopy',
      'gable-roof',
      'hip-roof',
      'chimney',
      'gutter',
      'downspouts',
      'balcony',
      'awning',
      'dormer',
      'porch',
      'quoins',
      'cornice',
      'wainscot',
    ]),
  );

  // Courtyard/yard dressing variants must all occur across the catalog.
  expect(snapshot.yardProps).toEqual(
    expect.arrayContaining(['doghouse', 'bicycle', 'birdbath', 'trellis', 'laundry', 'well', 'vegetable-rows']),
  );

  // A detailed lot must still own dozens of meshes after instancing keeps the
  // hidden source meshes in the hierarchy.
  expect(snapshot.minMeshes).toBeGreaterThan(40);

  // Transparent materials escape the retained static batcher, so residences
  // intentionally keep every pane opaque.
  expect(snapshot.transparentMeshes).toBe(0);
  expect(errors).toEqual([]);
});
