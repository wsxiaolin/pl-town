import { expect, test } from '@playwright/test';

async function enterCity(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    // Keep movement tests deterministic without requiring a live multiplayer socket.
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
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'movement-tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any)._mini?.player));
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/);
  // Let the boot-screen fade settle before interacting (see helpers.waitForCityBooted).
  await page.waitForTimeout(1_000);
}

test('desktop keyboard moves the player while the touch wheel stays hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const before = await page.evaluate(() => (window as any)._mini.player.position.clone().toArray());
  // Under software-GL / parallel load the frame loop advances slower, so a
  // fixed 350ms wait under-shoots the 0.1 threshold (see the touch-tablet test
  // below, which polls for the same reason). Poll until the player actually
  // travels, then confirm the key release stopped it.
  await page.keyboard.down('KeyW');
  await expect.poll(async () => {
    const pos = await page.evaluate(() => (window as any)._mini.player.position.clone().toArray());
    return Math.hypot(pos[0] - before[0], pos[2] - before[2]);
  }, { timeout: 5_000, intervals: [100, 200, 300] }).toBeGreaterThan(0.1);
  await page.keyboard.up('KeyW');
  await expect(page.locator('#movementControl')).toBeHidden();
});

test('canvas click keeps automatic movement and produces a collision-safe route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const result = await page.evaluate(() => {
    const mini = (window as any)._mini;
    const point = new mini.THREE.Vector3(0, 0, -20).project(mini.camera);
    const target = { x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2 };
    document.querySelector('#c')!.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: target.x, clientY: target.y }));
    const path = mini.getPlayerPath();
    return { length: path.length, safe: path.every((waypoint: { x: number; z: number }) => !mini.navigation.pointInAnyBuilding(waypoint.x, waypoint.z)) };
  });
  expect(result.length).toBeGreaterThan(0);
  expect(result.safe).toBe(true);
});

test('long press drags the camera, suppresses walking, and returns after three idle seconds', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const before = await page.evaluate(() => ({
    camera: (window as any)._mini.camera.position.clone().toArray(),
    player: (window as any)._mini.player.position.clone().toArray(),
  }));

  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.waitForTimeout(500);
  await page.mouse.move(760, 430, { steps: 4 });
  await page.mouse.up();

  await expect.poll(async () => page.evaluate((initial) => {
    const mini = (window as any)._mini;
    return Math.hypot(mini.camera.position.x - initial[0], mini.camera.position.z - initial[2]);
  }, before.camera), { timeout: 2_000, intervals: [50, 100] }).toBeGreaterThan(1);
  const afterDrag = await page.evaluate(() => ({
    camera: (window as any)._mini.camera.position.clone().toArray(),
    player: (window as any)._mini.player.position.clone().toArray(),
    pathLength: (window as any)._mini.getPlayerPath().length,
  }));
  expect(afterDrag.player).toEqual(before.player);
  expect(afterDrag.pathLength).toBe(0);

  await expect.poll(async () => page.evaluate((initial) => {
    const camera = (window as any)._mini.camera.position;
    return Math.hypot(camera.x - initial[0], camera.z - initial[2]);
  }, before.camera), { timeout: 6_000, intervals: [200, 300] }).toBeLessThan(0.1);
});

