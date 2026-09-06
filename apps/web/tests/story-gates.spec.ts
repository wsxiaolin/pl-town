import { expect, test } from '@playwright/test';
import { RENDER_SETTINGS, waitForCityBooted } from './helpers';

test('echo story entry stays suspended and the guide header stays hidden', async ({ page }) => {
  await page.addInitScript(({ settings }) => {
    localStorage.setItem('minicityCGSeenV3', 'true');
    localStorage.setItem('minicityUser', 'echo-gate-tester');
    localStorage.setItem('minicityRenderSettings', settings);
  }, { settings: RENDER_SETTINGS });
  await waitForCityBooted(page);

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
  await waitForCityBooted(page);

  // With 昨日之歌 active, clicking 林澈 (owned by the suspended echo story)
  // must be blocked by the mutual-exclusion gate and surface a toast.
  await page.evaluate(() => (window as any)._mini.interactNpc('linche'));
  await expect(page.locator('#utText')).toContainText('剧情正在进行中');
});
