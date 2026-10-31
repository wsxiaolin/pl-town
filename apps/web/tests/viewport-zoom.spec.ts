import { expect, test } from '@playwright/test';
import { waitForCityReady } from './helpers';

test.describe('viewport zoom guard', () => {
  test('viewport meta forbids page scaling', async ({ page }) => {
    await waitForCityReady(page, 'zoom-meta');
    const content = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(content).toContain('user-scalable=no');
    expect(content).toContain('maximum-scale=1');
  });

  test('blocks pinch touchmove, iOS gesture events and ctrl+wheel, leaves plain input alone', async ({ page }) => {
    await waitForCityReady(page, 'zoom-guard');
    const result = await page.evaluate(() => {
      const finger = (id: number) =>
        new Touch({ identifier: id, target: document.body, clientX: 12 + id * 14, clientY: 16 });
      const dispatch = (event: Event) => {
        document.body.dispatchEvent(event);
        return event.defaultPrevented;
      };
      return {
        twoFingerTouchmove: dispatch(
          new TouchEvent('touchmove', { touches: [finger(1), finger(2)], cancelable: true, bubbles: true }),
        ),
        singleFingerTouchmove: dispatch(
          new TouchEvent('touchmove', { touches: [finger(3)], cancelable: true, bubbles: true }),
        ),
        gestureStart: dispatch(new Event('gesturestart', { cancelable: true, bubbles: true })),
        gestureChange: dispatch(new Event('gesturechange', { cancelable: true, bubbles: true })),
        ctrlWheel: dispatch(new WheelEvent('wheel', { ctrlKey: true, deltaY: -120, cancelable: true, bubbles: true })),
        plainWheel: dispatch(new WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true })),
      };
    });
    expect(result).toEqual({
      twoFingerTouchmove: true,
      singleFingerTouchmove: false,
      gestureStart: true,
      gestureChange: true,
      ctrlWheel: true,
      plainWheel: false,
    });
  });
});
