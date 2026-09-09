import { expect, type Page, test } from '@playwright/test';
import { RENDER_SETTINGS } from './helpers';

/**
 * Pl-verification gate: a fresh sign-in must stay on the signing overlay until
 * the server confirms the resident. When the nickname belongs to a Physics Lab
 * account, the ownership-verification fields appear in place; the city only
 * opens after the verification handshake succeeds.
 *
 * The multiplayer socket is stubbed at the WebSocket constructor level (same
 * pattern as stubNewsstandWebSocket); the scripted response depends on
 * `window.__gateStage`, which each test sets before submitting.
 */
type GateStage = 'verify' | 'ok';

function stubGateWebSocket(page: Page): void {
  void page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    class GateGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      progress = { currency: 0, inventory: {}, achievements: [], unlockedBuildings: [], visitedBuildings: [] };
      catalog = { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} };
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      send(raw: string) {
        const request = JSON.parse(raw) as { type: string; nickname?: string };
        if (request.type !== 'hello') return;
        const stage = (window as unknown as { __gateStage?: GateStage }).__gateStage;
        queueMicrotask(() => {
          if (stage === 'verify') {
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'error', message: '这个昵称已属于物实社区，请验证所属权', code: 'pl-verification-required' }) }));
            return;
          }
          if (stage === 'ok') {
            this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'hello', token: 'gate-token', user: { id: 'gate-user', nickname: request.nickname, email: null, position: { x: 0, y: 0, z: -6 } }, players: [], houses: [], requests: [], progress: this.progress, catalog: this.catalog }) }));
          }
        });
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new GateGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  });
}

/** Stub whose socket dies before opening: exercises the connection-lost branch. */
function stubDeadWebSocket(page: Page): void {
  void page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    class DeadWebSocket extends EventTarget {
      readyState = NativeWebSocket.CLOSED;
      constructor() { super(); queueMicrotask(() => { this.dispatchEvent(new Event('close')); }); }
      send() {}
      close() {}
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new DeadWebSocket() : Reflect.construct(Target, args); },
    }) });
  });
}

/** Skip the CG intro and renderer heaviness, but keep the visitor unsigned-in. */
async function seedVisitorStorage(page: Page): Promise<void> {
  await page.addInitScript((settings) => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityRenderSettings', settings);
  }, RENDER_SETTINGS);
}

async function openSigningOverlay(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('#loginOverlay')).toBeVisible({ timeout: 30_000 });
}

test.describe('Physics Lab verification gate', () => {
  test('requires ownership verification before entering the city', async ({ page }) => {
    stubGateWebSocket(page);
    await seedVisitorStorage(page);
    await openSigningOverlay(page);
    await page.evaluate(() => { (window as unknown as { __gateStage?: GateStage }).__gateStage = 'verify'; });

    await page.locator('#loginInput').fill('故事里的人');
    await page.locator('#loginPassword').fill('a-very-long-password');
    await page.locator('#loginBtn').click();

    const verifySection = page.locator('#plVerifySection');
    await expect(verifySection).toBeVisible();
    await expect(page.locator('#loginError')).toContainText('物实');
    const button = page.locator('#loginBtn');
    await expect(button).toBeEnabled();
    await expect(page.locator('#loginOverlay')).toBeVisible();
    await expect(page.locator('#loginInput')).toHaveValue('故事里的人');

    // Editing the nickname invalidates the verification request.
    await page.locator('#loginInput').fill('另一个名字');
    await expect(verifySection).toBeHidden();
    await page.locator('#loginInput').fill('故事里的人');
  });

  test('enters the city only after the verification succeeds', async ({ page }) => {
    stubGateWebSocket(page);
    await seedVisitorStorage(page);
    await openSigningOverlay(page);
    await page.evaluate(() => { (window as unknown as { __gateStage?: GateStage }).__gateStage = 'verify'; });

    await page.locator('#loginInput').fill('故事里的人');
    await page.locator('#loginPassword').fill('a-very-long-password');
    await page.locator('#loginBtn').click();
    await expect(page.locator('#plVerifySection')).toBeVisible();

    await page.evaluate(() => { (window as unknown as { __gateStage?: GateStage }).__gateStage = 'ok'; });
    await page.locator('#plLoginInput').fill('story@example.com');
    await page.locator('#plPasswordInput').fill('pl-secret');
    await page.locator('#loginBtn').click();

    await expect(page.locator('#loginOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#logoUser')).toContainText('故事里的人');
  });

  test('signs straight in when no verification is required', async ({ page }) => {
    stubGateWebSocket(page);
    await seedVisitorStorage(page);
    await openSigningOverlay(page);
    await page.evaluate(() => { (window as unknown as { __gateStage?: GateStage }).__gateStage = 'ok'; });

    await page.locator('#loginInput').fill('自由居民');
    await page.locator('#loginPassword').fill('a-very-long-password');
    await page.locator('#loginBtn').click();

    await expect(page.locator('#loginOverlay')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('#logoUser')).toContainText('自由居民');
  });

  test('connection failure keeps the visitor on the signing overlay', async ({ page }) => {
    stubDeadWebSocket(page);
    await seedVisitorStorage(page);
    await openSigningOverlay(page);

    await page.locator('#loginInput').fill('故事里的人');
    await page.locator('#loginPassword').fill('a-very-long-password');
    await page.locator('#loginBtn').click();

    await expect(page.locator('#loginError')).toContainText('暂时无法连接小城服务器');
    await expect(page.locator('#loginBtn')).toBeEnabled();
    await expect(page.locator('#loginOverlay')).toBeVisible();
  });
});
