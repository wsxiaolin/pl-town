import { expect, test } from '@playwright/test';

test.use({ headless: true, launchOptions: { args: ['--no-sandbox', '--disable-gpu'] } });

test('tutorial phone preview survives the originating click bubbling', async ({ page }) => {
  await page.route('**/tutorial-event-fixture', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<div id="tutorialOverlay" hidden><div id="tutorialCard">
      <span id="tutorialTitle"></span><button id="tutorialNext">Next</button>
      </div></div><button id="onlinePanelToggle">Phone</button>
      <aside id="onlinePanel" class="phone"></aside>`,
  }));
  await page.goto('/tutorial-event-fixture');
  await page.evaluate(async () => {
    const modulePath = '/src/adapters/ui/onboardingTutorialController.ts';
    const { createOnboardingTutorialController } = await import(modulePath);
    const panel = document.getElementById('onlinePanel')!;
    const toggle = document.getElementById('onlinePanelToggle')!;
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      panel.classList.toggle('open');
    });
    document.addEventListener('click', (event) => {
      if (!panel.contains(event.target as Node) && !toggle.contains(event.target as Node)) {
        panel.classList.remove('open');
      }
    });
    const controller = createOnboardingTutorialController({
      document, signal: new AbortController().signal,
    });
    controller.start(true);
    controller.next();
    controller.next();
  });
  await expect(page.locator('#tutorialTitle')).toHaveText('你的生活入口');
  await page.locator('#tutorialNext').click();
  await expect(page.locator('#onlinePanel')).toHaveClass(/open/);
  await expect(page.locator('#tutorialTitle')).toHaveText('签下你的名字');
  await expect(page.locator('#onlinePanel')).not.toHaveClass(/open/);
});
