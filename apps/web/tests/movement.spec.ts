import { expect, test } from '@playwright/test';

async function enterCity(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'movement-tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any).__mini?.().player));
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/);
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

test('Wushi restaurant model, dialogue, and Shinian teleport are available', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const model = await page.evaluate(() => {
    const mini = (window as any).__mini();
    const parts: string[] = [];
    const box = new mini.THREE.Box3();
    mini.scene.traverse((object: any) => {
      if (object.userData?.buildingId !== 'wushi_restaurant') return;
      box.expandByObject(object);
      if (object.userData.restaurantPart) parts.push(object.userData.restaurantPart);
    });
    const size = box.getSize(new mini.THREE.Vector3()).toArray();
    return { parts, size };
  });
  expect(model.parts).toEqual(expect.arrayContaining(['glass-wall', '物实饭店招牌', 'advertisement', 'service-window']));
  expect(model.size[0]).toBeGreaterThan(5);
  expect(model.size[2]).toBeGreaterThan(3.5);

  await page.evaluate(() => (window as any).__mini().interactNpc('shinian_mengyanyu'));
  await expect(page.locator('#npcName')).toHaveText('时年梦烟雨');
  await page.locator('.npc-opt').filter({ hasText: '关于物实饭店？' }).click();
  await page.locator('.npc-opt').filter({ hasText: '我要去！' }).click();
  const distance = await page.evaluate(() => {
    const mini = (window as any).__mini();
    return mini.player.position.distanceTo(new mini.THREE.Vector3(-22.5, 0, -15));
  });
  expect(distance).toBeLessThan(8);
  await page.evaluate(() => (window as any).__mini().openBuildingDialog('wushi_restaurant'));
  await expect(page.locator('#npcName')).toHaveText('物实饭店');
  await expect(page.locator('#npcLine')).toContainText('为什么还会有饭店');
  await page.locator('.npc-opt').filter({ hasText: '认真读小字' }).click();
  await expect(page.locator('#npcLine')).toContainText('生命由您自行负责');
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

test('city renders ten residence models and the modeled west beach', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const sceneContent = await page.evaluate(() => {
    const mini = (window as any).__mini();
    const styles = new Set<number>();
    mini.scene.traverse((object: any) => {
      if (typeof object.userData?.residenceStyleId === 'number') styles.add(object.userData.residenceStyleId);
    });
    return {
      styles: [...styles].sort((a, b) => a - b),
      beach: Boolean(mini.scene.getObjectByName('west-beach')),
      seaGod: Boolean(mini.scene.getObjectByName('yihang-sea-god')),
      ships: ['bismarck-model', 'hipper-model'].every((name) => Boolean(mini.scene.getObjectByName(name))),
      waterSize: new mini.THREE.Box3().setFromObject(mini.scene.getObjectByName('west-beach')).getSize(new mini.THREE.Vector3()).toArray(),
    };
  });
  expect(sceneContent.styles).toEqual([0,1,2,3,4,5,6,7,8,9]);
  expect(sceneContent.beach && sceneContent.seaGod && sceneContent.ships).toBe(true);
  expect(sceneContent.waterSize[0]).toBeGreaterThan(55);
  expect(sceneContent.waterSize[2]).toBeGreaterThan(80);
});

test('repeated clicks keep an active automatic route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const lengths = await page.evaluate(() => {
    const mini = (window as any).__mini();
    const canvas = document.querySelector('#c')!;
    return [
      new mini.THREE.Vector3(0, 0, -20),
      new mini.THREE.Vector3(18, 0, 0),
      new mini.THREE.Vector3(0, 0, 20),
      new mini.THREE.Vector3(-18, 0, 0),
    ].map((world) => {
      const point = world.project(mini.camera);
      canvas.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: (point.x + 1) * innerWidth / 2, clientY: (1 - point.y) * innerHeight / 2 }));
      return mini.getPlayerPath().length;
    });
  });
  expect(lengths.every((length) => length > 0)).toBe(true);
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

  test('camera keeps the city orientation while approaching Linche', async ({ page }) => {
    await enterCity(page);
    await page.evaluate(() => {
      const mini = (window as any).__mini();
      mini.player.position.set(50, 0, 0);
    });
    await page.waitForTimeout(200);
    const cameraDirection = await page.evaluate(() => {
      const mini = (window as any).__mini();
      return mini.camera.getWorldDirection(new mini.THREE.Vector3()).toArray();
    });
    expect(cameraDirection[0]).toBeLessThan(0);
    expect(cameraDirection[2]).toBeLessThan(0);
  });
});
