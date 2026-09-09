import { expect, test } from '@playwright/test';
import { RENDER_SETTINGS } from './helpers';

test('new resident tour highlights controls once and stays dismissed', async ({ page }) => {
  test.setTimeout(180_000);
  await page.addInitScript(({ settings }) => {
    const NativeWebSocket = window.WebSocket;
    // The tutorial opens once the signing overlay closes, which since the
    // verification gate happens on the `hello` success reply — so this stub
    // must confirm the resident instead of staying silent.
    class OfflineGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      send(raw: string) {
        const request = JSON.parse(raw) as { type: string; nickname?: string };
        if (request.type !== 'hello') return;
        queueMicrotask(() => {
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({
            type: 'hello', token: 'tour-token',
            user: { id: 'tour-user', nickname: request.nickname, email: null, position: { x: 0, y: 0, z: -6 } },
            players: [], houses: [], requests: [],
            progress: { currency: 0, inventory: {}, achievements: [], unlockedBuildings: [], visitedBuildings: [] },
            catalog: { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} },
          }) }));
        });
      }
      close() { this.readyState = NativeWebSocket.CLOSED; }
    }
    Object.defineProperty(window, 'WebSocket', {
      configurable: true,
      value: new Proxy(NativeWebSocket, {
        construct(Target, args) {
          return String(args[0]).includes(':8787') ? new OfflineGameWebSocket() : Reflect.construct(Target, args);
        },
      }),
    });
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityRenderSettings', settings);
  }, { settings: RENDER_SETTINGS });
  await page.goto('/', { timeout: 60_000, waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean((window as any)._mini), undefined, { timeout: 90_000 });
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 90_000 });

  await expect(page.locator('#loginOverlay')).toBeVisible();
  await page.locator('#loginInput').fill('touruser');
  await page.locator('#loginPassword').fill('tour-pass');
  await page.locator('#loginBtn').click();

  const overlay = page.locator('#tutorialOverlay');
  await expect(overlay).toHaveClass(/open/, { timeout: 20_000 });
  await expect(page.locator('#tutorialTitle')).toHaveText('先学会走路');

  await page.locator('#tutorialNext').click();
  await expect(page.locator('#tutorialTitle')).toHaveText('打开地图看看');
  await page.locator('#tutorialNext').click();
  await expect(page.locator('#mapOverlay')).toHaveClass(/show/, { timeout: 5_000 });
  await expect(page.locator('#tutorialTitle')).toHaveText('你的生活入口', { timeout: 8_000 });
  await expect(page.locator('#mapOverlay')).not.toHaveClass(/show/);

  await page.locator('#tutorialNext').click();
  await expect(page.locator('#onlinePanel')).toHaveClass(/open/, { timeout: 5_000 });
  await expect(page.locator('#tutorialTitle')).toHaveText('签下你的名字', { timeout: 8_000 });
  await expect(page.locator('#onlinePanel')).not.toHaveClass(/open/);

  await page.locator('#tutorialNext').click();
  await expect(overlay).toBeHidden();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('minicity.tutorial.v1'))).toBe('done');
  await expect(page.locator('#mapOverlay')).not.toHaveClass(/show/);
  await expect(page.locator('#onlinePanel')).not.toHaveClass(/open/);
  await expect(page.locator('#loginOverlay')).toBeHidden();

  await page.reload({ timeout: 60_000, waitUntil: 'commit' });
  await page.waitForFunction(() => Boolean((window as any)._mini), undefined, { timeout: 90_000 });
  await expect(overlay).toBeHidden();
  await expect.poll(async () => page.evaluate(() => localStorage.getItem('minicity.tutorial.v1'))).toBe('done');
});
