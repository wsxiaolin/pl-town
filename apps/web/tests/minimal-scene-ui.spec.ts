import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Use the production markup and styles without booting a WebGL scene.
  await page.route('**/src/main.ts', (route) => route.fulfill({
    contentType: 'application/javascript', body: 'import "/src/styles/index.css";',
  }));
  await page.goto('/');
});

test('minimal HUD hides the activity entry and ignores all open paths', async ({ page }) => {
  await page.route('**/core/sceneMode.ts*', (route) => route.fulfill({
    contentType: 'application/javascript', body: 'export const isMinimalScene = () => true;',
  }));
  const opened = await page.evaluate(async () => {
    const path = '/src/adapters/ui/activityPanelController.ts';
    const { createActivityPanelController } = await import(path) as typeof import('../src/adapters/ui/activityPanelController');
    const panel = createActivityPanelController({ document });
    panel.open();
    const afterOpen = panel.isOpen();
    panel.toggle();
    const afterToggle = panel.isOpen();
    document.getElementById('activityPanelToggle')!.click();
    return [afterOpen, afterToggle, panel.isOpen()];
  });
  expect(opened).toEqual([false, false, false]);
  await expect(page.locator('#activityPanelToggle')).toBeHidden();
  await expect(page.locator('#activityPanelToggle')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#activityPanelOverlay')).toBeHidden();
});

test('NPC navigation lists only destinations present in the scene', async ({ page }) => {
  await page.evaluate(async () => {
    const path = '/src/adapters/ui/cityDialogController.ts';
    const { createCityDialogController } = await import(path) as typeof import('../src/adapters/ui/cityDialogController');
    const controller = createCityDialogController({
      document, buildingContent: {}, getQuestAction: () => null,
      performQuestAction: () => { throw new Error('Unexpected quest action'); },
      pauseNpcs() {}, resumeNpcs() {}, onNpcInteracted() {}, showToast() {},
      hasNavigationTarget: (id) => id === 'archive',
    });
    controller.openNpc({
      profile: { id: 'guide', name: '向导', head: 0, body: 0, dialog: [{ text: '去哪？', options: [
        { text: '档案馆', action: 'teleport:archive', next: null },
        { text: '饭店', action: 'teleport:wushi_restaurant', next: null },
        { text: '告辞', next: null },
      ] }] },
      mesh: { rotation: { y: 0 }, position: { x: 0, z: 0 } },
    });
  });
  await expect(page.locator('#npcOptions button')).toHaveText(['档案馆', '告辞']);
});
