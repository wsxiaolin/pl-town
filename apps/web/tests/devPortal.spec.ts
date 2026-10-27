import { expect, test } from '@playwright/test';

// `?dev` boots without the login gate and stays offline. Mirror
// firstPerson.spec.ts: stub WebSocket + seed the light render preset, then use
// the same generous software-GL boot budgets.
test.setTimeout(150_000);

async function enterDevPortal(page: import('@playwright/test').Page): Promise<void> {
  await page.addInitScript(() => {
    class OfflineWebSocket extends EventTarget {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readyState = OfflineWebSocket.CONNECTING;
      constructor() {
        super();
        queueMicrotask(() => {
          this.readyState = OfflineWebSocket.OPEN;
          this.dispatchEvent(new Event('open'));
        });
      }
      send() {}
      close() {
        this.readyState = OfflineWebSocket.CLOSED;
        this.dispatchEvent(new Event('close'));
      }
    }
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: OfflineWebSocket });
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'dev-portal-tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ resolution: 1, antialias: false, anisotropy: 1, shadows: false, exposure: 1.18 }));
  });
  await page.goto('/?dev');
  await page.waitForFunction(() => Boolean((window as any)._mini?.player), undefined, { timeout: 60_000 });
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 90_000 });
  await page.waitForTimeout(1_000);
}

test('dev portal shows the unlimited balance and doubles movement speed', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterDevPortal(page);

  expect(await page.evaluate(() => (window as any)._mini.playerSpeed)).toBeCloseTo(8.4, 5);

  await page.locator('#onlinePanelToggle').click({ force: true });
  await page.locator('[data-online-tab="inventory"]').dispatchEvent('click');
  await expect(page.locator('#onlineInventoryView')).toHaveClass(/active/);
  await expect(page.locator('[data-currency]')).toHaveText('999999999');
});

test('dev portal unlocks map teleport without the five-building requirement', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await enterDevPortal(page);
  const before = await page.evaluate(() => {
    const position = (window as any)._mini.player.position;
    return { x: position.x, z: position.z };
  });

  await page.locator('#mapToggle').click({ force: true });
  const search = page.locator('#mapSearchInput');
  await search.fill('图书馆');
  await expect(page.locator('.map-search-result').first()).toBeVisible();
  await search.press('Enter');
  await expect(page.locator('#mapTip')).toHaveClass(/open/);
  await expect(page.locator('#mapTipTitle')).toHaveText('图书馆');
  await expect(page.locator('#mapTipTele')).toBeEnabled();
  await page.locator('#mapTipTele').click();
  await expect(page.locator('#mapOverlay')).not.toHaveClass(/show/);

  const after = await page.evaluate(() => {
    const position = (window as any)._mini.player.position;
    return { x: position.x, z: position.z };
  });
  expect(after).not.toEqual(before);
});
