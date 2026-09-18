import { expect, test } from '@playwright/test';
import { RENDER_SETTINGS, seedCityStorage, stubNewsstandWebSocket, waitForCityBooted } from './helpers';

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

test('昨日之歌指引只做相机导航并需在报摊亲自推进', async ({ page }) => {
  const user = 'yesterday-guide-tester';
  stubNewsstandWebSocket(page, user);
  await seedCityStorage(page, user);
  await page.addInitScript(() => {
    // Resume 昨日之歌 at the "go find 秋嫂" beat so the guide is active.
    localStorage.setItem('minicityStory.side.yesterday.spring-1997.v1', JSON.stringify({
      storyId: 'side.yesterday.spring-1997',
      nodeId: 'diary-recognized',
      flags: {},
      visitCount: 1,
      updatedAt: 1,
    }));
  });
  await waitForCityBooted(page);

  const guide = page.locator('.echo-story-nav');
  await expect(guide).toBeVisible();
  await expect(guide).toContainText('报摊');

  // Clicking the HUD guide only pans the camera. It must NOT trigger the
  // newsstand interaction the player is meant to walk to in person.
  await guide.click();
  await expect(page.locator('#npcOverlay')).not.toHaveClass(/open/);

  // Only the in-person newsstand interaction advances the story to 秋嫂.
  await page.evaluate(() => (window as any)._mini.interactBuilding('newsstand'));
  await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
  await expect(page.locator('#npcName')).toHaveText('秋嫂');
});
