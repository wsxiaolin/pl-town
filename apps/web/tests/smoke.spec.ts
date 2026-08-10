import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

test('resident phone opens the notification binding view', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  });
  await page.goto('/');
  await page.locator('#onlinePanelToggle').click({ force: true });
  await expect(page.locator('#onlinePanel')).toHaveClass(/open/);
  await page.locator('[data-online-tab="notifications"]').click();
  await expect(page.locator('#onlineNotificationsView')).toHaveClass(/active/);
  await expect(page.locator('#phoneBindForm')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test('resident phone switches between housing and chat', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3','true'); localStorage.setItem('minicityUser','tester');
    localStorage.setItem('minicityRenderSettings',JSON.stringify({resolution:1,antialias:false,anisotropy:1,shadows:false,exposure:1.18}));
  });
  await page.goto('/');
  await page.locator('#onlinePanelToggle').click({force:true});
  await page.locator('[data-online-tab="houses"]').click();
  await expect(page.locator('#onlineHousesView')).toHaveClass(/active/);
  await page.locator('[data-online-tab="chat"]').click();
  await expect(page.locator('#onlineChatView')).toHaveClass(/active/);
});

for (const viewport of viewports) {
  test(`${viewport.name} renders a stable WebGL frame`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem('minicityRenderSettings', JSON.stringify({
        resolution: 1,
        antialias: false,
        anisotropy: 1,
        shadows: false,
        exposure: 1.18,
      }));
    });
    await page.goto('/');
    await page.waitForTimeout(4_000);

    const canvas = page.locator('#c');
    await expect(canvas).toBeVisible();
    const dimensions = await canvas.evaluate((element: HTMLCanvasElement) => ({
      width: element.width,
      height: element.height,
    }));
    const image = PNG.sync.read(await page.screenshot({ animations: 'disabled' }));
    const colors = new Set<string>();
    for (let index = 0; index < image.data.length; index += 64) {
      colors.add(`${image.data[index]},${image.data[index + 1]},${image.data[index + 2]},${image.data[index + 3]}`);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
    expect(colors.size).toBeGreaterThan(8);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test('satellite city loads its buildings and roads', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    class OfflineGameWebSocket extends EventTarget {
      readyState: number = NativeWebSocket.CONNECTING;
      send() {}
      close() { this.readyState = NativeWebSocket.CLOSED; }
    }
    const RoutedWebSocket = new Proxy(NativeWebSocket, {
      construct(Target, args) {
        if (String(args[0]).includes(':8787')) return new OfflineGameWebSocket();
        return Reflect.construct(Target, args);
      },
    });
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: RoutedWebSocket });
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({
      resolution: 1,
      antialias: false,
      anisotropy: 1,
      shadows: false,
      exposure: 1.18,
    }));
  });

  await page.goto('/');
  await expect.poll(async () => page.evaluate(() => {
    const mini = (window as any).__mini?.();
    if (!mini) return 0;
    const buildings = mini.scene.children.filter((object: any) => object.userData.assetPack === 'buildings');
    const designed = mini.scene.children.filter((object: any) => object.userData.assetPack === 'main-city-design');
    const satelliteRoads = mini.scene.children.filter((object: any) => object.userData.district === 'satellite-road');
    const connectors = mini.scene.children.filter((object: any) => object.userData.district === 'satellite-connector');
    const positioned = [...buildings, ...designed].every((object: any) => Math.abs(object.position.x) <= 30 && object.position.z >= 57 && object.position.z <= 107);
    return { buildings: buildings.length, designed: designed.length, roads: satelliteRoads.length, connectors: connectors.length, positioned };
  }), { timeout: 30_000 }).toEqual({ buildings: 13, designed: 5, roads: 6, connectors: 1, positioned: true });
  expect(errors).toEqual([]);
});

