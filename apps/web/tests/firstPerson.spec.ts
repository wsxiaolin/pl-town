import { expect, test } from '@playwright/test';

async function enterCity(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    // Keep the walk-mode tests deterministic without a live multiplayer socket.
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
    localStorage.setItem('minicityUser', 'walk-tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any)._mini?.player));
  // Software-GL boots spend a long while in shader precompile before the
  // reveal — allow far more than the default 5s here.
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 30_000 });
  // Let the boot-screen fade settle before interacting (see helpers.waitForCityBooted).
  await page.waitForTimeout(1_000);
}

test('the top-bar toggle enters first person: perspective camera, hidden avatar, crosshair', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const before = await page.evaluate(() => {
    const mini = (window as any)._mini;
    return { visible: mini.player.visible, active: Boolean(mini.firstPerson?.isActive()) };
  });
  expect(before.visible).toBe(true);
  expect(before.active).toBe(false);

  await page.locator('#walkToggle').click({ force: true });

  await expect(page.locator('body')).toHaveClass(/first-person-active/);
  await expect(page.locator('#fpsCrosshair')).toHaveCSS('opacity', '1');
  const entered = await page.evaluate(() => {
    const mini = (window as any)._mini;
    const camera = mini.firstPerson?.getActiveCamera?.() as { isPerspectiveCamera?: boolean } | null;
    return { active: Boolean(mini.firstPerson?.isActive()), avatarVisible: mini.player.visible, perspective: Boolean(camera?.isPerspectiveCamera) };
  });
  expect(entered.active).toBe(true);
  expect(entered.avatarVisible).toBe(false);
  expect(entered.perspective).toBe(true);
  await expect(page.locator('#walkToggle')).toHaveClass(/active/);

  // While the pointer is locked every click lands on the canvas (standard FPS
  // behavior), so leaving the mode goes through the Esc path: the browser
  // releases the lock and the controller treats that as an exit.
  await page.keyboard.press('Escape');

  await expect(page.locator('body')).not.toHaveClass(/first-person-active/);
  const exited = await page.evaluate(() => {
    const mini = (window as any)._mini;
    return {
      active: Boolean(mini.firstPerson?.isActive()),
      avatarVisible: mini.player.visible,
      perspective: Boolean(mini.firstPerson?.getActiveCamera?.()),
    };
  });
  expect(exited.active).toBe(false);
  expect(exited.avatarVisible).toBe(true);
  expect(exited.perspective).toBe(false);
});

test('WASD walks the player through the city in first person', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  await page.evaluate(() => (window as any)._mini.firstPerson.enter());
  const before = await page.evaluate(() => (window as any)._mini.player.position.clone().toArray());

  await page.keyboard.down('KeyW');
  await expect.poll(async () => {
    const pos = await page.evaluate(() => (window as any)._mini.player.position.clone().toArray());
    return Math.hypot(pos[0] - before[0], pos[2] - before[2]);
  }, { timeout: 5_000, intervals: [100, 200, 300] }).toBeGreaterThan(0.1);
  await page.keyboard.up('KeyW');

  const after = await page.evaluate(() => {
    const mini = (window as any)._mini;
    return {
      position: mini.player.position.clone().toArray(),
      insideBuilding: mini.navigation.pointInAnyBuilding(mini.player.position.x, mini.player.position.z),
    };
  });
  // Walking must respect the shared collision system.
  expect(after.insideBuilding).toBe(false);
});

