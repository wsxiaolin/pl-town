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
    // Spec boots must take the light path: the heavy pipeline (45 MB download
    // + shader precompile behind SwiftShader) is its own dedicated test and
    // would blow every other spec's timeout budget.
    // addInitScript re-runs on EVERY navigation. A spec that needs the gate
    // to decide from the real markers (e.g. boot-gate's marker round trip)
    // sets sessionStorage 'disableBootSeed' = '1' — same-tab storage, so the
    // seeding stops from that navigation on.
    if (sessionStorage.getItem('disableBootSeed') !== '1') {
      localStorage.setItem('minicityForceBoot', 'light');
    }
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
  // 60s, aligned with the repo's other boot budgets (boot-gate uses 60s for
  // is-ready, smoke/movement use 60–190s): on soft-GL CI runners the heavy
  // pipeline (download + shader precompile) routinely blows past 30s, and a
  // budget cut to the bone here only produces the next flake (#201 S3).
  await page.waitForFunction(() => Boolean((window as any)._mini?.player), undefined, { timeout: 60_000 });
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 60_000 });
  // The boot-screen first-paint shell fades out over ~0.7s after is-ready is
  // applied. Clicking a top-bar control during that window can be swallowed by
  // the still-visible shell / overlapping canvas on software-GL runners, so
  // wait for the fade to settle before returning control to the test.
  await page.waitForTimeout(1_000);
}

/**
 * Wait for the boot-time map atlas preload to settle: both district pages
 * (主城 main + 星语北城 north) have their snapshot captured. Map specs that
 * count WebGL contexts must call this before opening the map — the preload is
 * scheduled off the boot critical path (idle callback + 2.5s fallback timer)
 * and a late-landing north capture mid-test would otherwise read as an
 * unexpected context in the assertions.
 */
export async function waitForMapShotsPreloaded(page: Page, timeout = 20_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const shots = (window as { _mini?: { mapShotsReady?: () => { main: boolean; north: boolean } } })._mini?.mapShotsReady?.();
      return Boolean(shots?.main && shots?.north);
    },
    undefined,
    { timeout },
  );
}

/** Convenience: seed defaults, navigate, and wait for boot in one call. */
export async function waitForCityReady(page: Page, user = 'tester'): Promise<void> {
  await seedCityStorage(page, user);
  await waitForCityBooted(page);
}

/**
 * Stub the game WebSocket with a connected resident who has already unlocked the
 * given buildings. Answers `hello` and `progress.building.visit`, so
 * `interactBuilding(...)` opens the matching panel without server round-trips.
 */
export function stubCityWebSocket(
  page: Page,
  options: { user?: string; weather?: string; unlockedBuildings?: readonly string[] } = {},
): void {
  const user = options.user ?? 'tester';
  const weather = options.weather ?? 'clear';
  const unlockedBuildings = options.unlockedBuildings ?? ['newsstand'];
  void page.addInitScript(({ u, w, unlocked }) => {
    const NativeWebSocket = window.WebSocket;
    const sockets: StubGameWebSocket[] = [];
    class StubGameWebSocket extends EventTarget {
      readyState: number = NativeWebSocket.CONNECTING;
      progress = {
        currency: 0,
        inventory: {},
        achievements: ['citizen'],
        unlockedBuildings: unlocked,
        visitedBuildings: ['activity', 'library', ...unlocked],
      };
      catalog = { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} };
      constructor() { super(); sockets.push(this); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      send(raw: string) {
        const request = JSON.parse(raw);
        let response: Record<string, unknown> | null = null;
        if (request.type === 'hello') {
          response = {
            type: 'hello', token: 'stub-token',
            user: { id: 'stub-user', nickname: u, email: null, position: { x: 0, y: 0, z: -6 } },
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
    (window as unknown as { __pushCityState: (state: unknown) => void }).__pushCityState = (state) => {
      for (const socket of sockets) {
        if (socket.readyState === NativeWebSocket.OPEN) socket.dispatchEvent(new MessageEvent('message', { data: JSON.stringify({ type: 'city.updated', state }) }));
      }
    };
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) { return String(args[0]).includes(':8787') ? new StubGameWebSocket() : Reflect.construct(Target, args); },
    }) });
  }, { u: user, w: weather, unlocked: [...unlockedBuildings] });
}

/** Deliver a city update through the same WebSocket listener as server broadcasts. */
export async function pushCityState(page: Page, state: unknown): Promise<void> {
  await page.evaluate((next) => (window as unknown as { __pushCityState: (state: unknown) => void }).__pushCityState(next), state);
}

/**
 * Stub the game WebSocket for newsstand tests: answers `hello` with a resident
 * who has already visited the 报摊, so `interactBuilding('newsstand')` opens
 * the catalog without any server round-trips.
 */
export function stubNewsstandWebSocket(page: Page, user = 'news-tester', weather = 'clear'): void {
  stubCityWebSocket(page, { user, weather, unlockedBuildings: ['newsstand'] });
}

/**
 * Stub the game WebSocket and expose `window.__pushWorldCatalog(catalog)` so a
 * test can simulate the server broadcasting a `world.catalog` override to an
 * already-connected resident (admin globally unlocking a building live).
 */
export function stubWorldCatalogWebSocket(page: Page, user = 'catalog-tester'): void {
  void page.addInitScript((u) => {
    const NativeWebSocket = window.WebSocket;
    class CatalogGameWebSocket extends EventTarget {
      readyState: number = NativeWebSocket.CONNECTING;
      progress = {
        currency: 0,
        inventory: {},
        achievements: ['citizen'],
        unlockedBuildings: [],
        visitedBuildings: [],
      };
      catalog = {
        initialCurrency: 0,
        buildingPrices: {},
        buildingUnlockable: {},
        globallyUnlockedBuildings: [],
        achievementRewards: {},
        products: {},
      };
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      deliver(message: Record<string, unknown>) {
        this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) }));
      }
      send(raw: string) {
        const request = JSON.parse(raw);
        if (request.type === 'hello') {
          this.deliver({
            type: 'hello', token: 'catalog-token',
            user: { id: 'catalog-user', nickname: u, email: null, position: { x: 0, y: 0, z: -6 } },
            players: [], houses: [], requests: [], progress: this.progress, catalog: this.catalog, weather: 'clear',
          });
        } else if (request.type === 'progress.building.visit') {
          this.deliver({
            type: 'progress.updated', progress: this.progress, catalog: this.catalog,
            event: { type: 'building.visited', buildingId: request.buildingId },
          });
        }
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    const sockets: CatalogGameWebSocket[] = [];
    (window as unknown as { __pushWorldCatalog: (catalog: Record<string, unknown>) => void }).__pushWorldCatalog = (catalog) => {
      sockets.forEach((socket) => socket.deliver({ type: 'world.catalog', catalog }));
    };
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) {
        if (!String(args[0]).includes(':8787')) return Reflect.construct(Target, args);
        const socket = new CatalogGameWebSocket();
        sockets.push(socket);
        return socket;
      },
    }) });
  }, user);
}
