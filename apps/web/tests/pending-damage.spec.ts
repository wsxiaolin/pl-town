import { expect, test, type Page } from '@playwright/test';
import type * as THREE from 'three';
import { BUILDING_DEFS } from '../src/city/data/buildings';
import type { CityConfig } from '../src/city/cityGovernanceClient';
import type { MiniCityDebugApi } from '../src/city/debugApi';
import { pushCityState, stubCityWebSocket, waitForCityReady } from './helpers';

type CityWindow = Window & { _mini: MiniCityDebugApi };

async function damageCity(page: Page, initiallyBuilt: boolean) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const config: CityConfig = {
    schemaVersion: 1, version: 'pending-damage', initialBuiltBuildingIds: ['commons'],
    projects: BUILDING_DEFS.filter(({ id }) => id !== 'commons').map((building) => ({
      id: `build-${building.id}`, buildingId: building.id, name: building.label,
      kind: 'building', description: '共同筹建', cost: 3000,
    })), personalPlots: [], decorations: [],
  };
  let state = {
    epoch: 'pending-damage', revision: 0, configVersion: config.version,
    projects: config.projects.map(({ id }) => ({
      id, funded: initiallyBuilt && id === 'build-research' ? 3000 : 0,
      built: initiallyBuilt && id === 'build-research', votes: 0,
    })), decorations: [],
  };
  stubCityWebSocket(page, { user: 'pending-damage-tester', unlockedBuildings: ['commons', 'research'] });
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'pending-damage-tester');
  await expect.poll(() => buildingState(page)).toMatchObject({ present: initiallyBuilt });
  return {
    errors,
    async setBuilt(built: boolean) {
      state = { ...state, revision: state.revision + 1, projects: state.projects.map((project) => (
        project.id === 'build-research' ? { ...project, funded: built ? 3000 : 0, built } : project
      )) };
      await pushCityState(page, state);
      await expect.poll(() => buildingState(page)).toMatchObject({ present: built });
    },
  };
}

async function buildingState(page: Page) {
  return page.evaluate(() => {
    const scene = (window as unknown as CityWindow)._mini.scene;
    let root: THREE.Object3D | undefined;
    scene.traverse((object) => {
      if (root || !(object as THREE.Mesh).isMesh || object.userData.buildingId !== 'research') return;
      if (object.parent === scene) return; // Plot planes are separate from the building group.
      let group = object;
      while (group.parent && group.parent !== scene) group = group.parent;
      root = group;
    });
    return {
      present: Boolean(root),
      damaged: root?.userData.buildingState === 'damaged',
      rubble: root?.getObjectByName('building-destruction-rubble')?.children.length ?? 0,
      stored: JSON.parse(localStorage.getItem('minicityDestroyedBuildings') ?? '[]') as string[],
    };
  });
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 844, height: 390 }]) {
  test.describe(`pending building damage on ${viewport.name}`, () => {
    test.use({ viewport });

    test('saved damage survives pending boot, unrelated saves and construction completion', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem('minicityDestroyedBuildings', JSON.stringify(['research']));
      });
      const city = await damageCity(page, false);
      expect(await buildingState(page)).toEqual({ present: false, damaged: false, rubble: 0, stored: ['research'] });
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.destroyBuilding('research'))).toBe(false);
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.destroyBuilding('commons'))).toBe(true);
      expect((await buildingState(page)).stored).toEqual(['research', 'commons']);
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.restoreBuilding('commons'))).toBe(true);
      expect((await buildingState(page)).stored).toEqual(['research']);
      await city.setBuilt(true);
      await expect.poll(() => buildingState(page)).toEqual({ present: true, damaged: true, rubble: 8, stored: ['research'] });
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.interactBuilding('research'))).toBe(false);
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.restoreBuilding('research'))).toBe(true);
      await expect.poll(() => buildingState(page)).toEqual({ present: true, damaged: false, rubble: 0, stored: [] });
      expect(city.errors).toEqual([]);
    });

    test('damage survives live construction hiding and explicit pending repair stays repaired', async ({ page }) => {
      const city = await damageCity(page, true);
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.destroyBuilding('research'))).toBe(true);
      await city.setBuilt(false);
      expect(await buildingState(page)).toEqual({ present: false, damaged: false, rubble: 0, stored: ['research'] });
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.destroyBuilding('commons'))).toBe(true);
      expect((await buildingState(page)).stored).toEqual(['research', 'commons']);
      await city.setBuilt(true);
      await expect.poll(() => buildingState(page)).toEqual({ present: true, damaged: true, rubble: 8, stored: ['research', 'commons'] });
      await city.setBuilt(false);
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.restoreAll())).toBe(2);
      expect(await buildingState(page)).toEqual({ present: false, damaged: false, rubble: 0, stored: [] });
      expect(await page.evaluate(() => (window as unknown as CityWindow)._mini.interactBuilding('research'))).toBe(false);
      await city.setBuilt(true);
      await expect.poll(() => buildingState(page)).toEqual({ present: true, damaged: false, rubble: 0, stored: [] });
      expect(city.errors).toEqual([]);
    });
  });
}
