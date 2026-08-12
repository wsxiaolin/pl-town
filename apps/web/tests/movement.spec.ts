import { expect, test } from '@playwright/test';

async function enterCity(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'movement-tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__mini?.().player));
}

test('desktop keyboard moves the player while the touch wheel stays hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const before = await page.evaluate(() => (window as any).__mini().player.position.clone().toArray());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => (window as any).__mini().player.position.clone().toArray());
  expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(0.1);
  await expect(page.locator('#movementControl')).toBeHidden();
});

test('canvas click keeps automatic movement and produces a collision-safe route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const result = await page.evaluate(() => {
    const mini = (window as any).__mini();
    const point = new mini.THREE.Vector3(0, 0, -20).project(mini.camera);
    const target = { x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2 };
    document.querySelector('#c')!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: target.x, clientY: target.y }));
    const path = mini.getPlayerPath();
    return { length: path.length, safe: path.every((waypoint: { x: number; z: number }) => !mini.navigation.pointInAnyBuilding(waypoint.x, waypoint.z)) };
  });
  expect(result.length).toBeGreaterThan(0);
  expect(result.safe).toBe(true);
});

test('generated resident houses block manual movement', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const collision = await page.evaluate(() => {
    const mini = (window as any).__mini();
    let residence: any = null;
    mini.scene.traverse((object: any) => {
      if (!residence && object.userData?.residenceId) residence = object.parent;
    });
    if (!residence) return null;
    const box = new mini.THREE.Box3().setFromObject(residence);
    const center = box.getCenter(new mini.THREE.Vector3());
    const start = new mini.THREE.Vector3(box.min.x - 1, 0, center.z);
    const target = new mini.THREE.Vector3(box.max.x + 1, 0, center.z);
    const resolved = mini.navigation.resolveMovement(start, target);
    return {
      centerBlocked: mini.navigation.pointInAnyBuilding(center.x, center.z),
      crossed: resolved.x > box.max.x,
    };
  });
  expect(collision).not.toBeNull();
  expect(collision!.centerBlocked).toBe(true);
  expect(collision!.crossed).toBe(false);
});

test.describe('touch-capable tablet', () => {
  test.use({ hasTouch: true, viewport: { width: 1024, height: 768 } });

  test('wheel capture area is available but its graphics wait for interaction', async ({ page }) => {
    await enterCity(page);
    const control = page.locator('#movementControl');
    const base = page.locator('#movementControlBase');
    await expect(control).toBeVisible();
    await expect(base).toHaveCSS('opacity', '0');
    const bounds = await control.boundingBox();
    expect(bounds).not.toBeNull();
    const start = { x: bounds!.x + 86, y: bounds!.y + 110 };
    const before = await page.evaluate(() => (window as any).__mini().player.position.clone().toArray());
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1, radiusX: 2, radiusY: 2 }] });
    await expect(base).toHaveCSS('opacity', '1');
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 52, y: start.y, id: 1, radiusX: 2, radiusY: 2 }] });
    await page.waitForTimeout(350);
    const after = await page.evaluate(() => (window as any).__mini().player.position.clone().toArray());
    expect(Math.hypot(after[0] - before[0], after[2] - before[2])).toBeGreaterThan(0.3);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(base).toHaveCSS('opacity', '0');
  });
});
