import { expect, test } from '@playwright/test';
import type { CityProject } from '../src/city/cityGovernanceClient';
import { pushCityState, stubCityWebSocket, waitForCityReady } from './helpers';

test('极简场景保留城区和山海，建设快照仅恢复城区建筑', async ({ page }) => {
  test.setTimeout(150_000);
  const version = 'minimal-world';
  const projects: CityProject[] = [
    { id: 'library-project', name: 'library', description: '', kind: 'building', buildingId: 'library', cost: 1 },
    { id: 'far-road', name: 'road', description: '', kind: 'road', road: { x: 80, z: 0, width: 6, depth: 2 }, cost: 1 },
  ];
  const config = { schemaVersion: 1, version, projects, personalPlots: [], decorations: [], initialBuiltBuildingIds: [] };
  const state = { epoch: version, revision: 1, configVersion: version, decorations: [],
    projects: projects.map(({ id }) => ({ id, funded: 0, built: false, votes: 0 })) };
  stubCityWebSocket(page, { user: 'minimal-world' });
  await page.route('**/town-api/scene-mode', (route) => route.fulfill({ json: { minimal: true } }));
  await page.route('**/town-api/city/config', (route) => route.fulfill({ json: config }));
  await page.route('**/town-api/city/state', (route) => route.fulfill({ json: state }));
  await waitForCityReady(page, 'minimal-world');

  const inspect = () => page.evaluate(() => {
    const scene = (window as any)._mini.scene;
    const hasPlot = (id: string) => scene.children.some((child: any) => child.userData.buildingId === id);
    return {
      libraryPlot: hasPlot('library'),
      outerPlot: hasPlot('commons_outer'),
      northPlot: hasPlot('north_stellar_hall'),
      landscape: ['west-beach', 'lanping-mountain-terrain', 'world-far-ground'].every((name) => scene.getObjectByName(name)),
      excluded: ['year-archipelago', 'year-town-transit', 'year-town-ground', 'echo-observatory', 'bismarck-model', 'road:far-road']
        .filter((name) => scene.getObjectByName(name)),
    };
  });
  const expected = { libraryPlot: false, outerPlot: true, northPlot: true, landscape: true, excluded: [] };
  await expect.poll(inspect).toEqual(expected);
  await pushCityState(page, { ...state, revision: 2, projects: state.projects.map((p) => ({ ...p, funded: 1, built: true })) });
  await expect.poll(inspect).toEqual({ ...expected, libraryPlot: true });
});
