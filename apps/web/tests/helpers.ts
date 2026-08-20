import { expect, type Page } from '@playwright/test';

// Shared default localStorage seed used by the smoke + movement suites. The CG
// intro is skipped, a stable resident identity is set, and the renderer is put
// into the cheapest software-GL-friendly preset so tests stay fast on CI.
export const RENDER_SETTINGS = JSON.stringify({
  resolution: 1,
  antialias: false,
  anisotropy: 1,
  shadows: false,
  exposure: 1.18,
});

/**
 * Seed the default city localStorage (CG skipped, resident identity, cheap
 * render preset). Call any WebSocket-stubbing `page.addInitScript` *before*
 * this, then `await page.goto('/')` and `await waitForCityBooted(page)`.
 */
export async function seedCityStorage(page: Page, user = 'tester'): Promise<void> {
  await page.addInitScript(({ settings, u }) => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', u);
    localStorage.setItem('minicityRenderSettings', settings);
  }, { settings: RENDER_SETTINGS, u: user });
}

/**
 * Navigate to the city and wait until the Three.js scene is booted enough for
 * interactions: the debug API + player cursor exist and the boot screen reports
 * ready. Without this, UI controllers (phone, render settings, building
 * interaction) are not yet wired up when a test clicks, which is flaky on
 * software-GL runners where boot takes noticeably longer than on a real GPU.
 */
export async function waitForCityBooted(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any)._mini?.player), undefined, { timeout: 30_000 });
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 30_000 });
  // The boot-screen first-paint shell fades out over ~0.7s after is-ready is
  // applied. Clicking a top-bar control during that window can be swallowed by
  // the still-visible shell / overlapping canvas on software-GL runners, so
  // wait for the fade to settle before returning control to the test.
  await page.waitForTimeout(1_000);
}

/** Convenience: seed defaults, navigate, and wait for boot in one call. */
export async function waitForCityReady(page: Page, user = 'tester'): Promise<void> {
  await seedCityStorage(page, user);
  await waitForCityBooted(page);
}

/**
 * Stub the game WebSocket for newsstand tests: answers `hello` with a resident
 * who has already visited the 报摊, so `interactBuilding('newsstand')` opens
 * the catalog without any server round-trips.
 */
export function stubNewsstandWebSocket(page: Page, user = 'news-tester', weather = 'clear'): void {
  void page.addInitScript(({ u, w }) => {
    const NativeWebSocket = window.WebSocket;
    class NewsGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      progress = {
        currency: 0,
        inventory: {},
        achievements: ['citizen'],
        unlockedBuildings: ['newsstand'],
        visitedBuildings: ['activity', 'library', 'newsstand'],
      };
      catalog = { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} };
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      send(raw: string) {
        const request = JSON.parse(raw);
        let response: Record<string, unknown> | null = null;
        if (request.type === 'hello') {
          response = {
            type: 'hello', token: 'news-token',
            user: { id: 'news-user', nickname: u, email: null, position: { x: 0, y: 0, z: -6 } },
            players: [], houses: [], requests: [], progress: this.progress, catalog: this.catalog, weather: w,
          };
        } else if (request.type === 'progress.building.visit') {
          response = { type: 'progress.updated', progress: this.progress, catalog: this.catalog, event: { type: 'building.visited', buildingId: request.buildingId } };
        }
        if (response) queueMicrotask(() => {
          this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(response) }));
          if (request.type === 'hello' && w !== 'clear') this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'world.weather', weather: w }) }));
        });
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new NewsGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  }, { u: user, w: weather });
}
