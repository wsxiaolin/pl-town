import { expect, test, type Page } from '@playwright/test';
import { waitForCityReady } from './helpers';

type HelloRequest = { type: string; token?: string };
type RecoveryWindow = Window & {
  __recoveryHelloRequests: HelloRequest[];
  __disconnectResident: () => void;
};

/** Exercise MultiplayerClient's reconnect/hello handling, without emitting UI events. */
async function stubRejectedReconnect(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as RecoveryWindow;
    const NativeWebSocket = window.WebSocket;
    target.__recoveryHelloRequests = [];
    let activeSocket: RecoverySocket;
    class RecoverySocket extends EventTarget {
      readyState: number = NativeWebSocket.CONNECTING;
      progress = { currency: 1000, inventory: {}, achievements: ['citizen'], unlockedBuildings: ['commons'], visitedBuildings: ['commons'] };
      catalog = { initialCurrency: 1000, buildingPrices: {}, achievementRewards: {}, products: {} };
      constructor() {
        super();
        activeSocket = this;
        queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); });
      }
      send(raw: string) {
        const request = JSON.parse(raw) as HelloRequest;
        if (request.type !== 'hello') return;
        target.__recoveryHelloRequests.push(request);
        const attempt = target.__recoveryHelloRequests.length;
        const response = attempt === 2
          ? { type: 'error', message: '登录凭据已失效，请重新登录' }
          : {
            type: 'hello', token: `recovery-token-${attempt}`,
            user: { id: 'recovery-resident', nickname: 'recoveryResident', verified: false, position: { x: 0, y: 0, z: -6 } },
            players: [], houses: [], requests: [], progress: this.progress, catalog: this.catalog, weather: 'clear',
          };
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) })));
      }
      close() {
        if (this.readyState === NativeWebSocket.CLOSED) return;
        this.readyState = NativeWebSocket.CLOSED;
        this.dispatchEvent(new Event('close'));
      }
    }
    target.__disconnectResident = () => activeSocket.close();
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new RecoverySocket() : Reflect.construct(Target, args); },
    }) });
  });
}

test('a rejected WebSocket reconnect reopens the email/password overlay', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await stubRejectedReconnect(page);
  const config = { schemaVersion: 1, version: 'login-recovery', initialBuiltBuildingIds: ['commons'], projects: [], personalPlots: [], decorations: [] };
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: { epoch: 'recovery-epoch', revision: 0, configVersion: config.version, projects: [], decorations: [] } });
    if (path.endsWith('/city/votes')) return route.fulfill({ json: { epoch: 'recovery-epoch', projectIds: [] } });
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'recoveryResident');
  const login = page.locator('#loginOverlay');
  await expect(login).toBeHidden();
  await page.evaluate(() => {
    (window as any)._mini.interactBuilding('commons');
  });
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: '关闭', exact: true })).toBeFocused();
  await page.evaluate(() => (window as unknown as RecoveryWindow).__disconnectResident());
  // The real client waits for its reconnect timer, then sends the saved token.
  await expect.poll(() => page.evaluate(() => (window as unknown as RecoveryWindow).__recoveryHelloRequests.length), { timeout: 10_000 }).toBe(2);
  expect(await page.evaluate(() => (window as unknown as RecoveryWindow).__recoveryHelloRequests[1]?.token)).toBe('recovery-token-1');
  // The rejected token drops the session and re-opens the email/password gate.
  await expect(login).toBeVisible();
  await expect(panel).not.toBeVisible();
  await expect(page.locator('#loginError')).toHaveText('登录凭据已失效，请重新登录');
  await expect(page.locator('#loginEmail')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('minicityServerToken'))).toBeNull();
  expect(errors).toEqual([]);
});
