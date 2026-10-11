import { expect, type Page, test } from '@playwright/test';
import { RENDER_SETTINGS } from './helpers';

/**
 * Account lifecycle: registration/login happens over HTTP before the city
 * assets download; the display name is signed on the 居民证 after the download
 * completes. The multiplayer socket is stubbed at the WebSocket constructor
 * level so entering the city never reaches a real server.
 */
function stubGateWebSocket(page: Page): void {
  void page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    class GateGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      progress = { currency: 0, inventory: {}, achievements: [], unlockedBuildings: [], visitedBuildings: [] };
      catalog = { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} };
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      send(raw: string) {
        const request = JSON.parse(raw) as { type: string; token?: string };
        if (request.type !== 'hello') return;
        const nickname = (window as unknown as { __residentName?: string }).__residentName ?? 'tester';
        queueMicrotask(() => {
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'hello', token: 'gate-token', user: { id: 'gate-user', nickname, verified: false, position: { x: 0, y: 0, z: -6 } }, players: [], houses: [], requests: [], progress: this.progress, catalog: this.catalog }) }));
        });
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new GateGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  });
}

/** Skip the CG intro and renderer heaviness, but keep the visitor signed out. */
async function seedVisitorStorage(page: Page): Promise<void> {
  await page.addInitScript((settings) => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityRenderSettings', settings);
  }, RENDER_SETTINGS);
}

/** Mock the email/password account endpoints. */
async function mockAccountApi(page: Page, options: { existingName?: string; failLogin?: boolean } = {}): Promise<void> {
  await page.route('**/town-api/account/login', (route) => {
    if (options.failLogin) return route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: '邮箱或密码不正确' }) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'gate-token', user: { id: 'gate-user', nickname: options.existingName ?? '', email: 'story@example.com', verified: false, position: { x: 0, y: 0, z: -6 } } }) });
  });
  await page.route('**/town-api/account/name', (route) => {
    const body = route.request().postDataJSON() as { name?: string };
    const name = body?.name ?? 'tester';
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'gate-user', nickname: name, verified: false } }) });
  });
}

test.describe('account lifecycle', () => {
  test('requires an email and password before downloading the city', async ({ page }) => {
    stubGateWebSocket(page);
    await seedVisitorStorage(page);
    await mockAccountApi(page);
    await page.goto('/');
    await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 30_000 });

    // Empty credentials are rejected client-side.
    await page.locator('#loginBtn').click({ force: true });
    await expect(page.locator('#loginError')).toHaveText('请输入邮箱。');

    await page.locator('#loginEmail').fill('story@example.com');
    await page.locator('#loginBtn').click({ force: true });
    await expect(page.locator('#loginError')).toHaveText('请输入密码。');
  });

  test('signs the 居民证 after download, then enters the city', async ({ page }) => {
    stubGateWebSocket(page);
    await seedVisitorStorage(page);
    await mockAccountApi(page);
    await page.goto('/');
    await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 30_000 });

    await page.locator('#loginEmail').fill('story@example.com');
    await page.locator('#loginPassword').fill('a-very-long-password');
    await page.evaluate(() => { (window as unknown as { __residentName?: string }).__residentName = '故事里的人'; });
    await page.locator('#loginBtn').click({ force: true });

    // The login overlay closes and the 居民证 appears once the city finished
    // downloading.
    await expect(page.locator('#loginOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#residentCardOverlay')).toBeVisible({ timeout: 60_000 });

    await page.locator('#residentCardName').fill('故事里的人');
    await page.locator('#residentCardSign').click();
    await expect(page.locator('#residentCardOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#logoUser')).toContainText('故事里的人');
    await expect(page.locator('#logoUser .verified-badge')).toHaveCount(0);
  });

  test('a stored token skips the login overlay', async ({ page }) => {
    stubGateWebSocket(page);
    await page.addInitScript((settings) => {
      localStorage.setItem('minicityCGSeenV3', 'true');
      localStorage.setItem('minicityRenderSettings', settings);
      localStorage.setItem('minicityServerToken', 'gate-token');
      localStorage.setItem('minicityUser', '老居民');
      (window as unknown as { __residentName?: string }).__residentName = '老居民';
    }, RENDER_SETTINGS);
    await page.goto('/');
    await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 60_000 });
    await expect(page.locator('#loginOverlay')).toBeHidden();
    await expect(page.locator('#logoUser')).toContainText('老居民');
  });

  test('a rejected login keeps the overlay open with an error', async ({ page }) => {
    stubGateWebSocket(page);
    await seedVisitorStorage(page);
    await mockAccountApi(page, { failLogin: true });
    await page.goto('/');
    await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 30_000 });

    await page.locator('#loginEmail').fill('story@example.com');
    await page.locator('#loginPassword').fill('wrong-password');
    await page.locator('#loginBtn').click({ force: true });
    await expect(page.locator('#loginError')).toHaveText('邮箱或密码不正确');
    await expect(page.locator('#loginOverlay')).toBeVisible();
  });
});