test('canvas click marks the selected route target with expanding orange pulses', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const initial = await page.evaluate(() => {
    const mini = (window as any)._mini;
    const world = new mini.THREE.Vector3(0, 0, -20);
    const point = world.clone().project(mini.camera);
    const event = new MouseEvent('click', {
      bubbles: true,
      clientX: (point.x + 1) * innerWidth / 2,
      clientY: (1 - point.y) * innerHeight / 2,
    });
    document.querySelector('#c')!.dispatchEvent(event);
    const raycaster = new mini.THREE.Raycaster();
    raycaster.setFromCamera(new mini.THREE.Vector2(
      event.clientX / innerWidth * 2 - 1,
      -(event.clientY / innerHeight) * 2 + 1,
    ), mini.camera);
    const expectedPosition = new mini.THREE.Vector3();
    raycaster.ray.intersectPlane(
      new mini.THREE.Plane(new mini.THREE.Vector3(0, 1, 0), 0),
      expectedPosition,
    );
    const marker = mini.scene.getObjectByName('navigation-target-marker');
    const pulse = marker?.getObjectByName('navigation-target-pulse-1');
    const octahedron = marker?.getObjectByName('navigation-target-octahedron');
    return {
      visible: marker?.visible,
      position: marker?.position.toArray(),
      expectedPosition: expectedPosition.toArray(),
      pulseCount: marker?.children.filter((child: any) => child.userData.navigationTargetPulse !== undefined).length,
      pulseOpacity: pulse?.material.opacity,
      pulseScale: pulse?.scale.x,
      octahedronColor: octahedron?.material.color.getHex(),
      octahedronScale: octahedron?.scale.toArray(),
      octahedronRotation: octahedron?.rotation.y,
    };
  });
  expect(initial.visible).toBe(true);
  expect(initial.position?.[0]).toBeCloseTo(initial.expectedPosition[0], 4);
  expect(initial.position?.[1]).toBeCloseTo(initial.expectedPosition[1], 4);
  expect(initial.position?.[2]).toBeCloseTo(initial.expectedPosition[2], 4);
  expect(initial.pulseCount).toBe(3);
  expect(initial.pulseOpacity).toBeCloseTo(0.5, 5);
  expect(initial.pulseScale).toBeCloseTo(1, 5);
  expect(initial.octahedronColor).toBe(0xf28c28);
  expect(initial.octahedronScale).toEqual([1, 1.65, 1]);

  await expect.poll(async () => page.evaluate((start) => {
    const marker = (window as any)._mini.scene.getObjectByName('navigation-target-marker');
    const pulse = marker.getObjectByName('navigation-target-pulse-1');
    const octahedron = marker.getObjectByName('navigation-target-octahedron');
    return pulse.scale.x > start.pulseScale + 0.05
      && pulse.material.opacity < start.pulseOpacity
      && Math.abs(octahedron.rotation.y - start.octahedronRotation) > 0.05;
  }, initial), { timeout: 5_000, intervals: [50, 100, 200] }).toBe(true);
});

