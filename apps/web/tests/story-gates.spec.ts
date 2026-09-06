import { expect, test } from '@playwright/test';
import { RENDER_SETTINGS } from './helpers';

async function waitForStoryGateCityBooted(page: import('@playwright/test').Page): Promise<void> {
  // Telemetry waits on the optional local API server. The gate tests only need
  // the client city, so continue once its document and debug API are ready.
  await page.goto('/', { waitUntil: 'commit', timeout: 5_000 }).catch(() => undefined);
  await page.waitForFunction(() => Boolean((window as any)._mini?.player), undefined, { timeout: 30_000 });
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 30_000 });
  await page.waitForTimeout(1_000);
}

test('echo story entry stays suspended and the guide header stays hidden', async ({ page }) => {
  await page.addInitScript(({ settings }) => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'echo-gate-tester');
    localStorage.setItem('minicityRenderSettings', settings);
  }, { settings: RENDER_SETTINGS });
  await waitForStoryGateCityBooted(page);

  // A fresh save never entered the echo story, so the suspended-story guide
  // header must stay hidden instead of floating over the city.
  await expect(page.locator('.echo-story-nav')).toBeHidden();

  // Clicking 林澈 only surfaces the suspension notice; the story stays
  // untouched and the guide header stays hidden afterwards.
  await page.evaluate(() => (window as any)._mini.interactNpc('linche'));
  await expect(page.locator('#utText')).toContainText('回声');
  await expect(page.locator('.echo-story-nav')).toBeHidden();
});

test('an in-progress story locks other story entries with a toast', async ({ page }) => {
  await page.addInitScript(({ settings }) => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'mutex-tester');
    localStorage.setItem('minicityRenderSettings', settings);
    // Resume 昨日之歌 mid-story so its phase is "active".
    localStorage.setItem('minicityStory.side.yesterday.spring-1997.v1', JSON.stringify({
      storyId: 'side.yesterday.spring-1997',
      nodeId: 'diary-recognized',
      flags: {},
      visitCount: 1,
      updatedAt: 1,
    }));
  }, { settings: RENDER_SETTINGS });
  await waitForStoryGateCityBooted(page);

  // With 昨日之歌 active, clicking 林澈 (owned by the suspended echo story)
  // must be blocked by the mutual-exclusion gate and surface a toast.
  await page.evaluate(() => (window as any)._mini.interactNpc('linche'));
  await expect(page.locator('#utText')).toContainText('剧情正在进行中');
});
