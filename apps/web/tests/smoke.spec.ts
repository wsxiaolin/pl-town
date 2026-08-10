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

test('render settings use the available width and keep controls responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'settings-tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
    const NativeWebSocket = window.WebSocket;
    class OfflineGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      send() {}
      close() { this.readyState = NativeWebSocket.CLOSED; }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new OfflineGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  });
  await page.goto('/');
  await page.locator('#renderSettingsToggle').click({ force: true });
  const panel = page.locator('#renderSettings');
  await expect(panel).toHaveClass(/open/);
  const panelBox = await panel.boundingBox();
  const closeBox = await page.locator('#renderSettingsClose').boundingBox();
  expect(panelBox).not.toBeNull();
  expect(closeBox).not.toBeNull();
  expect(closeBox!.x).toBeGreaterThan(panelBox!.x + panelBox!.width * 0.8);
  await page.locator('[data-render-preset="ultra"]').click();
  await expect(page.locator('[data-render-preset="ultra"]')).toHaveAttribute('aria-pressed', 'true');

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect(page.locator('#renderSettingsClose')).toBeVisible();
});

test('cloud inventory and scene discoveries work in the rendered city', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'world-tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
    const NativeWebSocket = window.WebSocket;
    class WorldGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      progress = {
        currency: 1200,
        inventory: { dragonwell_tea: 2, city_badge: 1, mandarin: 0 },
        achievements: ['citizen'],
        unlockedBuildings: [],
        visitedBuildings: ['activity', 'library'],
      };
      claimedOrange = false;
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      send(raw: string) {
        const request = JSON.parse(raw);
        const catalog = {
          initialCurrency: 1200, buildingPrices: { mall_south: 0 },
          achievementRewards: { citizen: 20, cat_cafe_note: 30, minicity_origin: 50, dragonwell_assimilation: 80 },
          products: { dragonwell_tea: { itemId: 'dragonwell_tea', name: '龙井茶', unitPrice: 30 } },
        };
        let response: Record<string, unknown> | null = null;
        if (request.type === 'hello') {
          response = {
            type: 'hello', token: 'world-token',
            user: { id: 'world-user', nickname: 'world-tester', email: null, position: { x: 0, y: 0, z: -6 } },
            players: [], houses: [], requests: [], progress: this.progress, catalog,
          };
        } else if (request.type === 'progress.reward.claim') {
          const claimed = !this.claimedOrange;
          this.claimedOrange = true;
          if (claimed) this.progress.inventory.mandarin = 1;
          response = { type: 'progress.updated', progress: this.progress, catalog, event: { type: 'reward.claimed', rewardId: request.rewardId, claimed } };
        } else if (request.type === 'progress.item.consume') {
          this.progress.inventory.dragonwell_tea -= 1;
          response = { type: 'progress.updated', progress: this.progress, catalog, event: { type: 'item.consumed', itemId: request.itemId, quantity: 1 } };
        } else if (request.type === 'progress.achievement.unlock') {
          if (!this.progress.achievements.includes(request.achievementId)) this.progress.achievements.push(request.achievementId);
          response = { type: 'progress.updated', progress: this.progress, catalog, event: { type: 'achievement.unlocked', achievementId: request.achievementId, reward: 30 } };
        } else if (request.type === 'progress.building.unlock') {
          if (!this.progress.unlockedBuildings.includes(request.buildingId)) this.progress.unlockedBuildings.push(request.buildingId);
          response = { type: 'progress.updated', progress: this.progress, catalog, event: { type: 'building.unlocked', buildingId: request.buildingId, purchased: true } };
        } else if (request.type === 'progress.building.visit') {
          response = { type: 'progress.updated', progress: this.progress, catalog, event: { type: 'building.visited', buildingId: request.buildingId } };
        }
        if (response) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new WorldGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  });

  await page.goto('/');
  await expect(page.locator('[data-inventory-button]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-inventory-button] svg')).toBeVisible();
  await page.locator('[data-inventory-button]').click();
  await expect(page.locator('#inventoryPanel')).toHaveClass(/open/);
  await expect(page.locator('#inventoryPanel [data-inventory-list]')).toContainText('龙井茶');
  await expect(page.locator('#inventoryPanel [data-inventory-list]')).toContainText('× 2');
  await page.locator('[data-inventory-close]').click();
  await page.evaluate(() => (window as any).__mini().interactBuilding('mall_south'));
  await expect(page.locator('#inventoryPanel')).toHaveClass(/shop-mode/);
  await expect(page.locator('#inventoryPanel [data-panel-title]')).toHaveText('物实商店');
  await expect(page.locator('#inventoryPanel [data-inventory-section]')).toBeHidden();
  await page.locator('[data-inventory-close]').click();

  const worldAudit = await page.evaluate(async () => {
    const mini = (window as any).__mini();
    mini.player.position.set(7, 0, 5);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const projected = mini.player.position.clone().project(mini.camera);
    const interestIds = new Set<string>();
    let interactivePlot = false;
    mini.scene.traverse((object: any) => {
      if (object.userData?.sceneInterestPointId) interestIds.add(object.userData.sceneInterestPointId);
      if (object.userData?.buildingId === 'activity' && object.geometry?.type === 'PlaneGeometry') interactivePlot = true;
    });
    return {
      projected: { x: projected.x, y: projected.y },
      interestIds: [...interestIds].sort(),
      interactivePlot,
      hasStoryNpc: mini.npcs.some((npc: any) => npc.profile.npcType === 'story'),
    };
  });
  expect(Math.abs(worldAudit.projected.x)).toBeLessThan(0.001);
  expect(Math.abs(worldAudit.projected.y)).toBeLessThan(0.001);
  expect(worldAudit.interestIds).toEqual(['cat-cafe-note', 'longjing-well', 'origin-orange-tree']);
  expect(worldAudit.interactivePlot).toBe(true);
  expect(worldAudit.hasStoryNpc).toBe(true);

  await page.evaluate(() => (window as any).__mini().interactInterestPoint('origin-orange-tree'));
  await expect(page.locator('#npcLine')).toHaveText('城中的守望者，它或许不是最高的，但它见证了最多的风雨');
  await expect(page.locator('#npcRole')).toHaveText('获得沃柑 ×1');
  await page.locator('#npcClose').click();

  await page.evaluate(() => (window as any).__mini().interactInterestPoint('cat-cafe-note'));
  await expect(page.locator('#npcName')).toHaveText('掉落的纸');
  await expect(page.locator('#npcLine')).toHaveText('');
  await page.locator('#npcClose').click();

  await page.evaluate(() => (window as any).__mini().interactInterestPoint('longjing-well'));
  const wellFocus = await page.evaluate(() => {
    const mini = (window as any).__mini();
    let well: any;
    mini.scene.traverse((object: any) => { if (object.userData?.sceneInterestPointId === 'longjing-well') well ??= object; });
    const position = well.getWorldPosition(new mini.THREE.Vector3());
    return { zoom: mini.cameraZoom, distance: Math.hypot(mini.player.position.x - position.x, mini.player.position.z - position.z), phase: document.body.dataset.wellVision };
  });
  expect(wellFocus.zoom).toBeLessThanOrEqual(5.2);
  expect(wellFocus.distance).toBeGreaterThan(1.5);
  expect(wellFocus.phase).toBe('focus');
  await expect(page.locator('#npcLine')).toHaveText('你看见了一个爬满绿色植物的石井。');
  await page.locator('.npc-opt').filter({ hasText: '#使用龙井茶' }).click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.wellVision)).toBe('engulf');
  await expect(page.locator('#npcLine')).toContainText('绿色自你的指尖蔓延');
  await page.locator('.npc-opt').filter({ hasText: '#我...这是怎么了？' }).click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.wellVision ?? '')).toBe('');
  await expect(page.locator('#npcLine')).toHaveText('你醒了过来，发现石井干净如新，仿佛你刚才所见到的都只是一场梦。');
  await expect(page.locator('#npcLine')).toHaveCSS('color', 'rgb(63, 138, 79)');
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
    const image = PNG.sync.read(await canvas.screenshot({ animations: 'disabled' }));
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
      send(raw: string) {
        const request = JSON.parse(raw);
        const progress = { currency: 1200, inventory: {}, achievements: ['citizen'], unlockedBuildings: ['research'], visitedBuildings: request.type === 'progress.building.visit' ? ['research'] : [] };
        const catalog = { initialCurrency: 1200, buildingPrices: { research: 20 }, achievementRewards: { citizen: 20 }, products: {} };
        const response = request.type === 'hello'
          ? {
              type: 'hello', token: 'quest-token',
              user: { id: 'quest-user', nickname: 'quest-tester', email: null, position: { x: 0, y: 0, z: -6 } },
              players: [], houses: [], requests: [], progress, catalog,
            }
          : request.type === 'progress.building.visit'
            ? { type: 'progress.updated', progress, catalog, event: { type: 'building.visited', buildingId: request.buildingId } }
            : null;
        if (!response) return;
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
      }
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
  await expect(page.locator('#onlineStateDot')).toHaveClass(/connected/);

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
        if (request.type !== 'hello') return;
        const response = request.token
          ? { type: 'error', message: '登录已过期，请重新登录' }
          : {
              type: 'hello',
              token: 'renewed-token',
              user: { id: 'user-1', nickname: request.nickname, email: null, position: { x: 0, y: 0, z: -6 } },
              players: [],
              houses: [],
              requests: [],
              progress: { currency: 1200, inventory: {}, achievements: ['citizen'], unlockedBuildings: [], visitedBuildings: [] },
              catalog: { initialCurrency: 1200, buildingPrices: {}, achievementRewards: { citizen: 20 }, products: {} },
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