test('NPC side quest flows from offer to building objective to delivery', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'quest-tester');
    localStorage.removeItem('minicityQuestJournal.v1');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
    const NativeWebSocket = window.WebSocket;
    class OfflineGameWebSocket extends EventTarget {
      readyState: number = NativeWebSocket.CONNECTING;
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      send() {}
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new OfflineGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  });
  await page.goto('/');
  await page.waitForFunction(() => {
    const mini = (window as any).__mini?.();
    return !!mini?.player?.visible && !!mini?.npcs?.some((npc: any) => npc.profile.id === 'azi');
  }, undefined, { timeout: 30_000 });

  const clickWorldEntity = async (kind: 'npc' | 'building', id: string) => {
    const handled = await page.evaluate(({ kind: entityKind, id: entityId }) => {
      const mini = (window as any).__mini();
      const entity = entityKind === 'npc'
        ? mini.npcs.find((npc: any) => npc.profile.id === entityId).mesh
        : (() => {
            let found: any;
            mini.scene.traverse((object: any) => { if (!found && object.userData?.buildingId === entityId) found = object; });
            return found;
          })();
      const world = new mini.THREE.Vector3();
      entity.getWorldPosition(world);
      mini.player.position.set(world.x + 0.5, 0, world.z);
      return entityKind === 'npc' ? mini.interactNpc(entityId) : mini.interactBuilding(entityId);
    }, { kind, id });
    expect(handled).toBe(true);
  };

  await clickWorldEntity('npc', 'azi');
  await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
  await page.locator('.npc-opt').filter({ hasText: '支线：调查夜灯传闻' }).click();
  await page.locator('.npc-opt').filter({ hasText: '我去调查' }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('minicityQuestJournal.v1') || '{}').quests?.['side.azi.night-lights']?.status)).toBe('active');
  await page.locator('.npc-opt').filter({ hasText: '告辞' }).click();

  await clickWorldEntity('building', 'research');
  await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('minicityQuestJournal.v1') || '{}').quests?.['side.azi.night-lights']?.status)).toBe('ready');
  await page.locator('#modalClose').click();

  await clickWorldEntity('npc', 'azi');
  const reportOption = page.locator('.npc-opt').first();
  await expect(reportOption).toHaveText('汇报研究院的发现');
  await reportOption.click();
  const deliveryOption = page.locator('.npc-opt').filter({ hasText: '讲述调查经过' });
  await expect(deliveryOption).toHaveText('讲述调查经过');
  await deliveryOption.evaluate((element: HTMLButtonElement) => element.click());
  await expect(page.locator('#npcLine')).toContainText('调查员');
  await expect(page.locator('#utText')).toContainText('任务已完成');
});

test('an expired session can log in again from the header', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'tester');
    localStorage.setItem('minicityServerToken', 'expired-token');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({
      resolution: 1,
      antialias: false,
      anisotropy: 1,
      shadows: false,
      exposure: 1.18,
    }));

    const NativeWebSocket = window.WebSocket;
    class FakeGameWebSocket extends EventTarget {
      readyState = 0;

      constructor() {
        super();
        queueMicrotask(() => {
          this.readyState = NativeWebSocket.OPEN;
          this.dispatchEvent(new Event('open'));
        });
      }

      send(raw: string) {
        const request = JSON.parse(raw);
        const response = request.token
          ? { type: 'error', message: '登录已过期，请重新登录' }
          : {
              type: 'hello',
              token: 'renewed-token',
              user: { id: 'user-1', nickname: request.nickname, email: null, position: { x: 0, y: 0, z: -6 } },
              players: [],
              houses: [],
              requests: [],
            };
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
      }

      close() {
        if (this.readyState === 3) return;
        this.readyState = 3;
        this.dispatchEvent(new Event('close'));
      }
    }

    const RoutedWebSocket = new Proxy(NativeWebSocket, {
      construct(Target, args) {
        if (String(args[0]).includes(':8787')) return new FakeGameWebSocket();
        return Reflect.construct(Target, args);
      },
    });
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: RoutedWebSocket });
  });

  await page.goto('/');
  const loginEntry = page.locator('#logoUser');
  await expect.poll(
    () => page.evaluate(() => localStorage.getItem('minicityServerToken')),
    { timeout: 30_000 },
  ).toBeNull();
  await expect(loginEntry).toHaveText('登录');

  await loginEntry.click();
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await expect(page.locator('#loginError')).toHaveText('登录已过期，请重新登录');
  await expect(page.locator('#loginInput')).toHaveValue('tester');

  await page.locator('#loginPassword').fill('new-password');
  await page.locator('#loginBtn').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('minicityServerToken'))).toBe('renewed-token');
  await expect(loginEntry).toHaveText('— tester');
});
