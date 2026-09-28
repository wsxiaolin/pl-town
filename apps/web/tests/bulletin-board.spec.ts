import { expect, test, type Page } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

// The board is outbound navigation (bulletin.html in a new tab). These tests
// pin the popup-blocker contract the review flagged: the board's label is a
// real anchor, so the browser owns that navigation; an in-range 3D click
// opens the tab synchronously inside the click's activation window; and a
// walk-up arrival with no activation left degrades to a clickable toast
// instead of a dead window.open.

const BULLETIN_WORLD = { x: -4, z: -9 };

// Context-level so the freshly opened bulletin popups (label navigation,
// toast link) hit the mock feed too — a page.route would 502 them through
// the dev-server proxy.
function mockAnnouncements(context: import('@playwright/test').BrowserContext): Promise<void> {
  return context.route('**/town-api/announcements', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      source: 'live', cached: false,
      announcements: [
        { id: 'ann-1', subject: '版本更新 2.5.3', content: '修复了一些问题。', link: 'https://example.com/release-notes', linkText: '查看详情', start: '2026-07-01T00:00:00+00:00', finish: '2030-12-31T00:00:00+00:00', priority: 1, isAttendance: false },
        { id: 'ann-2', subject: '物理实验室讨论群', content: '加入讨论！', link: null, linkText: null, start: null, finish: null, priority: 0, isAttendance: false },
      ],
    }),
  }));
}

/** Projects a world position to canvas screen coordinates via the debug camera. */
async function projectToScreen(page: Page, x: number, y: number, z: number): Promise<{ cx: number; cy: number }> {
  return page.evaluate(({ x: wx, y: wy, z: wz }) => {
    const mini = (window as unknown as { _mini: { THREE: typeof import('three'); camera: import('three').Camera; scene: import('three').Scene } })._mini;
    const projected = new mini.THREE.Vector3(wx, wy, wz).project(mini.camera);
    const canvas = document.getElementById('c') as HTMLCanvasElement;
    return {
      cx: (projected.x * 0.5 + 0.5) * canvas.clientWidth,
      cy: (-projected.y * 0.5 + 0.5) * canvas.clientHeight,
    };
  }, { x, y, z });
}

test('the bulletin label is a real link that opens the announcement page in a new tab', async ({ page, context }) => {
  test.setTimeout(90_000);
  stubCityWebSocket(page, { user: 'bulletin-label-tester', unlockedBuildings: ['bulletin'] });
  await mockAnnouncements(context);
  await waitForCityReady(page, 'bulletin-label-tester');

  const label = page.locator('.b-label-item[data-building-id="bulletin"]');
  await expect(label).toHaveCount(1);
  await expect(label).toHaveAttribute('target', '_blank');
  await expect(label).toHaveAttribute('rel', 'noopener noreferrer');
  // Resolved (not literal) href — baseURI-relative resolution is what keeps
  // subpath deployments (GitHub Pages) pointing at the right file.
  const href = await label.evaluate((el) => (el as HTMLAnchorElement).href);
  expect(href).toBe(new URL('bulletin.html', page.url()).href);

  const popupPromise = context.waitForEvent('page', { timeout: 15_000 });
  // The label layer re-positions every frame (projected 3D → DOM transform),
  // so locator-level actions (click/focus) never pass the stability check.
  // Focus synchronously via the DOM API, then activate with a trusted Enter —
  // the a11y path the native anchor buys for free: the browser owns the
  // navigation, and a label still running the old preventDefault + window.open
  // branch would swallow Enter instead of opening the page.
  await label.evaluate((el) => el.focus());
  await page.keyboard.press('Enter');
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/bulletin\.html$/);
  await expect(popup.locator('.notice')).toHaveCount(2);
  await popup.close();
});

test('an in-range 3D click opens the page inside the activation window, and a blocked arrival degrades to the toast link', async ({ page, context }) => {
  test.setTimeout(150_000);
  stubCityWebSocket(page, { user: 'bulletin-click-tester', unlockedBuildings: ['bulletin'] });
  await mockAnnouncements(context);
  await waitForCityReady(page, 'bulletin-click-tester');

  await page.evaluate(({ bx, bz }) => {
    const mini = (window as unknown as { _mini: { player: import('three').Object3D } })._mini;
    // Stand well inside the interaction radius so the trusted click takes the
    // interact-now path rather than a walk.
    mini.player.position.set(bx, 0, bz + 2);
    // Keep the DOM label layer out of the way so the click lands on the 3D
    // board (the label has its own dedicated test above).
    document.getElementById('labelsWrap')!.style.display = 'none';
  }, { bx: BULLETIN_WORLD.x, bz: BULLETIN_WORLD.z });
  await page.waitForTimeout(500);

  const { cx, cy } = await projectToScreen(page, BULLETIN_WORLD.x, 1.2, BULLETIN_WORLD.z);
  const popupPromise = context.waitForEvent('page', { timeout: 15_000 });
  // A trusted input event: carries user activation for the synchronous
  // window.open inside navigateTo.
  await page.mouse.click(cx, cy);
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/bulletin\.html$/);
  await popup.close();

  // Now simulate what the popup blocker does to an arrival with no activation
  // left (a walk-up lands in navigateTo from the frame loop, e.g. via
  // _mini.interactBuilding): window.open returns null, and the opener must
  // fall back to the clickable toast. Swapping at runtime keeps the first
  // half of the test on the real window.open path.
  await page.evaluate(() => {
    (window as unknown as { __blockedOpens?: { url: string }[] }).__blockedOpens = [];
    window.open = (url: string | URL | undefined) => {
      const blocked = (window as unknown as { __blockedOpens?: { url: string }[] }).__blockedOpens ?? [];
      (window as unknown as { __blockedOpens?: { url: string }[] }).__blockedOpens = [...blocked, { url: String(url) }];
      return null;
    };
  });
  const triggered = await page.evaluate(() => (window as unknown as { _mini: { interactBuilding: (id: string) => boolean } })._mini.interactBuilding('bulletin'));
  expect(triggered).toBe(true);

  const blocked = await page.evaluate(() => (window as { __blockedOpens?: { url: string }[] }).__blockedOpens ?? []);
  expect(blocked).toHaveLength(1);
  expect(blocked[0].url).toContain('bulletin.html');

  // The fallback is a self-owned link bar (independent of the shared unlock
  // toast, whose achievement/event messages would otherwise hide the link);
  // clicking the link is a genuine gesture and the popup-blocker escape hatch.
  const fallbackLink = page.locator('.bulletin-fallback a');
  await expect(fallbackLink).toBeVisible({ timeout: 10_000 });
  await expect(fallbackLink).toHaveText('查看公告板');
  const href = await fallbackLink.evaluate((el) => (el as HTMLAnchorElement).href);
  expect(href).toBe(new URL('bulletin.html', page.url()).href);

  const fallbackPopupPromise = context.waitForEvent('page', { timeout: 15_000 });
  // The bar auto-dismisses after 10s, which can race a locator-level click's
  // actionability wait; a synchronous DOM click() still exercises the link's
  // real navigation semantics (target=_blank anchor).
  await fallbackLink.evaluate((el) => (el as HTMLAnchorElement).click());
  const fallbackPopup = await fallbackPopupPromise;
  await expect(fallbackPopup).toHaveURL(/bulletin\.html$/);
});
