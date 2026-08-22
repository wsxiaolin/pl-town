import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { RENDER_SETTINGS, waitForCityBooted } from './helpers';

async function prepareIceWallInventory(page: Page, hasLemonade = true): Promise<void> {
  await page.addInitScript(({ settings, initialHasLemonade }) => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'ice-wall-tester');
    localStorage.setItem('minicityRenderSettings', settings);
    const NativeWebSocket = window.WebSocket;
    class IceWallGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      progress = {
        currency: 0,
        inventory: initialHasLemonade ? { ice_lemonade: 1 } : {},
        achievements: ['citizen'],
        unlockedBuildings: [],
        visitedBuildings: ['catcafe'],
      };
      catalog = { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} };
      constructor() {
        super();
        queueMicrotask(() => {
          this.readyState = NativeWebSocket.OPEN;
          this.dispatchEvent(new Event('open'));
        });
      }
      send(raw: string) {
        const request = JSON.parse(raw);
        let response: Record<string, unknown> | null = null;
        if (request.type === 'hello') {
          response = {
            type: 'hello', token: 'ice-wall-token',
            user: { id: 'ice-wall-user', nickname: 'ice-wall-tester', email: null, position: { x: 8.15, y: 0, z: 6.85 } },
            players: [], houses: [], requests: [], progress: this.progress, catalog: this.catalog,
          };
        } else if (request.type === 'progress.item.consume' && request.itemId === 'ice_lemonade') {
          this.progress.inventory.ice_lemonade = 0;
          (window as any).__iceWallConsumed = ((window as any).__iceWallConsumed ?? 0) + 1;
          response = {
            type: 'progress.updated', progress: this.progress, catalog: this.catalog,
            event: { type: 'item.consumed', itemId: request.itemId, quantity: request.quantity },
          };
        } else if (request.type === 'progress.achievement.unlock' && request.achievementId === 'cat_death_remembrance') {
          (window as any).__catDeathAchievementRequests = ((window as any).__catDeathAchievementRequests ?? 0) + 1;
          this.progress.achievements.push(request.achievementId);
          response = {
            type: 'progress.updated', progress: this.progress, catalog: this.catalog,
            event: { type: 'achievement.unlocked', achievementId: request.achievementId, reward: 0 },
          };
        } else if (request.type === 'progress.building.visit') {
          response = {
            type: 'progress.updated', progress: this.progress, catalog: this.catalog,
            event: { type: 'building.visited', buildingId: request.buildingId },
          };
        }
        if (response) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
      }
      close() {
        this.readyState = NativeWebSocket.CLOSED;
        this.dispatchEvent(new Event('close'));
      }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) {
        return String(args[0]).includes(':8787') ? new IceWallGameWebSocket() : Reflect.construct(Target, args);
      },
    }) });
  }, { settings: RENDER_SETTINGS, initialHasLemonade: hasLemonade });
}

async function focusAndClickIceWall(page: Page): Promise<void> {
  const wallState = await page.evaluate(async () => {
    const mini = (window as any)._mini;
    mini.player.position.set(8.15, 0, 6.85);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const wallMeshes: any[] = [];
    mini.scene.traverse((object: any) => {
      if (object.userData?.sceneInterestPointId === 'cat-cafe-ice-wall' && object.isMesh) wallMeshes.push(object);
    });
    const worldPosition = wallMeshes[0].getWorldPosition(new mini.THREE.Vector3());
    const projected = worldPosition.clone().project(mini.camera);
    return {
      meshCount: wallMeshes.length,
      clientX: (projected.x + 1) * window.innerWidth / 2,
      clientY: (1 - projected.y) * window.innerHeight / 2,
    };
  });
  expect(wallState.meshCount).toBeGreaterThanOrEqual(10);
  await page.locator('#c').dispatchEvent('click', { clientX: wallState.clientX, clientY: wallState.clientY });
}

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile-landscape', width: 844, height: 390 },
] as const;

