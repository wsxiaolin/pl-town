import { expect, test } from '@playwright/test';
import { seedCityStorage, waitForCityBooted } from './helpers';

function readActivityStateInPage() {
  const mini = (window as any).__mini();
  let root: any = null;
  (mini as any).scene.traverse((object: any) => {
    if (root) return;
    if (object.isMesh && object.userData?.buildingId === 'activity' && object.geometry?.type !== 'PlaneGeometry') {
      let node = object;
      while (node && node.parent && node.parent !== mini.scene) node = node.parent;
      root = node;
    }
  });
  const hoveredLabels: string[] = [];
  document.querySelectorAll('[class*="hovered"]').forEach((el: any) => hoveredLabels.push(el.textContent?.trim() ?? ''));
  return { groupY: root ? Number(root.position.y.toFixed(3)) : null, hoveredLabels: hoveredLabels.slice(0, 2) };
}

async function readState(page: import('@playwright/test').Page) {
  return page.evaluate(readActivityStateInPage);
}

async function waitForEntranceSettled(page: import('@playwright/test').Page) {
  await expect.poll(() => page.evaluate(readActivityStateInPage).then((s: any) => s.groupY), { timeout: 30_000, intervals: [250, 500, 1000] }).toBe(0);
  await page.waitForTimeout(2_000);
  const settled = await page.evaluate(readActivityStateInPage).then((s: any) => s.groupY);
  expect(settled).toBe(0);
}

test('clicking a building plot keeps it grounded (no hover required)', async ({ page }) => {
  test.setTimeout(90_000);
  await seedCityStorage(page, 'click-lift-tester');
  await waitForCityBooted(page);
  await waitForEntranceSettled(page);

  await page.evaluate(() => {
    const mini = (window as any).__mini();
    mini.player.position.set(4, 0, -7.5);
  });
  await page.mouse.move(10, 700);
  await page.waitForTimeout(300);
  expect((await readState(page)).groupY).toBe(0);

  const point = await page.evaluate(() => {
    const mini = (window as any).__mini();
    const v = new mini.THREE.Vector3(4, 0, -8).project(mini.camera);
    return { cx: (v.x + 1) * innerWidth / 2, cy: (1 - v.y) * innerHeight / 2 };
  });
  const canvas = page.locator('canvas').first();
  await canvas.dispatchEvent('click', {
    clientX: point.cx,
    clientY: point.cy,
    button: 0,
    bubbles: true,
  });

  await expect.poll(() => page.evaluate(readActivityStateInPage).then((s: any) => s.groupY), { timeout: 15_000, intervals: [250, 500] }).toBe(0);
  const after = await readState(page);
  console.log('CLICK-ONLY', JSON.stringify({ point, after }));
  expect(after.groupY).toBe(0);
  expect(after.hoveredLabels).toContain('活动区');
});

test('clicking a building label keeps it grounded', async ({ page }) => {
  test.setTimeout(90_000);
  await seedCityStorage(page, 'label-lift-tester');
  await waitForCityBooted(page);
  await waitForEntranceSettled(page);

  const label = page.locator('.b-label-item[data-building-id="activity"]');
  await expect(label).toHaveCount(1, { timeout: 30_000 });
  await page.mouse.move(10, 700);
  await page.waitForTimeout(300);
  expect((await readState(page)).groupY).toBe(0);
  await label.click();
  await expect.poll(() => page.evaluate(readActivityStateInPage).then((s: any) => s.groupY), { timeout: 15_000, intervals: [250, 500] }).toBe(0);
  const after = await readState(page);
  console.log('LABEL-CLICK', JSON.stringify({ after }));
  expect(after.groupY).toBe(0);
});

test('destroyed buildings persist across reload and can be restored globally', async ({ page }) => {
  test.setTimeout(90_000);
  await seedCityStorage(page, 'damage-persistence-tester');
  await waitForCityBooted(page);
  await waitForEntranceSettled(page);

  const beforeReload = await page.evaluate(() => {
    const result = (window as any).destroyBuilding('library');
    return {
      result,
      stored: JSON.parse(localStorage.getItem('minicityDestroyedBuildings') || '[]'),
      hasGlobalRestore: typeof (window as any).restoreBuilding === 'function',
    };
  });
  expect(beforeReload.result).toBe(true);
  expect(beforeReload.stored).toContain('library');
  expect(beforeReload.hasGlobalRestore).toBe(true);

  await page.reload();
  await waitForCityBooted(page);
  await waitForEntranceSettled(page);
  const afterReload = await page.evaluate(() => {
    const mini = (window as any).__mini();
    let libraryMesh: any = null;
    mini.scene.traverse((object: any) => {
      if (!libraryMesh && object.userData?.buildingId === 'library') libraryMesh = object;
    });
    let group = libraryMesh;
    while (group?.parent && group.parent !== mini.scene) group = group.parent;
    return {
      stored: JSON.parse(localStorage.getItem('minicityDestroyedBuildings') || '[]'),
      damaged: group?.userData?.buildingState === 'damaged',
      rubble: Boolean(group?.getObjectByName('building-destruction-rubble')),
      restored: (window as any).restoreBuilding('library'),
      restoredState: group?.userData?.buildingState,
    };
  });
  expect(afterReload.stored).toContain('library');
  expect(afterReload.damaged).toBe(true);
  expect(afterReload.rubble).toBe(true);
  expect(afterReload.restored).toBe(true);
  expect(afterReload.restoredState).toBe('default');
});
