import { expect, test } from '@playwright/test';
import { FRAME_ADVANCE_TIMEOUT } from './helpers';

// CPU-only runners boot the city through a software-GL shader precompile that
// can eat a minute before `is-ready` even fires — the default 60s test timeout
// is not enough for a boot plus a couple of interactions. 150s covers it with
// headroom on a loaded runner while staying tight enough to fail fast on
// genuine regressions.
test.setTimeout(150_000);

async function enterCity(page: import('@playwright/test').Page, bootTimeout = 90_000) {
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
  // `?dev` is the repo's built-in visual-verification entry: it skips the
  // login/onboarding gate (since #245 a fake session token alone no longer
  // does — the resident-card modal blocks the top bar and steals keyboard
  // focus) and stays offline, which keeps these tests hermetic.
  await page.goto('/?dev');
  await page.waitForFunction(() => Boolean((window as any)._mini?.player), null, { timeout: 60_000 });
  // Software-GL boots spend a long while in shader precompile before the
  // reveal — allow far more than the default 5s here.
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: bootTimeout });
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

  // The crosshair fades in via an opacity transition after the class flip;
  // a stalled soft-GL main thread can hold opacity at 0 past the 5 s default
  // (hard-fail on #267's shard 4). Both assertions ride the same entry path.
  await expect(page.locator('body')).toHaveClass(/first-person-active/, { timeout: FRAME_ADVANCE_TIMEOUT });
  await expect(page.locator('#fpsCrosshair')).toHaveCSS('opacity', '1', { timeout: FRAME_ADVANCE_TIMEOUT });
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

test('first person declutters rooftop labels: near ones win, no screen pile-up', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page, 90_000);

  const sampleLabels = () => page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll<HTMLElement>('.b-label-item'));
    const positioned: Array<{ x: number; y: number }> = [];
    const stray: Array<string> = [];
    for (const el of labels) {
      if (el.style.visibility === 'hidden' || el.hidden) continue;
      const match = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(el.style.transform);
      if (match) positioned.push({ x: Number(match[1]), y: Number(match[2]) });
      else stray.push(el.dataset.buildingId ?? el.textContent?.trim() ?? '?');
    }
    return { positioned, stray };
  });

  // Walk into the street so nearby buildings surround the camera, then sample.
  await page.evaluate(() => (window as any)._mini.firstPerson.enter());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2_500);
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(400);

  const fpLabels = await sampleLabels();
  // Any "visible" label without a screen position would render stacked in the
  // top-left corner — the exact pile-up this feature removes.
  expect(fpLabels.stray, `labels without screen placement: ${fpLabels.stray.join(', ')}`).toEqual([]);
  // The FP street view keeps some labels around but never a whole-city pile:
  // a hard cap plus the pairwise separation invariant (a label box is roughly
  // 84x52 px, so centres closer than that on both axes read as stacked).
  expect(fpLabels.positioned.length).toBeGreaterThan(0);
  expect(fpLabels.positioned.length).toBeLessThanOrEqual(20);
  for (let i = 0; i < fpLabels.positioned.length; i++) {
    for (let j = i + 1; j < fpLabels.positioned.length; j++) {
      const a = fpLabels.positioned[i];
      const b = fpLabels.positioned[j];
      const stacked = Math.abs(a.x - b.x) < 84 && Math.abs(a.y - b.y) < 52;
      expect(stacked, `labels ${i} and ${j} stack on screen: ${JSON.stringify([a, b])}`).toBe(false);
    }
  }

  // Leaving first person lifts the declutter: the overhead projection shows
  // the full set again (more labels than the curated street view).
  await page.evaluate(() => (window as any)._mini.firstPerson.exit());
  await page.waitForTimeout(600);
  const overheadLabels = await sampleLabels();
  expect(overheadLabels.stray).toEqual([]);
  expect(overheadLabels.positioned.length).toBeGreaterThan(fpLabels.positioned.length);
});

test('first person keeps the normal world style (no toon restyle, no extra fog)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterCity(page);
  const before = await page.evaluate(() => {
    const mini = (window as any)._mini;
    let standardMeshes = 0;
    mini.scene.traverse((object: any) => {
      if (object.isMesh && object.material?.isMeshStandardMaterial) standardMeshes += 1;
    });
    return { standardMeshes, fog: Boolean(mini.scene.fog) };
  });
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
      skyDome: Boolean(mini.scene.getObjectByName('toon-sky-dome')),
      toonMeshes,
      standardMeshes,
    };
  });
  expect(during.active).toBe(true);
  // 世界观感不变：无手绘天穹、无 toon 材质替换、材质保持 standard。
  expect(during.skyDome).toBe(false);
  expect(during.toonMeshes).toBe(0);
  expect(during.standardMeshes).toBe(before.standardMeshes);

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
    return { skyDome: Boolean(mini.scene.getObjectByName('toon-sky-dome')), toonMeshes, standardMeshes };
  });
  expect(after.skyDome).toBe(false);
  expect(after.toonMeshes).toBe(0);
  expect(after.standardMeshes).toBe(before.standardMeshes);
});
