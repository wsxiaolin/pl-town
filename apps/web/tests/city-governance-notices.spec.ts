import { expect, test, type Route } from '@playwright/test';
import type { CityConfig, CityState } from '../src/city/cityGovernanceClient';
import { stubCityWebSocket, waitForCityReady } from './helpers';

for (const first of ['vote', 'donation'] as const) {
  test(`concurrent vote and donation keep both notices when ${first} finishes first`, async ({ page }) => {
    const config: CityConfig = {
      schemaVersion: 1, version: 'independent-notices', initialBuiltBuildingIds: ['commons'],
      projects: [
        { id: 'catcafe', buildingId: 'catcafe', name: '猫猫咖啡厅', description: '共同筹建', kind: 'building', cost: 3000 },
        { id: 'library', buildingId: 'library', name: '图书馆', description: '共同筹建', kind: 'building', cost: 2000 },
      ], personalPlots: [], decorations: [],
    };
    let state: CityState = {
      epoch: 'notice-epoch', revision: 0, configVersion: config.version,
      projects: config.projects.map(({ id }) => ({ id, funded: 0, built: false, votes: 0 })), decorations: [],
    };
    let donationRequestId: string | undefined;
    let donationAttempts = 0;
    let donation: Route | undefined;
    let vote: Route | undefined;
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    stubCityWebSocket(page, { user: 'notice-tester', unlockedBuildings: ['commons'] });
    await page.route('**/town-api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/city/config')) return route.fulfill({ json: config });
      if (path.endsWith('/city/state')) return route.fulfill({ json: state });
      if (path.endsWith('/city/votes')) return route.fulfill({ json: { epoch: state.epoch, projectIds: [] } });
      if (path.endsWith('/city/donate')) {
        donationAttempts += 1;
        const body = route.request().postDataJSON() as { requestId: string };
        if (!donationRequestId) {
          // The first donation commits but loses its reply. Its concurrent retry
          // must announce the confirmed payment without replacing vote success.
          donationRequestId = body.requestId;
          state = { ...state, revision: 1, projects: state.projects.map((project) =>
            project.id === 'library' ? { ...project, funded: 100 } : project) };
          return route.abort('connectionreset');
        }
        if (donationAttempts === 2) expect(body.requestId).toBe(donationRequestId);
        donation = route;
        return;
      }
      if (path.endsWith('/city/vote')) { vote = route; return; }
      return route.fulfill({ status: 204, body: '' });
    });
    await waitForCityReady(page, 'notice-tester');
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    const panel = page.getByRole('dialog', { name: '众议院', exact: true });
    const paymentStatus = panel.getByRole('status', { name: '建设结果', exact: true });
    const voteStatus = panel.getByRole('status', { name: '投票结果', exact: true });
    for (const status of [paymentStatus, voteStatus]) {
      await expect(status).toHaveText('');
      expect(await status.evaluate((element) => {
        const style = getComputedStyle(element);
        return !element.hasAttribute('hidden') && style.display !== 'none'
          && style.visibility !== 'hidden' && element.clientWidth === 1 && element.clientHeight === 1;
      })).toBe(true);
    }
    const library = panel.locator('[data-building-id="library"]');
    const cafe = panel.locator('[data-building-id="catcafe"]');
    const donate = library.getByRole('button', { name: '捐款', exact: true });
    await donate.click();
    await expect(panel.locator('[data-city-feedback]')).toContainText('网络连接异常');
    await donate.click();
    await cafe.getByRole('button', { name: '投票建设' }).click();
    await expect.poll(() => Boolean(donation && vote)).toBe(true);
    state = { ...state, revision: 2, projects: state.projects.map((project) =>
      project.id === 'catcafe' ? { ...project, votes: 1 } : project) };

    const voteNotice = '「猫猫咖啡厅」投票成功，已计入建设支持。';
    const paymentNotice = '上一笔已成功，未重复扣费。';
    const finishVote = () => vote!.fulfill({ json: { state, votes: { epoch: state.epoch, projectIds: ['catcafe'] } } });
    const finishDonation = () => donation!.fulfill({ json: { state, replayed: true } });
    if (first === 'vote') {
      await finishVote();
      await expect(voteStatus).toHaveText(voteNotice);
      await finishDonation();
    } else {
      await finishDonation();
      await expect(paymentStatus).toHaveText(paymentNotice);
      await finishVote();
    }
    await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
    await expect(donate).toBeEnabled();
    await expect(voteStatus).toHaveText(voteNotice);
    await expect(paymentStatus).toHaveText(paymentNotice);
    // Starting the other kind of operation must not clear an existing success.
    if (first === 'vote') {
      donation = undefined;
      await donate.click();
      await expect.poll(() => Boolean(donation)).toBe(true);
      await expect(voteStatus).toHaveText(voteNotice);
      await donation!.fulfill({ json: { state, replayed: false } });
      await expect(donate).toBeEnabled();
    } else {
      vote = undefined;
      await library.getByRole('button', { name: '投票建设' }).click();
      await expect.poll(() => Boolean(vote)).toBe(true);
      await expect(paymentStatus).toHaveText(paymentNotice);
      await vote!.fulfill({ json: { state, votes: { epoch: state.epoch, projectIds: ['catcafe', 'library'] } } });
      await expect(library.getByRole('button', { name: '已投票' })).toBeDisabled();
    }
    expect(errors).toEqual([]);
  });
}
