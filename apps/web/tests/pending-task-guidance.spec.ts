import { expect, test, type Page } from '@playwright/test';
import { BUILDING_DEFS } from '../src/city/data/buildings';
import type { MiniCityDebugApi } from '../src/city/debugApi';
import type { CityConfig } from '../src/city/cityGovernanceClient';
import { pushCityState, stubCityWebSocket, waitForCityReady } from './helpers';

type CityWindow = Window & { _mini: MiniCityDebugApi; __guidePanTargets: Array<{ x: number; z: number }> };

async function freshCity(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const config: CityConfig = {
    schemaVersion: 1, version: 'pending-guidance', initialBuiltBuildingIds: ['commons'],
    projects: BUILDING_DEFS.filter(({ id }) => id !== 'commons').map((building) => ({
      id: `build-${building.id}`, buildingId: building.id, name: building.label,
      kind: 'building', description: '共同筹建', cost: 3000,
    })), personalPlots: [], decorations: [],
  };
  let state = {
    epoch: 'pending-guidance', revision: 0, configVersion: config.version,
    projects: config.projects.map(({ id }) => ({ id, funded: 0, built: false, votes: 0 })), decorations: [],
  };
  stubCityWebSocket(page, { user: 'pending-guide-tester', unlockedBuildings: ['commons', 'research', 'newsstand', 'guesthouse'] });
  await page.route('**/town-api/**', (route) => {
    const endpoint = new URL(route.request().url()).pathname.split('/').at(-1);
    if (endpoint === 'config') return route.fulfill({ json: config });
    if (endpoint === 'state') return route.fulfill({ json: state });
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'pending-guide-tester');
  await expect(page.locator('.b-label-item')).toHaveCount(1);
  return {
    errors,
    async build(buildingId: string) {
      state = { ...state, revision: state.revision + 1, projects: state.projects.map((project) => (
        project.id === `build-${buildingId}` ? { ...project, funded: 3000, built: true } : project
      )) };
      await pushCityState(page, state);
      await expect(page.locator(`.b-label-item[data-building-id="${buildingId}"]`)).toHaveCount(1);
    },
  };
}

async function cameraPosition(page: Page): Promise<number[]> {
  return page.evaluate(() => (window as unknown as CityWindow)._mini.camera!.position.toArray());
}

async function settledCameraPosition(page: Page): Promise<number[]> {
  let previous: number[] = [];
  let stableSamples = 0;
  await expect.poll(async () => {
    const current = await cameraPosition(page);
    stableSamples = current.every((coordinate, index) => coordinate === previous[index]) ? stableSamples + 1 : 0;
    previous = current;
    return stableSamples;
  }).toBeGreaterThanOrEqual(2);
  return previous;
}

async function observeGuidePans(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const modulePath = performance.getEntriesByType('resource')
      .map((entry) => entry.name).find((url) => new URL(url).pathname.endsWith('/gsap.js'));
    if (!modulePath) throw new Error('Expected the application GSAP module to be loaded');
    const { gsap } = await import(modulePath) as typeof import('gsap');
    const targetWindow = window as unknown as CityWindow;
    targetWindow.__guidePanTargets = [];
    const originalTo = gsap.to;
    gsap.to = ((target: gsap.TweenTarget, vars: gsap.TweenVars) => {
      if (vars.duration === 0.55 && typeof vars.x === 'number' && typeof vars.z === 'number') {
        targetWindow.__guidePanTargets.push({ x: vars.x, z: vars.z });
      }
      return originalTo(target, vars);
    }) as typeof gsap.to;
  });
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 844, height: 390 }]) {
  test.describe(`pending task guidance on ${viewport.name}`, () => {
    test.use({ viewport });

    test('fresh-town Magi guide explains pending construction without panning to an empty guesthouse', async ({ page }) => {
      const city = await freshCity(page);
      expect(await page.evaluate(() => {
        const mini = (window as unknown as CityWindow)._mini;
        const della = mini.npcs.find((npc) => npc.profile.id === 'della');
        return Boolean(della?.mesh.visible) && mini.interactNpc('della');
      })).toBe(true);
      await expect(page.locator('#npcOverlay')).toHaveClass(/open/);
      await expect(page.locator('#npcName')).toHaveText('德拉');
      await page.locator('#npcClose').click();
      const guide = page.locator('.echo-story-nav');
      await expect(guide).toBeVisible();
      await expect(guide).toContainText('麦琪的礼物');
      const before = await settledCameraPosition(page);
      await observeGuidePans(page);
      await guide.click();
      await expect(page.locator('#utText')).toContainText('「客栈」尚未建成，请前往众议院参与募捐');
      expect(await cameraPosition(page)).toEqual(before);
      expect(await page.evaluate(() => (window as unknown as CityWindow).__guidePanTargets)).toEqual([]);
      await expect(page.locator('#npcOverlay')).not.toHaveClass(/open/);
      await city.build('guesthouse');
      await guide.click();
      // Existing player-follow updates can supersede the tween on the next
      // frame. Check that building completion restores the actual pan request.
      const guesthouse = BUILDING_DEFS.find(({ id }) => id === 'guesthouse')!;
      expect(await page.evaluate(() => (window as unknown as CityWindow).__guidePanTargets)).toEqual([{ x: guesthouse.x, z: guesthouse.z }]);
      await expect(page.locator('#npcOverlay')).not.toHaveClass(/open/);
      expect(city.errors).toEqual([]);
    });
    test('a restored Yesterday guide explains pending newsstand construction', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('minicityStory.side.yesterday.spring-1997.v1', JSON.stringify({
        storyId: 'side.yesterday.spring-1997', nodeId: 'diary-recognized', flags: {}, visitCount: 1, updatedAt: 1,
      })));
      const city = await freshCity(page);
      const guide = page.locator('.echo-story-nav');
      await expect(guide).toContainText('报摊');
      const before = await settledCameraPosition(page);
      await guide.click();
      await expect(page.locator('#utText')).toContainText('「报摊」尚未建成，请前往众议院参与募捐');
      expect(await cameraPosition(page)).toEqual(before);
      await expect(page.locator('#npcOverlay')).not.toHaveClass(/open/);
      expect(city.errors).toEqual([]);
    });

    test('an NPC quest remains available while its pending building gets a construction hint', async ({ page }) => {
      const city = await freshCity(page);
      await page.evaluate(() => (window as unknown as CityWindow)._mini.interactNpc('azi'));
      await page.getByRole('button', { name: '支线：调查夜灯传闻', exact: true }).click();
      const line = page.locator('#npcLine');
      const hint = '「研究院」尚未建成，请前往众议院参与募捐';
      await expect(line).toContainText(hint);
      await expect(page.getByRole('button', { name: '我去调查', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: '我去调查', exact: true }).click();
      await expect(line).toContainText(hint);
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('minicityQuestJournal.v1') || '{}').quests?.['side.azi.night-lights']?.status)).toBe('active');
      await page.getByRole('button', { name: '告辞', exact: true }).click();
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.interactBuilding('research'))).toBe(false);
      await city.build('research');
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.interactBuilding('research'))).toBe(true);
      await expect(page.locator('#modalOverlay')).toHaveClass(/open/);
      // The existing landscape-phone design omits the modal footer; its
      // backdrop remains the visible closing control at both viewport sizes.
      await page.locator('#modalOverlay').click({ position: { x: 5, y: 5 } });
      await expect(page.locator('#modalOverlay')).not.toHaveClass(/open/);
      await page.evaluate(() => (window as unknown as CityWindow)._mini.interactNpc('azi'));
      await page.getByRole('button', { name: '汇报研究院的发现', exact: true }).click();
      await expect(line).not.toContainText('尚未建成');
      await page.getByRole('button', { name: '讲述调查经过', exact: true }).click();
      await expect(line).toContainText('调查员');
      await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('minicityQuestJournal.v1') || '{}').quests?.['side.azi.night-lights']?.status)).toBe('completed');
      expect(city.errors).toEqual([]);
    });
  });
}
