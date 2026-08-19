import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { RENDER_SETTINGS, seedCityStorage, stubNewsstandWebSocket, waitForCityBooted, waitForCityReady } from './helpers';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

test('resident phone switches between housing and chat', async ({ page }) => {
  await waitForCityReady(page, 'tester');
  await page.locator('#onlinePanelToggle').click({ force: true });
  await page.locator('[data-online-tab="houses"]').click({ force: true });
  await expect(page.locator('#onlineHousesView')).toHaveClass(/active/);
  await page.locator('[data-online-tab="chat"]').click({ force: true });
  await expect(page.locator('#onlineChatView')).toHaveClass(/active/);
});

test('render settings use the available width and keep controls responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
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
  await seedCityStorage(page, 'settings-tester');
  await waitForCityBooted(page);
  // Open the render-settings drawer. On slow software-GL CI runners the top-bar
  // toggle can be momentarily covered by the fading boot shell, so a plain
  // click() occasionally misses. Dispatch the click directly on the element and
  // poll until the panel actually gains the `open` class.
  await expect.poll(async () => {
    await page.evaluate(() => document.getElementById('renderSettingsToggle')?.click());
    return await page.evaluate(() => document.getElementById('renderSettings')?.classList.contains('open') ?? false);
  }, { timeout: 10_000, intervals: [200, 300, 500] }).toBe(true);
  const panel = page.locator('#renderSettings');
  // The drawer slides in via a CSS transform transition; under software-GL /
  // parallel load the transformed absolute x positions lag the class flip. The
  // close button is a child of the panel, so closeRight - panelLeft is
  // transform-independent. Assert the close button sits in the right ~20% of
  // the panel (its right edge past 80% of the panel width from the left).
  const layout = await page.evaluate(() => {
    const panelEl = document.getElementById('renderSettings')!;
    const closeEl = document.getElementById('renderSettingsClose')!;
    const p = panelEl.getBoundingClientRect();
    const c = closeEl.getBoundingClientRect();
    return { panelLeft: p.left, panelWidth: p.width, closeRight: c.right };
  });
  expect(layout.closeRight - layout.panelLeft).toBeGreaterThan(layout.panelWidth * 0.8);
  // Select the "极致" preset via a direct click dispatch — it lives near the
  // bottom of the scrollable drawer and can be clipped/off-viewport on small
  // software-GL windows, so a geometry-based click is unreliable.
  await page.evaluate(() => {
    const btn = document.querySelector<HTMLButtonElement>('[data-render-preset="ultra"]');
    btn?.click();
  });
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
          initialCurrency: 1200, buildingPrices: { mall_south: 0, academy_library: 0 },
          buildingUnlockable: { mall_south: true, academy_library: true },
          achievementRewards: { citizen: 20, cat_cafe_note: 30, minicity_origin: 50, dragonwell_assimilation: 80 },
          products: {
            dragonwell_tea: { itemId: 'dragonwell_tea', name: '龙井茶', unitPrice: 30 },
            beef: { itemId: 'beef', name: '牛肉', unitPrice: 45 },
            radish: { itemId: 'radish', name: '萝卜', unitPrice: 20 },
            music_box: { itemId: 'music_box', name: '音乐盒', unitPrice: 120 },
          },
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
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/);
  const phoneToggle = page.locator('#onlinePanelToggle');
  await expect(phoneToggle).toHaveClass(/connected/, { timeout: 30_000 });
  await expect(page.locator('#onlineInventoryView [data-inventory-list]')).toContainText('龙井茶');
  await expect(page.locator('#onlineInventoryView [data-inventory-list]')).toContainText('× 2');
  await expect(page.locator('#onlineInventoryView .sp-ul-name').first()).toHaveCSS('white-space', 'nowrap');
  await page.evaluate(() => (window as any).__mini().interactBuilding('mall_south'));
  await expect(page.locator('#shopPanel')).toHaveClass(/open/);
  await expect(page.locator('#shopPanel')).toContainText('物实商店');
  await expect(page.locator('#onlinePanel')).not.toHaveClass(/open/);
  const expectedProducts = [
    ['dragonwell_tea', '茶', '龙井茶', '西湖龙井 · 可用于石井剧情'],
    ['beef', '肉', '牛肉', '新鲜牛肉 · 林澈遗愿所需食材'],
    ['radish', '萝', '萝卜', '新鲜萝卜 · 林澈遗愿所需食材'],
    ['music_box', '音', '音乐盒', '经典旋律音乐盒 · 林澈遗愿所需物品'],
  ] as const;
  for (const [productId, icon, name, detail] of expectedProducts) {
    const product = page.locator(`[data-product-id="${productId}"]`);
    await expect(product.locator('.shop-product-icon')).toHaveText(icon);
    await expect(product.locator('.sp-ul-name')).toHaveText(name);
    await expect(product.locator('small')).toHaveText(detail);
  }
  await page.locator('[data-shop-close]').click();

  await page.evaluate(() => (window as any).__mini().interactBuilding('academy_library'));
  await expect(page.locator('#academyPanel')).toHaveClass(/open/);
  await page.locator('.academy-work').first().click();
  await expect(page.locator('#academyReader')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#academyReader')).not.toHaveClass(/open/);
  await expect(page.locator('#academyPanel')).toHaveClass(/open/);
  await page.locator('#academyClose').click();

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
    // Only JavaScript / WebGL errors are real regressions. The suite boots the
    // web dev server but never the @minicity/server backend, so the app's
    // fire-and-forget telemetry posts to /town-api/* are answered with 500 by
    // the Vite proxy. Chromium surfaces those as generic "Failed to load
    // resource" console errors; they are environmental, so they are dropped.
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      // Resource-load failures are surfaced as console errors without a URL.
      // The suite only boots the web dev server, never the @minicity/server
      // backend, so the app's fire-and-forget telemetry posts to /town-api/*
      // are answered with 500 by the Vite proxy and logged here. Drop these
      // environmental resource errors; real JS / WebGL errors still fail.
      if (/Failed to load resource/i.test(message.text())) return;
      errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.setViewportSize(viewport);
    await page.addInitScript((settings) => {
      localStorage.setItem('minicityRenderSettings', settings);
    }, RENDER_SETTINGS);
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

test('story-locked literature review stays unlabelled and non-interactive', async ({ page }) => {
  await page.addInitScript(() => {
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
  await seedCityStorage(page, 'locked-building-tester');
  await page.addInitScript((settings) => {
    localStorage.setItem('minicityRenderSettings', settings);
  }, JSON.stringify({ resolution: 0.5, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  await waitForCityBooted(page);
  await expect(page.locator('.bl-num')).toHaveCount(0);
  await expect(page.locator('[data-building-id="litreview"]')).toHaveCount(0);
  await expect(page.locator('.b-label-item[data-building-id="library"]')).toHaveCount(1, { timeout: 30_000 });
  await page.locator('#mapToggle').click({ force: true });
  await expect(page.locator('#mapOverlay')).toHaveClass(/show/, { timeout: 10_000 });
  await expect(page.locator('.map-icon[data-building-id="litreview"]')).toHaveCount(0);
  await expect(page.locator('.map-icon[data-building-id="library"]')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('.map-icon[data-building-id="echo-observatory"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__mini().interactBuilding('litreview'))).toBe(false);

  const lockedAudit = await page.evaluate(() => {
    const mini = (window as any).__mini();
    let storyLocked = false;
    let emissiveIntensity = -1;
    mini.scene.traverse((object: any) => {
      if (object.userData?.storyLocked) storyLocked = true;
      if (object.userData?.buildingId === 'litreview' && object.material && emissiveIntensity < 0) {
        emissiveIntensity = Number(object.material.emissiveIntensity ?? 0);
      }
    });
    return { storyLocked, emissiveIntensity };
  });
  expect(lockedAudit).toEqual({ storyLocked: true, emissiveIntensity: 0 });
});

test('renamed mall buildings surface their new store names', async ({ page }) => {
  await waitForCityReady(page, 'mall-rename-tester');
  await expect(page.locator('.b-label-item[data-building-id="mall_south"] .bl-name')).toHaveText('金月店');
  await expect(page.locator('.b-label-item[data-building-id="mall_west"] .bl-name')).toHaveText('断星玄');
  await page.evaluate(() => (window as any).__mini().openBuildingDialog('mall_south'));
  await expect(page.locator('#modalTitle')).toHaveText('金月店');
  await page.locator('#modalClose').click();
  await page.evaluate(() => (window as any).__mini().openBuildingDialog('mall_west'));
  await expect(page.locator('#modalTitle')).toHaveText('断星玄');
  await page.locator('#modalClose').click();
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
  await expect(loginEntry).toHaveText('Login');

  // The login screen stays open with the failure message so the resident can
  // sign in again directly; the header entry must not be needed.
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await expect(page.locator('#loginError')).toHaveText('登录已过期，请重新登录');
  await expect(page.locator('#loginInput')).toHaveValue('tester');

  await page.locator('#loginPassword').fill('new-password');
  await page.locator('#loginBtn').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('minicityServerToken'))).toBe('renewed-token');
  await expect(loginEntry).toHaveText('- tester');
});

test('wrong credentials keep the login screen open with a clear error', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'tester');
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
        const response = !request.password
          ? { type: 'error', message: 'Password is required' }
          : request.password === 'wrong-pass'
            ? { type: 'error', message: 'Nickname or password is incorrect' }
            : {
                type: 'hello',
                token: 'fresh-token',
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

  // A stored nickname without a usable session cannot be restored; the login
  // screen must stay open and prompt for credentials instead of dismissing.
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await expect(page.locator('#loginError')).toHaveText('Password is required');
  await expect(page.locator('#loginInput')).toHaveValue('tester');

  // Wrong password: the overlay stays open, keeps the nickname, clears the
  // password field, and reports the failure.
  await page.locator('#loginPassword').fill('wrong-pass');
  await page.locator('#loginBtn').click();
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await expect(page.locator('#loginError')).toHaveText('Nickname or password is incorrect');
  await expect(page.locator('#loginInput')).toHaveValue('tester');
  await expect(page.locator('#loginPassword')).toHaveValue('');

  // Correct password: login succeeds and the overlay closes.
  await page.locator('#loginPassword').fill('correct-pass');
  await page.locator('#loginBtn').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('minicityServerToken'))).toBe('fresh-token');
  await expect(loginEntry).toHaveText('- tester');
  await expect(page.locator('#loginOverlay')).toBeHidden();
});

test('culture hall opens the writer catalog drawer from the right', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'culture-tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
    const NativeWebSocket = window.WebSocket;
    class CultureGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      progress = {
        currency: 0,
        inventory: {},
        achievements: ['citizen'],
        unlockedBuildings: ['culturehall'],
        visitedBuildings: ['activity', 'library', 'culturehall'],
      };
      catalog = { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} };
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      send(raw: string) {
        const request = JSON.parse(raw);
        let response: Record<string, unknown> | null = null;
        if (request.type === 'hello') {
          response = {
            type: 'hello', token: 'culture-token',
            user: { id: 'culture-user', nickname: 'culture-tester', email: null, position: { x: 0, y: 0, z: -6 } },
            players: [], houses: [], requests: [], progress: this.progress, catalog: this.catalog,
          };
        } else if (request.type === 'progress.building.visit') {
          response = { type: 'progress.updated', progress: this.progress, catalog: this.catalog, event: { type: 'building.visited', buildingId: request.buildingId } };
        }
        if (response) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new CultureGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  });

  await page.goto('/');
  await page.waitForFunction(() => {
    const mini = (window as any).__mini?.();
    return !!mini?.player?.visible;
  }, undefined, { timeout: 30_000 });

  await page.evaluate(() => (window as any).__mini().interactBuilding('culturehall'));
  const panel = page.locator('#writerCatalogPanel');
  await expect(panel).toHaveClass(/open/);
  await expect(page.locator('#writerCatalogTitle')).toHaveText('物实作家图鉴');
  await expect(page.locator('#writerCatalogList .writer-author')).toHaveCount(38);
  await expect(page.locator('#writerCatalogList')).toContainText('一只屑整数虫');
  await expect(page.locator('#writerCatalogList')).toContainText('Nebulapolaris');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  await page.locator('#writerCatalogClose').click();
  await expect(panel).not.toHaveClass(/open/);
});

