import { expect, test, type Route } from '@playwright/test';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import { stubCityWebSocket, waitForCityReady } from './helpers';

test('a delayed vote cannot overwrite a restored epoch read after a conflict', async ({ page }) => {
  const config: CityConfig = {
    schemaVersion: 1, version: 'vote-restore', initialBuiltBuildingIds: ['commons'],
    projects: [
      { id: 'catcafe', buildingId: 'catcafe', name: '猫猫咖啡厅', description: '共同筹建', kind: 'building', cost: 3000 },
      { id: 'library', buildingId: 'library', name: '图书馆', description: '共同筹建', kind: 'building', cost: 2000 },
    ], personalPlots: [], decorations: [],
  };
  let state: CityState = {
    epoch: 'before-restore', revision: 0, configVersion: config.version,
    projects: config.projects.map(({ id }) => ({ id, funded: 0, built: false, votes: 0 })), decorations: [],
  };
  let restored = false;
  let publicReads = 0;
  const pending = new Map<string, Route>();
  const revokedReads: Route[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  stubCityWebSocket(page, { user: 'restore-voter', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: config });
    if (path.endsWith('/city/state')) {
      publicReads += 1;
      expect(route.request().headers().authorization).toBeUndefined();
      return route.fulfill({ json: state });
    }
    if (path.endsWith('/city/votes')) {
      if (restored) { revokedReads.push(route); return; }
      return route.fulfill({ json: { epoch: state.epoch, projectIds: [] } });
    }
    if (path.endsWith('/city/vote')) {
      const body = route.request().postDataJSON() as { projectId: string };
      pending.set(body.projectId, route);
      return;
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'restore-voter');
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await panel.locator('[data-building-id="library"]').getByRole('button', { name: '投票建设' }).click();
  await expect.poll(() => pending.size).toBe(2);

  // Both responses were produced before the restore: A committed, while B
  // conflicted with another resident completing its project. Only delivery waits.
  const receiptState = { ...state, revision: 1,
    projects: state.projects.map((project) => ({ ...project, votes: project.id === 'catcafe' ? 1 : 0 })) };
  restored = true;
  state = { ...state, epoch: 'after-restore', revision: 0 };
  // Restores revoke tokens and close sockets. During the reconnect delay the
  // browser still has its old token; the 409 can nevertheless read public state.
  // Hold the revoked private read until the older POST has finished delivering.
  await pending.get('library')!.fulfill({ status: 409, json: { error: 'Project already built' } });
  const readState = () => page.evaluate(async () => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    return (await import(modulePath)).getCityState();
  });
  await expect.poll(async () => (await readState())?.epoch).toBe('after-restore');
  expect(publicReads).toBe(2);
  await expect.poll(() => revokedReads.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => localStorage.getItem('minicityServerToken'))).toBe('stub-token');

  await pending.get('catcafe')!.fulfill({ json: {
    state: receiptState, votes: { epoch: receiptState.epoch, projectIds: ['catcafe'] },
  } });
  await expect(cafe.getByRole('button', { name: '正在投票…' })).toHaveCount(0);
  expect(await readState()).toEqual(state);
  await expect(cafe.getByRole('button', { name: '投票建设' })).toBeEnabled();
  await expect(panel.getByRole('status')).toHaveText('');
  for (const route of revokedReads) await route.fulfill({ status: 401, json: { error: 'Please sign in' } }).catch(() => {});
  expect(errors).toEqual([]);
});
