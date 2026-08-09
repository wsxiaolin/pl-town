import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

test('resident phone opens the live public archive', async ({ page }) => {
  await page.route('**/town-api/works?scope=knowledge', async (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ source: 'live', cached: false, works: [
      { id: '6a77266b7669b917e571ed46', title: 'Precision resistance meter', category: 'Experiment', author: 'Lab volunteer', authorId: 'user-1', verification: 'Volunteer', tags: ['knowledge', 'circuit'], imageUrl: '', createdAt: 1786193515183, visits: 83, stars: 12, comments: 4, remixes: 2 },
    ] }),
  }));
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  });
  await page.goto('/');
  await page.locator('#onlinePanelToggle').click({ force: true });
  await page.locator('[data-online-tab="archive"]').click();
  await expect(page.locator('#onlineArchiveView')).toHaveClass(/active/);
  await page.locator('#phoneKnowledge').click();
  await expect(page.locator('#worksPanel')).toHaveClass(/open/);
  await expect(page.locator('.work-record h3')).toHaveText('Precision resistance meter');
  await expect(page.locator('#worksSummary')).toContainText('1 of 1 records');
  await page.locator('.work-record').click();
  await expect(page.locator('#workDetailPanel')).toHaveClass(/open/);
  await expect(page.locator('#workDetailTitle')).toHaveText('Precision resistance meter');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
});

test('Physics Lab social terminal renders proxied profile data', async ({ page }) => {
  await page.route('**/town-api/pl/social?kind=profile', route => route.fulfill({ contentType:'application/json', body:JSON.stringify({ kind:'profile', data:{ User:{ Nickname:'CircuitFox', Verification:'Volunteer', Level:25 }, Statistic:{ ExperimentCount:18, FollowerCount:42, FollowingCount:9 } } }) }));
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV3','true'); localStorage.setItem('minicityUser','tester'); localStorage.setItem('plSession','test-session');
    localStorage.setItem('minicityRenderSettings',JSON.stringify({resolution:1,antialias:false,anisotropy:1,shadows:false,exposure:1.18}));
  });
  await page.goto('/');
  await page.locator('#onlinePanelToggle').click({force:true});
  await page.locator('[data-online-tab="social"]').click();
  await page.locator('[data-pl-social="profile"]').click();
  await expect(page.locator('.social-profile>strong')).toHaveText('CircuitFox');
  await expect(page.locator('.social-profile')).toContainText('Volunteer');
  await expect(page.locator('.social-profile')).toContainText('18 作品');
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
      readyState = NativeWebSocket.CONNECTING;
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