for (const viewport of viewports) {
  test(`cat cafe ice wall consumes lemonade and starts Cat Death CG on ${viewport.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await prepareIceWallInventory(page);
    await waitForCityBooted(page);
    await expect(page.locator('#onlinePanelToggle')).toHaveClass(/connected/, { timeout: 30_000 });

    const wallState = await page.evaluate(async () => {
      const mini = (window as any)._mini;
      mini.player.position.set(8.15, 0, 6.85);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const wallMeshes: any[] = [];
      mini.scene.traverse((object: any) => {
        if (object.userData?.sceneInterestPointId === 'cat-cafe-ice-wall' && object.isMesh) wallMeshes.push(object);
      });
      const wall = wallMeshes[0];
      const worldPosition = wall.getWorldPosition(new mini.THREE.Vector3());
      const projected = worldPosition.clone().project(mini.camera);
      return {
        meshCount: wallMeshes.length,
        clientX: (projected.x + 1) * window.innerWidth / 2,
        clientY: (1 - projected.y) * window.innerHeight / 2,
      };
    });
    expect(wallState.meshCount).toBeGreaterThanOrEqual(10);
    expect(wallState.clientX).toBeGreaterThan(0);
    expect(wallState.clientX).toBeLessThan(viewport.width);
    expect(wallState.clientY).toBeGreaterThan(0);
    expect(wallState.clientY).toBeLessThan(viewport.height);

    const cityImage = PNG.sync.read(await page.locator('#c').screenshot({ animations: 'disabled' }));
    const colors = new Set<string>();
    for (let index = 0; index < cityImage.data.length; index += 128) {
      colors.add(`${cityImage.data[index]},${cityImage.data[index + 1]},${cityImage.data[index + 2]}`);
    }
    expect(colors.size).toBeGreaterThan(80);

    await page.locator('#c').dispatchEvent('click', { clientX: wallState.clientX, clientY: wallState.clientY });
    await expect(page.locator('#npcName')).toHaveText('不会融化的冰墙');
    await expect(page.locator('#npcLine')).toHaveText('听说保存信息最久的方式是把字刻在石头上……一块不会融化的冰应该也差不多');
    await page.locator('.npc-opt').filter({ hasText: '#放上冰镇柠檬水' }).click();

    await expect.poll(() => page.evaluate(() => (window as any).__iceWallConsumed ?? 0)).toBe(1);
    const cg = page.locator('[data-cat-death-cg="death-of-a-cat"]');
    const transition = page.locator('[data-cat-death-transition="blackout"]');
    await expect(transition).toHaveCount(1);
    await expect(cg).toHaveCount(0);
    await expect(transition).toHaveClass(/is-active/);
    await expect.poll(() => transition.evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity)))
      .toBeGreaterThan(0.9);
    await expect(cg).toHaveClass(/is-active/);
    await expect(cg.locator('canvas')).toBeVisible();
    await expect(cg.locator('.cat-death-cg__caption.is-current')).toBeVisible({ timeout: 3_000 });
    const dimensions = await cg.locator('canvas').evaluate((canvas: HTMLCanvasElement) => ({ width: canvas.width, height: canvas.height }));
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
    const cgImage = PNG.sync.read(await cg.locator('canvas').screenshot({ animations: 'disabled' }));
    const cgColors = new Set<string>();
    for (let index = 0; index < cgImage.data.length; index += 64) {
      cgColors.add(`${cgImage.data[index]},${cgImage.data[index + 1]},${cgImage.data[index + 2]}`);
    }
    expect(cgColors.size).toBeGreaterThan(20);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await cg.getByRole('button', { name: '跳过猫之死影像' }).click();
    await expect(cg).toHaveCount(0, { timeout: 2_000 });
    expect(await page.evaluate(() => (window as any).__catDeathAchievementRequests ?? 0)).toBe(0);
  });
}

test('cat cafe ice wall stays silent when the backpack has no iced lemonade', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await prepareIceWallInventory(page, false);
  await waitForCityBooted(page);
  await expect(page.locator('#onlinePanelToggle')).toHaveClass(/connected/, { timeout: 30_000 });
  await focusAndClickIceWall(page);

  await expect(page.locator('#npcName')).toHaveText('不会融化的冰墙');
  await expect(page.locator('#npcRole')).toBeHidden();
  await expect(page.locator('#npcLine')).toHaveText('听说保存信息最久的方式是把字刻在石头上……一块不会融化的冰应该也差不多');
  await expect(page.locator('.npc-opt').filter({ hasText: '#放上冰镇柠檬水' })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__iceWallConsumed ?? 0)).toBe(0);
  await expect(page.locator('[data-cat-death-cg]')).toHaveCount(0);
});