test('Wushi restaurant model, dialogue, and Shinian teleport are available', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const model = await page.evaluate(() => {
    const mini = (window as any)._mini;
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

  await page.evaluate(() => (window as any)._mini.interactNpc('shinian_mengyanyu'));
  await expect(page.locator('#npcName')).toHaveText('时年梦烟雨');
  await page.locator('.npc-opt').filter({ hasText: '关于物实饭店？' }).click();
  await page.locator('.npc-opt').filter({ hasText: '我要去！' }).click();
  const distance = await page.evaluate(() => {
    const mini = (window as any)._mini;
    return mini.player.position.distanceTo(new mini.THREE.Vector3(-22.5, 0, -15));
  });
  expect(distance).toBeLessThan(8);
  await page.evaluate(() => (window as any)._mini.openBuildingDialog('wushi_restaurant'));
  await expect(page.locator('#npcName')).toHaveText('物实饭店');
  await expect(page.locator('#npcLine')).toContainText('为什么还会有饭店');
  await page.locator('.npc-opt').filter({ hasText: '认真读小字' }).click();
  await expect(page.locator('#npcLine')).toContainText('生命由您自行负责');
});

test('generated resident houses block manual movement', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const collision = await page.evaluate(() => {
    const mini = (window as any)._mini;
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

test('city renders twelve residence models and the modeled west beach', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const sceneContent = await page.evaluate(() => {
    const mini = (window as any)._mini;
    const styles = new Set<number>();
    const textures = new Set<string>();
    mini.scene.traverse((object: any) => {
      if (typeof object.userData?.residenceStyleId === 'number') styles.add(object.userData.residenceStyleId);
      const map = object.material?.map;
      if (map?.name) textures.add(map.name);
    });
    return {
      styles: [...styles].sort((a, b) => a - b),
      textures: [...textures].sort(),
      beach: Boolean(mini.scene.getObjectByName('west-beach')),
      seaGod: Boolean(mini.scene.getObjectByName('yihang-sea-god')),
      ships: ['bismarck-model', 'hipper-model'].every((name) => Boolean(mini.scene.getObjectByName(name))),
      waterSize: new mini.THREE.Box3().setFromObject(mini.scene.getObjectByName('west-beach')).getSize(new mini.THREE.Vector3()).toArray(),
    };
  });
  expect(sceneContent.styles.every((style) => style >= 0 && style <= 11)).toBe(true);
  expect(sceneContent.styles.length).toBeGreaterThanOrEqual(10);
  expect(sceneContent.styles).toEqual(expect.arrayContaining([10, 11]));
  expect(sceneContent.textures).toEqual(expect.arrayContaining(['residence_plaster', 'residence_wood', 'residence_tile']));
  expect(sceneContent.beach && sceneContent.seaGod && sceneContent.ships).toBe(true);
  expect(sceneContent.waterSize[0]).toBeGreaterThan(55);
  expect(sceneContent.waterSize[2]).toBeGreaterThan(80);
});

test('repeated clicks keep an active automatic route', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const lengths = await page.evaluate(() => {
    const mini = (window as any)._mini;
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
  const before = await page.evaluate(() => (window as any)._mini.player.position.clone().toArray());
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...start, id: 1, radiusX: 2, radiusY: 2 }] });
    await expect(base).toHaveCSS('opacity', '1');
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x + 52, y: start.y, id: 1, radiusX: 2, radiusY: 2 }] });
    // Under software-GL / parallel load the frame loop advances slower, so a
    // fixed 350ms wait under-shoots the 0.3 threshold. Poll for the player to
    // actually travel past it instead of asserting on a single snapshot.
    await expect.poll(async () => {
      const after = await page.evaluate(() => (window as any)._mini.player.position.clone().toArray());
      return Math.hypot(after[0] - before[0], after[2] - before[2]);
    }, { timeout: 5_000, intervals: [100, 200, 300] }).toBeGreaterThan(0.3);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(base).toHaveCSS('opacity', '0');
  });

  test('long touch drags the camera without starting a walking route', async ({ page }) => {
    await enterCity(page);
    const start = await page.evaluate(() => {
      const canvas = document.querySelector('#c');
      for (let y = 220; y < innerHeight - 120; y += 40) {
        for (let x = Math.floor(innerWidth * 0.45); x < innerWidth - 80; x += 40) {
          if (document.elementFromPoint(x, y) === canvas) return { x, y };
        }
      }
      throw new Error('No unobstructed canvas point found');
    });
    const before = await page.evaluate(() => (window as any)._mini.camera.position.clone().toArray());
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart', touchPoints: [{ ...start, id: 1, radiusX: 2, radiusY: 2 }],
    });
    await expect(page.locator('body')).toHaveClass(/camera-pan-active/, { timeout: 2_000 });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: start.x + 90, y: start.y + 24, id: 1, radiusX: 2, radiusY: 2 }],
    });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect.poll(async () => page.evaluate((initial) => {
      const mini = (window as any)._mini;
      return Math.hypot(mini.camera.position.x - initial[0], mini.camera.position.z - initial[2]);
    }, before), { timeout: 2_000, intervals: [50, 100] }).toBeGreaterThan(1);
    await expect(page.locator('body')).not.toHaveClass(/camera-pan-active/);
    expect(await page.evaluate(() => (window as any)._mini.getPlayerPath().length)).toBe(0);
  });

  test('camera keeps the city orientation while approaching Linche', async ({ page }) => {
    await enterCity(page);
    await page.evaluate(() => {
      const mini = (window as any)._mini;
      mini.player.position.set(50, 0, 0);
    });
    await page.waitForTimeout(200);
    const cameraDirection = await page.evaluate(() => {
      const mini = (window as any)._mini;
      return mini.camera.getWorldDirection(new mini.THREE.Vector3()).toArray();
    });
    expect(cameraDirection[0]).toBeLessThan(0);
    expect(cameraDirection[2]).toBeLessThan(0);
  });
});

test('eternal retirement monument shows the memorial roster overlay on the elevator', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  await page.evaluate(() => (window as any)._mini.openBuildingDialog('elevator'));
  const overlay = page.locator('#memorialOverlay');
  await expect(overlay).toHaveClass(/open/);
  await expect(page.locator('#memorialTitle')).toHaveText('物实永退用户纪念碑');
  await expect(page.locator('#memorialSubtitle p').first()).toHaveText('他们曾经是小镇的居民，如今已经离开我们了');
  await expect(page.locator('#memorialSubtitle p').nth(1)).toHaveText('不完全统计数据来自于胡桃');
  await expect(page.locator('#memorialScroll')).toHaveCount(0);
  await expect(page.locator('.memorial-name')).toHaveCount(30);
  await expect(page.locator('#memorialPager')).toHaveText('1 / 4');
  await expect(page.locator('#memorialPrev')).toBeDisabled();
  await page.mouse.click(20, 20);
  await expect(overlay).not.toHaveClass(/open/);
});
