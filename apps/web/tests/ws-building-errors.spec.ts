import { expect, test } from '@playwright/test';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import { waitForCityReady } from './helpers';

test('authenticated building rejections display localized toasts and keep the resident connected', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const config: CityConfig = {
    schemaVersion: 1, version: 'ws-building-errors', initialBuiltBuildingIds: ['commons'],
    projects: [], personalPlots: [], decorations: [],
  };
  const state: CityState = {
    epoch: 'ws-building-errors', revision: 0, configVersion: config.version, projects: [], decorations: [],
  };
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    return route.fulfill({ status: 204, body: '' });
  });
  await page.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    let activeSocket: BuildingErrorSocket | null = null;
    class BuildingErrorSocket extends EventTarget {
      readyState: number = NativeWebSocket.CONNECTING;
      authorized = false;
      constructor() {
        super();
        activeSocket = this;
        queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); });
      }
      deliver(message: Record<string, unknown>) {
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
      send(raw: string) {
        const request = JSON.parse(raw) as { type: string };
        if (request.type !== 'hello') return;
        this.deliver({
          type: 'hello', token: 'building-error-token',
          user: { id: 'building-error-user', nickname: 'building-error-tester', position: { x: 0, y: 0, z: -6 } },
          players: [], houses: [], requests: [], weather: 'clear',
          progress: { currency: 0, inventory: {}, achievements: ['citizen'], unlockedBuildings: [], visitedBuildings: [] },
          catalog: { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} },
        });
        this.authorized = true;
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new BuildingErrorSocket() : Reflect.construct(Target, args); },
    }) });
    (window as unknown as { __rejectBuilding: (message: string) => void }).__rejectBuilding = (message) => {
      if (!activeSocket?.authorized || activeSocket.readyState !== NativeWebSocket.OPEN) throw new Error('Resident is not authenticated');
      activeSocket.deliver({ type: 'error', message });
    };
  });
  await waitForCityReady(page, 'building-error-tester');
  const connection = page.locator('#onlinePanelToggle');
  await expect(connection).toHaveClass(/connected/);
  await expect(page.locator('#loginOverlay')).not.toBeVisible();

  const cases = [
    ['Building is not built', '这栋建筑尚未建成，请前往众议院参与建设。'],
    ['Building is story-locked', '这栋建筑尚未通过剧情解锁。'],
    ['Building is locked', '这栋建筑尚未解锁。'],
    ['Building cannot be unlocked', 'Building cannot be unlocked'],
    ['toString', 'toString'],
  ] as const;
  for (const [message, expected] of cases) {
    await test.step(message, async () => {
      await page.evaluate((value) => (window as unknown as { __rejectBuilding: (message: string) => void }).__rejectBuilding(value), message);
      await expect(page.locator('#utText')).toHaveText(expected);
      await expect(page.locator('#unlockToast')).toHaveClass(/show/);
      await expect(connection).toHaveClass(/connected/);
      await expect(page.locator('#loginOverlay')).not.toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem('minicityServerToken'))).toBe('building-error-token');
    });
  }
  expect(errors).toEqual([]);
});