test('newsstand opens the newspaper catalog and reads a multi-page issue', async ({ page }) => {
  test.setTimeout(120_000);
  await seedCityStorage(page, 'news-tester');
  stubNewsstandWebSocket(page);

  await page.goto('/');
  await page.waitForFunction(() => {
    const mini = (window as any).__mini?.();
    return !!mini?.player?.visible;
  }, undefined, { timeout: 30_000 });

  await page.evaluate(() => (window as any).__mini().interactBuilding('newsstand'));
  const panel = page.locator('#newsstandPanel');
  await expect(panel).toHaveClass(/open/);
  await expect(page.locator('#newsstandTitle')).toHaveText('报摊 · 星辉刊物目录');
  await expect(page.locator('#newsstandList .np-year')).toHaveCount(4);
  await expect(page.locator('#newsstandList .np-issue').first()).toContainText('2026.1.4');
  const oldestIssue = page.locator('#newsstandList .np-issue', { hasText: '2023.7.23' });
  await expect(oldestIssue).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  // Open the first weekly issue (2023.7.23) and confirm the reader renders.
  await oldestIssue.click();
  const reader = page.locator('#newspaperOverlay');
  await expect(reader).toHaveClass(/open/);
  await expect(page.locator('#newspaperMeta')).toContainText('星辉周刊 2023.7.23');
  await expect(page.locator('#newspaperStage .np-issue-title')).toHaveText('星辉周刊 2023.7.23');
  await expect(page.locator('#newspaperStage .np-motto')).toBeVisible();
  await expect(page.locator('#newspaperStage .np-body')).toContainText('精知优选');
  // 单板块版面整版通栏，不出现半栏 + 右侧空白
  await expect(page.locator('#newspaperStage .np-body .np-col-full')).toHaveCount(1);

  // The first issue spans multiple pages; flip to the last one.
  const total = Number(await page.locator('#newspaperPageTotal').textContent());
  expect(total).toBeGreaterThan(1);
  const nextBtn = page.locator('#newspaperNext');
  for (let index = 0; index < total - 1; index += 1) {
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
  }
  await expect(page.locator('#newspaperNext')).toBeDisabled();
  await expect(page.locator('#newspaperPageNo')).toHaveText(String(total));
  // 末版（无 section 的长文收尾）同样整版通栏
  await expect(page.locator('#newspaperStage .np-body .np-col-full')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

  // Going back returns to the catalog without errors.
  await page.locator('#newspaperClose').click();
  await expect(reader).not.toHaveClass(/open/);
  await expect(panel).toHaveClass(/open/);
  await page.locator('#newsstandClose').click();
  await expect(panel).not.toHaveClass(/open/);
});

test('newsstand hides empty pages and degrades to a single column on mobile', async ({ page }) => {
  test.setTimeout(120_000);
  await seedCityStorage(page, 'news-tester');
  stubNewsstandWebSocket(page);

  await page.goto('/');
  await page.waitForFunction(() => {
    const mini = (window as any).__mini?.();
    return !!mini?.player?.visible;
  }, undefined, { timeout: 30_000 });

  await page.evaluate(() => (window as any).__mini().interactBuilding('newsstand'));
  const panel = page.locator('#newsstandPanel');
  await expect(panel).toHaveClass(/open/);

  // Open a 2024 issue whose 社论呐喊 page is blank (content is「无」).
  const blankIssue = page.locator('#newsstandList .np-issue', { hasText: '2024.7.7' });
  await blankIssue.click();
  const reader = page.locator('#newspaperOverlay');
  await expect(reader).toHaveClass(/open/);
  await expect(page.locator('#newspaperMeta')).toContainText('星辉周刊 2024.7.7');

  // 第 5 版社论呐喊为空：整版显示占位提示而非空白
  const total = Number(await page.locator('#newspaperPageTotal').textContent());
  const nextBtn = page.locator('#newspaperNext');
  for (let index = 0; index < 4; index += 1) {
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();
  }
  await expect(page.locator('#newspaperPageNo')).toHaveText('5');
  await expect(page.locator('#newspaperStage .np-blank')).toBeVisible();
  await expect(page.locator('#newspaperStage .np-body')).not.toContainText('社论呐喊');
  await expect(page.locator('#newspaperPageTotal')).toHaveText(String(total));

  // 移动端视口：竖屏提示会拦截指针事件，改用 DOM 调用驱动；报纸保持单栏、无横向溢出
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    document.getElementById('newspaperClose')?.click();
    document.getElementById('newsstandClose')?.click();
  });
  await expect(reader).not.toHaveClass(/open/);
  await expect(panel).not.toHaveClass(/open/);
  await page.evaluate(() => (window as any).__mini().interactBuilding('newsstand'));
  await expect(panel).toHaveClass(/open/);
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll<HTMLElement>('.np-issue')).find((b) => b.textContent?.includes('2024.7.7'));
    button?.click();
  });
  await expect(reader).toHaveClass(/open/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.evaluate(() => document.getElementById('newspaperClose')?.click());
  await expect(reader).not.toHaveClass(/open/);
  await page.evaluate(() => document.getElementById('newsstandClose')?.click());
  await expect(panel).not.toHaveClass(/open/);
});

