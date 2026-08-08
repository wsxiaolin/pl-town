import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const;

for (const viewport of viewports) {
  test(`${viewport.name} renders a stable WebGL frame`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));

    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      localStorage.setItem('minicityRenderSettings', JSON.stringify({
        resolution: 1,
        antialias: false,
        anisotropy: 1,
        shadows: false,
        exposure: 1.18,
      }));
    });
    await page.goto('/');
    await page.waitForTimeout(4_000);

    const canvas = page.locator('#c');
    await expect(canvas).toBeVisible();
    const dimensions = await canvas.evaluate((element: HTMLCanvasElement) => ({
      width: element.width,
      height: element.height,
    }));
    const image = PNG.sync.read(await page.screenshot({ animations: 'disabled' }));
    const colors = new Set<string>();
    for (let index = 0; index < image.data.length; index += 64) {
      colors.add(`${image.data[index]},${image.data[index + 1]},${image.data[index + 2]},${image.data[index + 3]}`);
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(dimensions.width).toBeGreaterThan(0);
    expect(dimensions.height).toBeGreaterThan(0);
    expect(colors.size).toBeGreaterThan(8);
    expect(overflow).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

test('satellite city loads its buildings and roads', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('minicityCGSeenV2', 'true');
    localStorage.setItem('minicityUser', 'tester');
    localStorage.setItem('minicityRenderSettings', JSON.stringify({
      resolution: 1,
      antialias: false,
      anisotropy: 1,
      shadows: false,
      exposure: 1.18,
    }));
  });

  await page.goto('/');
  await expect.poll(async () => page.evaluate(() => {
    const mini = (window as any).__mini?.();
    if (!mini) return 0;
    const buildings = mini.scene.children.filter((object: any) => object.userData.assetPack === 'buildings');
    const designed = mini.scene.children.filter((object: any) => object.userData.assetPack === 'main-city-design');
    const satelliteRoads = mini.scene.children.filter((object: any) => object.userData.district === 'satellite-road');
    const connectors = mini.scene.children.filter((object: any) => object.userData.district === 'satellite-connector');
    const positioned = [...buildings, ...designed].every((object: any) => Math.abs(object.position.x) <= 30 && object.position.z >= 57 && object.position.z <= 107);
    return { buildings: buildings.length, designed: designed.length, roads: satelliteRoads.length, connectors: connectors.length, positioned };
  }), { timeout: 30_000 }).toEqual({ buildings: 13, designed: 5, roads: 6, connectors: 1, positioned: true });
  expect(errors).toEqual([]);
});
