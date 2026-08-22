import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { seedCityStorage, waitForCityBooted } from './helpers';

function stubIceProgression(page: Page): void {
  void page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    class IceGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      progress = {
        currency: 1200,
        inventory: {} as Record<string, number>,
        achievements: ['citizen'],
        unlockedBuildings: ['kingice'],
        visitedBuildings: ['activity', 'library', 'kingice'],
      };
      catalog = {
        initialCurrency: 1200,
        buildingPrices: { kingice: 0 },
        buildingUnlockable: { kingice: true },
        achievementRewards: {},
        products: {},
      };
      constructor() {
        super();
        queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); });
      }
      send(raw: string) {
        const request = JSON.parse(raw);
        let response: Record<string, unknown> | null = null;
        if (request.type === 'hello') {
          response = {
            type: 'hello', token: 'ice-token',
            user: { id: 'ice-test-user', nickname: 'ice-tester', email: null, position: { x: 0, y: 0, z: -6 } },
            players: [], houses: [], requests: [], progress: this.progress, catalog: this.catalog,
          };
        } else if (request.type === 'progress.reward.claim') {
          this.progress.inventory.ice_wet_crown = 1;
          response = {
            type: 'progress.updated', progress: this.progress, catalog: this.catalog,
            event: { type: 'reward.claimed', rewardId: request.rewardId, claimed: true },
          };
        }
        if (response) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new IceGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  });
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 844, height: 390 }]) {
  test(`King Ice sanctum locks city UI and completes the rain ending at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    stubIceProgression(page);
    await seedCityStorage(page, 'ice-tester');
    await waitForCityBooted(page);
    await page.waitForFunction(() => Boolean((window as any)._mini?.iceSanctum));

    await page.evaluate(() => (window as any)._mini.iceSanctum.enter());
    await expect(page.locator('body')).toHaveClass(/ice-sanctum-active/);
    await expect(page.locator('.ui-header')).toBeHidden();
    await expect(page.locator('#onlinePanelToggle')).toBeHidden();
    await expect(page.locator('#mapToggle')).toBeHidden();

    const sceneState = await page.evaluate(() => {
      const api = (window as any)._mini;
      const root = api.iceSanctum.root();
      return {
        active: api.iceSanctum.isActive(),
        playerVisible: api.player.visible,
        rootVisible: root.visible,
        hasEntered: api.iceSanctum.hasEntered(),
        playerX: api.player.position.x,
        playerZ: api.player.position.z,
      };
    });
    expect(sceneState).toMatchObject({ active: true, playerVisible: true, rootVisible: true, hasEntered: false });
    expect(sceneState.playerX).toBeCloseTo(220, 1);
    expect(sceneState.playerZ).toBeGreaterThan(48);

    const screenshot = PNG.sync.read(await page.locator('#c').screenshot());
    const center = (Math.floor(screenshot.height / 2) * screenshot.width + Math.floor(screenshot.width / 2)) * 4;
    expect(screenshot.data[center]! + screenshot.data[center + 1]! + screenshot.data[center + 2]!).toBeGreaterThan(40);
    await expect(page.locator('body')).not.toHaveClass(/ice-sanctum-cinematic-active/, { timeout: 10_000 });

    expect(await page.evaluate(() => (window as any)._mini.iceSanctum.interactNpc())).toBe(true);
    await expect(page.locator('.npc-opt')).toHaveCount(0);
    await expect(page.locator('#npcName')).toHaveText('？？？', { timeout: 10_000 });
    await expect(page.locator('#npcRole')).toBeHidden();
    await expect(page.locator('#npcLine')).toHaveText('……');
    await expect(page.locator('#npcLine .npc-line-char')).toHaveCount(2);
    await expect(page.getByRole('button', { name: '你是……' })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: '你是……' }).click();
    await expect(page.locator('#npcName')).toHaveText('？？？');
    await expect(page.locator('#npcLine')).toHaveText('冰');
    await page.getByRole('button', { name: '哦，你在这做什么' }).click();
    await expect(page.locator('#npcName')).toHaveText('Ice');
    await expect(page.locator('#npcLine')).toHaveText('……');
    await page.getByRole('button', { name: '？？' }).click();
    await page.getByRole('button', { name: '不……' }).click();
    await expect(page.locator('#npcLine')).toHaveText('……抱歉');

    await expect(page.locator('body')).toHaveClass(/ice-sanctum-returning/, { timeout: 3_000 });
    await expect(page.locator('body')).not.toHaveClass(/ice-sanctum-active/, { timeout: 5_000 });
    await expect(page.locator('body')).not.toHaveClass(/ice-sanctum-returning/, { timeout: 5_000 });
    await expect(page.locator('body')).toHaveAttribute('data-city-weather', 'rain');
    await expect(page.locator('#unlockToast')).toContainText('湿湿的皇冠已放入背包');
    expect(await page.evaluate(() => {
      const saved = localStorage.getItem('minicityStory.main.ice-king.sanctum.v1:ice-tester');
      return saved ? JSON.parse(saved).ending : null;
    })).toBe('reject');
    expect(await page.evaluate(() => (window as any)._mini.iceSanctum.hasEntered())).toBe(true);
    expect(await page.evaluate(() => (window as any)._mini.iceSanctum.enter())).toBe(false);
  });
}

test('Ice time skip fades the blackout away before the second conversation', async ({ page }) => {
  test.setTimeout(90_000);
  stubIceProgression(page);
  await seedCityStorage(page, 'ice-fade-tester');
  await waitForCityBooted(page);
  await page.waitForFunction(() => Boolean((window as any)._mini?.iceSanctum));
  await page.evaluate(() => (window as any)._mini.iceSanctum.enter());
  await expect(page.locator('body')).not.toHaveClass(/ice-sanctum-cinematic-active/, { timeout: 10_000 });
  expect(await page.evaluate(() => (window as any)._mini.iceSanctum.interactNpc())).toBe(true);

  await page.getByRole('button', { name: '你是……' }).click();
  await page.getByRole('button', { name: '哦，你在这做什么' }).click();
  await page.getByRole('button', { name: '？？' }).click();
  await page.getByRole('button', { name: '……行？' }).click();

  const fade = page.locator('.ice-sanctum-time-skip-fade');
  await expect(fade).toHaveCount(1, { timeout: 12_000 });
  await expect(fade).toHaveClass(/is-fading/);
  await expect.poll(async () => Number(await fade.evaluate((element) => getComputedStyle(element).opacity))).toBeLessThan(0.8);
  await expect(fade).toHaveCount(0, { timeout: 4_000 });
  await expect(page.getByRole('button', { name: '喜欢' })).toBeVisible({ timeout: 5_000 });
});

test('resident ice can re-enter the crown building after completing its story', async ({ page }) => {
  stubIceProgression(page);
  await page.addInitScript(() => localStorage.setItem('minicityIceChoice:ice', 'accept'));
  await seedCityStorage(page, 'ice');
  await waitForCityBooted(page);
  await page.waitForFunction(() => Boolean((window as any)._mini?.iceSanctum));

  expect(await page.evaluate(() => (window as any)._mini.iceSanctum.hasEntered())).toBe(false);
  expect(await page.evaluate(() => (window as any)._mini.iceSanctum.enter())).toBe(true);
  await expect(page.locator('body')).toHaveClass(/ice-sanctum-active/);
});

test('leaving Ice sanctum before an ending still allows the resident to enter again', async ({ page }) => {
  stubIceProgression(page);
  await seedCityStorage(page, 'ice-interrupted-tester');
  await waitForCityBooted(page);
  await page.waitForFunction(() => Boolean((window as any)._mini?.iceSanctum));
  expect(await page.evaluate(() => (window as any)._mini.iceSanctum.enter())).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('minicityIceChoice:ice-interrupted-tester'))).toBeNull();

  await page.reload();
  await waitForCityBooted(page);
  await page.waitForFunction(() => Boolean((window as any)._mini?.iceSanctum));
  expect(await page.evaluate(() => (window as any)._mini.iceSanctum.hasEntered())).toBe(false);
  expect(await page.evaluate(() => (window as any)._mini.iceSanctum.enter())).toBe(true);
});