test('leaving first person restores the overhead follow camera on the player', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  await page.evaluate(() => (window as any)._mini.firstPerson.enter());
  await page.keyboard.down('KeyW');
  await expect.poll(async () => page.evaluate(() => {
    const pos = (window as any)._mini.player.position;
    return Math.hypot(pos.x, pos.z);
  }), { timeout: 5_000, intervals: [100, 200] }).toBeGreaterThan(0.5);
  await page.keyboard.up('KeyW');

  await page.evaluate(() => (window as any)._mini.firstPerson.exit());
  const restored = await page.evaluate(() => {
    const mini = (window as any)._mini;
    const camera = mini.camera;
    return {
      playerVisible: mini.player.visible,
      ortho: Boolean(camera.isOrthographicCamera),
      cameraOnPlayer: Math.hypot(camera.position.x - mini.player.position.x, camera.position.z - mini.player.position.z),
    };
  });
  expect(restored.playerVisible).toBe(true);
  expect(restored.ortho).toBe(true);
  // The overhead camera re-centers on the avatar wherever the walk ended —
  // measured along the ground it always sits at the fixed isometric offset
  // CAMERA_OFFSET (24, 24) in XZ, i.e. ~33.94 units away.
  expect(restored.cameraOnPlayer).toBeGreaterThan(30);
  expect(restored.cameraOnPlayer).toBeLessThan(36);
});

test('first person restyles the city into the cel-shaded toon world and restores it on exit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const before = await page.evaluate(() => {
    const mini = (window as any)._mini;
    let standardMeshes = 0;
    mini.scene.traverse((object: any) => {
      if (object.isMesh && object.material?.isMeshStandardMaterial) standardMeshes += 1;
    });
    return {
      toonActive: Boolean(mini.firstPerson?.worldStyle?.toonActive?.()),
      standardMeshes,
    };
  });
  expect(before.toonActive).toBe(false);
  expect(before.standardMeshes).toBeGreaterThan(50);

  await page.evaluate(() => (window as any)._mini.firstPerson.enter());
  await page.waitForTimeout(300);

  const during = await page.evaluate(() => {
    const mini = (window as any)._mini;
    let toonMeshes = 0;
    let standardMeshes = 0;
    mini.scene.traverse((object: any) => {
      if (object.isMesh && object.material) {
        if (object.material.isMeshToonMaterial) toonMeshes += 1;
        else if (object.material.isMeshStandardMaterial) standardMeshes += 1;
      }
    });
    return {
      active: Boolean(mini.firstPerson?.isActive()),
      toonActive: Boolean(mini.firstPerson?.worldStyle?.toonActive?.()),
      skyActive: Boolean(mini.firstPerson?.worldStyle?.skyActive?.()),
      skyDome: Boolean(mini.scene.getObjectByName('toon-sky-dome')),
      fogged: Boolean(mini.scene.fog),
      toonMeshes,
      standardMeshes,
    };
  });
  expect(during.active).toBe(true);
  expect(during.toonActive).toBe(true);
  expect(during.skyActive).toBe(true);
  expect(during.skyDome).toBe(true);
  expect(during.fogged).toBe(true);
  expect(during.toonMeshes).toBeGreaterThan(50);
  expect(during.standardMeshes).toBe(0);

  await page.evaluate(() => (window as any)._mini.firstPerson.exit());

  const after = await page.evaluate(() => {
    const mini = (window as any)._mini;
    let standardMeshes = 0;
    let toonMeshes = 0;
    mini.scene.traverse((object: any) => {
      if (object.isMesh && object.material) {
        if (object.material.isMeshToonMaterial) toonMeshes += 1;
        else if (object.material.isMeshStandardMaterial) standardMeshes += 1;
      }
    });
    return {
      toonActive: Boolean(mini.firstPerson?.worldStyle?.toonActive?.()),
      skyDome: Boolean(mini.scene.getObjectByName('toon-sky-dome')),
      fogged: Boolean(mini.scene.fog),
      toonMeshes,
      standardMeshes,
    };
  });
  expect(after.toonActive).toBe(false);
  expect(after.skyDome).toBe(false);
  // 退出后基础场景雾（weatherEffect 启动时创建）应被还原，而非被抹成
  // null——否则后续雨/雪雾永久丢失（曾为此审查 BLOCKER，此断言为修复固化）。
  expect(after.fogged).toBe(true);
  expect(after.toonMeshes).toBe(0);
  expect(after.standardMeshes).toBeGreaterThan(50);
});
