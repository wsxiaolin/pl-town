import { expect, test } from '@playwright/test';
import { seedCityStorage, stubCityWebSocket, waitForCityBooted } from './helpers';

// The product requires landscape on phones; portrait shows the rotation prompt.
for (const viewport of [{ width: 1280, height: 800 }, { width: 660, height: 390 }]) {
  test(`grass and sea render at near and far views (${viewport.width})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    stubCityWebSocket(page);
    await seedCityStorage(page);
    await page.clock.setFixedTime(new Date('2026-10-07T00:12:00Z'));
    await waitForCityBooted(page);
    const grassCount = await page.evaluate(() => {
      const mini = (window as any)._mini;
      let count = 0;
      mini.scene.traverse((object: any) => {
        if (object.userData.cityGrass) count += object.count;
      });
      return count;
    });
    expect(grassCount).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => {
      let loaded = false;
      (window as any)._mini.scene.traverse((object: any) => {
        const map = object.material?.map;
        if (map?.name === 'generated_ground4' && map.image?.naturalWidth > 0) loaded = true;
      });
      return loaded;
    })).toBe(true);
    for (const [x, z, zoom] of [[24, 24, 6], [-42, 0, 10], [0, 0, 21]]) {
      const frame = await page.evaluate(([x, z, zoom]) => {
        const mini = (window as any)._mini;
        mini.focus(x, z, zoom);
        return mini.renderer.info.render.frame;
      }, [x, z, zoom]);
      await expect.poll(() => page.evaluate(() => (window as any)._mini.renderer.info.render.frame)).toBeGreaterThan(frame + 5);
      expect(await page.evaluate(() => (window as any)._mini.renderer.getContext().isContextLost())).toBe(false);
      await page.screenshot({ path: test.info().outputPath(`landscape-${x}-${zoom}.png`) });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: test.info().outputPath('landscape.png') });
    expect(errors).toEqual([]);
  });
}

test('energy-saving settings retain a flat landscape without animated water', async ({ page }) => {
  stubCityWebSocket(page);
  await seedCityStorage(page);
  await page.addInitScript(() => {
    const settings = JSON.parse(localStorage.getItem('minicityRenderSettings')!);
    localStorage.setItem('minicityRenderSettings', JSON.stringify({ ...settings, resolution: 0.5, waterRendering: false }));
  });
  await waitForCityBooted(page);
  expect(await page.evaluate(() => {
    let count = 0;
    (window as any)._mini.scene.traverse((object: any) => { if (object.userData.cityGrass || object.name === 'shore-surf') count++; });
    return count;
  })).toBe(0);
  expect(await page.evaluate(() => (window as any)._mini.renderer.getContext().isContextLost())).toBe(false);
});