test('wild mushroom restaurant three-visit story unlocks both achievements', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    class MushroomGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      progress = {
        currency: 1200,
        inventory: {},
        achievements: ['citizen'],
        unlockedBuildings: ['writingclub_outer'],
        visitedBuildings: ['activity', 'library', 'writingclub_outer'],
      };
      catalog = { initialCurrency: 1200, buildingPrices: {}, achievementRewards: { citizen: 20 }, products: {} };
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      send(raw: string) {
        const request = JSON.parse(raw);
        let response: Record<string, unknown> | null = null;
        if (request.type === 'hello') {
          response = {
            type: 'hello', token: 'mushroom-token',
            user: { id: 'mushroom-user', nickname: 'mushroom-tester', email: null, position: { x: 0, y: 0, z: -6 } },
            players: [], houses: [], requests: [], progress: this.progress, catalog: this.catalog,
          };
        } else if (request.type === 'progress.building.visit') {
          response = { type: 'progress.updated', progress: this.progress, catalog: this.catalog, event: { type: 'building.visited', buildingId: request.buildingId } };
        }
        if (response) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new MushroomGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  });
  await seedCityStorage(page, 'mushroom-tester');
  await waitForCityBooted(page);

  const interact = () => page.evaluate(() => (window as any).__mini().interactBuilding('writingclub_outer'));
  const unlocked = () => page.evaluate(() => {
    const stats = JSON.parse(localStorage.getItem('minicityStats') || '{}') as { achievements?: string[] };
    return stats.achievements ?? [];
  });
  const pick = (label: string) => page.locator('.npc-opt').filter({ hasText: label }).click();

  // 首访：点火锅 → 3 个感叹号选项 → 烧城 → 镜子幻觉吐槽。
  await interact();
  await expect(page.locator('#npcLine')).toHaveText('老板招呼你坐下，锅里的汤咕嘟咕嘟地响。');
  await pick('一年总要吃两次野生菌火锅');
  await expect(page.locator('.npc-opt')).toHaveCount(3);
  await page.locator('.npc-opt').filter({ hasText: /^我要吃！$/ }).click();
  // 烧城动画约 6s（GSAP timeline），软件渲染下轮询等待 onDone 后的下一段对话。
  await expect(page.locator('#npcLine')).toContainText('这镜子一看就是真的', { timeout: 30_000 });
  await page.locator('#npcClose').click();
  await expect(page.locator('#npcOverlay')).not.toHaveClass(/open/);

  // 二访：预置一次访问 → 明知道还要吃 → 烧城 → 解锁「吃一堑再吃一堑」。
  await page.evaluate(() => localStorage.setItem('minicityWildMushroomVisits', '1'));
  await interact();
  await expect(page.locator('#npcLine')).toHaveText('上次被放倒的经历犹在眼前，你确定还要吃吗？');
  await page.locator('.npc-opt').first().click();
  await expect(page.locator('#npcLine')).toContainText('熟悉的幻觉又来了', { timeout: 30_000 });
  await expect.poll(() => unlocked(), { timeout: 10_000 }).toContain('wild_mushroom_stubborn');
  await page.locator('#npcClose').click();

  // 三访：预置两次访问 → 免责声明四连 → 上菜 → 烧城 → 解锁「真正的云南人」。
  await page.evaluate(() => localStorage.setItem('minicityWildMushroomVisits', '2'));
  await interact();
  await expect(page.locator('#npcLine')).toHaveText('不要再来吃了。');
  await page.locator('.npc-opt').first().click();
  await expect(page.locator('#npcLine')).toHaveText('再吃餐馆都要赔倒闭了。');
  await page.locator('.npc-opt').first().click();
  await expect(page.locator('#npcLine')).toHaveText('（你勾选了第一项）');
  await page.locator('.npc-opt').first().click();
  await expect(page.locator('#npcLine')).toHaveText('（你勾选了第二项）');
  await page.locator('.npc-opt').first().click();
  await expect(page.locator('#npcLine')).toHaveText('（你勾选了第三项）');
  await page.locator('.npc-opt').first().click();
  await expect(page.locator('#npcLine')).toContainText('真正的云南人，佩服佩服', { timeout: 30_000 });
  await expect.poll(() => unlocked(), { timeout: 10_000 }).toContain('wild_mushroom_local');
  await page.locator('#npcClose').click();

  // 四访：预置三次访问（剧情已用尽）→ 不再进入小剧情，回退到普通建筑弹窗。
  await page.evaluate(() => localStorage.setItem('minicityWildMushroomVisits', '3'));
  await interact();
  await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
  await expect(page.locator('#modalTitle')).toHaveText('野生菌餐馆');
  await expect(page.locator('#modalBody')).toContainText('门头挂着几串风干的菌子');
  await expect(page.locator('#npcOverlay')).not.toHaveClass(/open/);
  await page.locator('#modalClose').click();
  await expect(page.locator('#modalOverlay')).not.toHaveClass(/open/);
});
