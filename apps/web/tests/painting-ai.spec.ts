import { expect, test } from '@playwright/test';
import { seedCityStorage, stubCityWebSocket, waitForCityBooted } from './helpers';

test('绘画+AI：确认快速学习 → 涂鸦 → 变形为小城简笔轮廓 → 收到表扬', async ({ page }) => {
  // SwiftShader 软渲染下主线程被 WebGL 帧循环占满，鼠标输入派发明显变慢，
  // 需要远大于默认 60s 的预算（涂鸦两笔 + 变形动画 + 自动收起 + toast）。
  test.setTimeout(180_000);
  await stubCityWebSocket(page, { unlockedBuildings: ['painting_ai'] });
  await seedCityStorage(page);
  await waitForCityBooted(page);

  await page.evaluate(() => (window as unknown as { _mini: { interactBuilding: (id: string) => boolean } })._mini.interactBuilding('painting_ai'));
  const npc = page.locator('#npcOverlay');
  await expect(npc).toHaveClass(/open/);
  await expect(page.locator('#npcLine')).toContainText('快速学习绘画');

  await page.locator('#npcOptions').getByRole('button', { name: '好呀，快速学！' }).click();
  const overlay = page.locator('#paintingOverlay');
  await expect(overlay).toHaveClass(/open/);

  // 在画布上随手涂两笔
  const box = await page.locator('#paintingCanvas').boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - box.width * 0.2, cy);
  await page.mouse.down();
  await page.mouse.move(cx + box.width * 0.2, cy + box.height * 0.12, { steps: 4 });
  await page.mouse.up();
  await page.mouse.move(cx, cy - box.height * 0.15);
  await page.mouse.down();
  await page.mouse.move(cx + box.width * 0.15, cy + box.height * 0.1, { steps: 4 });
  await page.mouse.up();

  await page.locator('#paintingDone').click();
  await expect(overlay).toHaveClass(/is-(morphing|done)/, { timeout: 10_000 });
  // 变形播完后画布自动收起，表扬 toast 随之出现。
  await expect(overlay).not.toHaveClass(/open/, { timeout: 15_000 });
  // 共享 toast 元素可能被并发成就提示覆盖（如深夜的「守夜人」），
  // 因此轮询确认表扬文案出现过，而不是断言瞬时文本。
  await page.waitForFunction(
    () => document.getElementById('utText')?.textContent?.includes('随便一画就是此等高度') === true,
    undefined,
    { timeout: 15_000 },
  );
});

test('绘画+AI：拒绝快速学习则只关闭对话、不弹画布', async ({ page }) => {
  await stubCityWebSocket(page, { unlockedBuildings: ['painting_ai'] });
  await seedCityStorage(page);
  await waitForCityBooted(page);

  await page.evaluate(() => (window as unknown as { _mini: { interactBuilding: (id: string) => boolean } })._mini.interactBuilding('painting_ai'));
  await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
  await page.locator('#npcOptions').getByRole('button', { name: '先不了，改天再来' }).click();
  await expect(page.locator('#npcOverlay')).not.toHaveClass(/open/);
  await expect(page.locator('#paintingOverlay')).not.toHaveClass(/open/);
});
