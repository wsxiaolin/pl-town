import { expect, test } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

test('city governance retries donations idempotently and renders both tabs', async ({ page }) => {
  const config = {
    schemaVersion: 1,
    version: 'test-city-v1',
    projects: [{
      id: 'build-catcafe',
      buildingId: 'catcafe',
      name: '猫猫咖啡厅',
      description: '共同筹建猫猫咖啡厅',
      kind: 'building',
      cost: 3_000,
    }],
    personalPlots: [{ id: 'north-garden-1', name: '北侧花园一号', x: 30, z: -40, options: ['flowers'] }],
    decorations: [{ id: 'flowers', name: '花坛', kind: 'flowers', cost: 80 }],
    initialBuiltBuildingIds: ['commons', 'commons_outer'],
  };
  let state = {
    epoch: 'test-epoch',
    revision: 0,
    configVersion: config.version,
    projects: [{ id: 'build-catcafe', funded: 0, built: false, votes: 0 }],
    decorations: [],
  };
  const requestIds: string[] = [];
  let donationAttempts = 0;

  page.on('pageerror', (error) => console.error(`city-governance page error: ${error.stack ?? error.message}`));
  stubCityWebSocket(page, { user: 'governance-tester', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/telemetry/event')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    if (url.pathname.endsWith('/city/config')) {
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { etag: '"test-city-v1"' }, body: JSON.stringify(config) });
      return;
    }
    if (url.pathname.endsWith('/city/state')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(state) });
      return;
    }
    if (url.pathname.endsWith('/city/votes')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ epoch: state.epoch, projectIds: [] }) });
      return;
    }
    if (!url.pathname.endsWith('/city/donate')) {
      await route.continue();
      return;
    }
    donationAttempts += 1;
    const body = route.request().postDataJSON() as { requestId: string; amount: number };
    requestIds.push(body.requestId);
    if (donationAttempts === 1) {
      await route.abort('connectionreset');
      return;
    }
    state = {
      ...state,
      revision: 1,
      projects: [{ id: 'build-catcafe', funded: body.amount, built: false, votes: 0 }],
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ state }) });
  });

  await waitForCityReady(page, 'governance-tester');
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));

  const panel = page.locator('.city-governance-panel');
  await expect(panel).toHaveClass(/open/);
  await expect(panel.getByRole('button', { name: '城市集体建设' })).toHaveClass(/active/);
  const project = panel.locator('.city-governance-card').first();
  await expect(project).toContainText('募捐进度 0 金币 / 3,000 金币');

  await project.getByRole('button', { name: '捐款' }).click();
  await expect(project.getByRole('button', { name: '捐款' })).toBeEnabled();
  await project.getByRole('button', { name: '捐款' }).click();
  await expect(project).toContainText('募捐进度 100 金币 / 3,000 金币');
  expect(requestIds).toHaveLength(2);
  expect(requestIds[1]).toBe(requestIds[0]);

  await panel.getByRole('button', { name: '个人建设' }).click();
  await expect(panel.getByText('北侧花园一号')).toBeVisible();
  await expect(panel.getByRole('button', { name: '建设', exact: true })).toBeVisible();
});
