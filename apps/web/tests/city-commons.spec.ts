import { expect, test, type Page } from '@playwright/test';
import { stubCityWebSocket, waitForCityReady } from './helpers';

const config = {
  schemaVersion: 1, version: 'commons-v1', initialBuiltBuildingIds: ['commons', 'commons_outer'],
  projects: [
    { id: 'catcafe', buildingId: 'catcafe', name: '猫猫咖啡厅', description: '一起建设居民的咖啡厅。', kind: 'building', cost: 3000 },
    { id: 'shrine', buildingId: 'shrine', name: '神社', description: '为城市增添一座神社。', kind: 'building', cost: 5000 },
  ], personalPlots: [], decorations: [],
};

async function fixture(page: Page, delayPersonalVotes = false, extraProjects = 0) {
  const cityConfig = { ...config, projects: [...config.projects, ...Array.from({ length: extraProjects }, (_, index) => ({
    id: `extra-${index}`, buildingId: `extra-${index}`, name: `待建项目 ${index}`, description: '共同筹建', kind: 'building', cost: 3000,
  }))] };
  let state = { epoch: 'commons-epoch', revision: 0, configVersion: cityConfig.version, projects: cityConfig.projects.map(({ id }) => ({ id, funded: 0, built: false, votes: 0 })), decorations: [] };
  const mine: string[] = [];
  const requests: Array<{ projectId: string; requestId: string }> = [];
  let releasePersonalVotes: (() => void) | null = null;
  let personalRequested = false;
  let failNextVote: 'network' | 'html' | 'invalid-state' | null = null;
  let holdVote = false;
  let releaseVote: (() => void) | null = null;
  stubCityWebSocket(page, { user: 'commons-tester', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: cityConfig });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    if (path.endsWith('/city/votes')) {
      expect(route.request().headers().authorization).toBe('Bearer stub-token');
      const snapshot = [...mine];
      personalRequested = true;
      if (delayPersonalVotes) await new Promise<void>((resolve) => { releasePersonalVotes = resolve; });
      return route.fulfill({ json: { epoch: state.epoch, projectIds: snapshot } }).catch(() => {});
    }
    if (path.endsWith('/city/vote')) {
      const body = route.request().postDataJSON() as { projectId: string; requestId: string };
      requests.push(body);
      const failure = failNextVote;
      failNextVote = null;
      if (failure === 'network') return route.abort('connectionreset');
      if (failure === 'html') return route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad Gateway</html>' });
      if (holdVote) await new Promise<void>((resolve) => { releaseVote = resolve; });
      if (!mine.includes(body.projectId)) {
        mine.push(body.projectId);
        state = { ...state, revision: state.revision + 1, projects: state.projects.map((project) => project.id === body.projectId ? { ...project, votes: project.votes + 1 } : project) };
      }
      const responseState = failure === 'invalid-state'
        ? { ...state, projects: state.projects.map(({ votes: _votes, ...project }) => project) }
        : state;
      return route.fulfill({ json: { state: responseState, votes: { epoch: state.epoch, projectIds: [...mine] } } });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await waitForCityReady(page, 'commons-tester');
  await page.evaluate(() => {
    const opener = document.createElement('button');
    opener.id = 'commons-test-opener';
    opener.textContent = '打开众议院';
    document.body.append(opener);
    opener.focus();
    (window as any)._mini.interactBuilding('commons');
  });
  return {
    requests,
    personalRequested: () => personalRequested,
    release: () => { delayPersonalVotes = false; releasePersonalVotes?.(); },
    failNext: () => { failNextVote = 'network'; },
    failNextHtml: () => { failNextVote = 'html'; },
    failNextInvalidState: () => { failNextVote = 'invalid-state'; },
    holdNextVote: () => { holdVote = true; },
    releaseVote: () => { holdVote = false; releaseVote?.(); },
    pushVoteCount: async () => {
      state = { ...state, revision: state.revision + 1, projects: state.projects.map((project) => ({ ...project, votes: project.votes + 1 })) };
      await page.evaluate(async (next) => {
        const modulePath = '/src/city/cityGovernanceClient.ts';
        (await import(modulePath)).applyCityState(next);
      }, state);
    },
  };
}

for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 844, height: 390 }]) {
  test(`commons is a light full-screen voting dialog on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const api = await fixture(page);
    const panel = page.getByRole('dialog', { name: '众议院', exact: true });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: '关闭' })).toBeFocused();
    expect(await panel.boundingBox()).toEqual({ x: 0, y: 0, width: viewport.width, height: viewport.height });
    expect(await panel.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(247, 245, 237)');
    expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const cafe = panel.locator('[data-building-id="catcafe"]');
    await cafe.getByRole('button', { name: '投票建设' }).click();
    await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
    await expect(cafe).toContainText('1 位居民支持建设');
    await expect(cafe).toContainText('募捐进度 0 金币 / 3,000 金币');
    await expect(cafe.getByRole('button', { name: '捐款', exact: true })).toBeEnabled();
    await cafe.getByRole('spinbutton').fill('321');
    await api.pushVoteCount();
    await expect(cafe.getByRole('spinbutton')).toHaveValue('321');
    await expect(cafe.getByRole('spinbutton')).toBeFocused();
    await expect(cafe).toContainText('2 位居民支持建设');
    await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
    await panel.getByRole('button', { name: '关闭' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(panel.locator('[data-building-id="shrine"]').getByRole('button', { name: '捐款', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(panel.getByRole('button', { name: '关闭' })).toBeFocused();
    await page.evaluate(() => document.getElementById('commons-test-opener')?.focus());
    expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`commons-${viewport.name}.png`) });
    if (viewport.name === 'mobile') {
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await panel.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
      expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath('commons-mobile-portrait.png') });
    }
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await expect(page.locator('#commons-test-opener')).toBeFocused();
    await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
    await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
    expect(api.requests).toHaveLength(1);
    expect(errors).toEqual([]);
  });
}

test('a delayed personal-votes read cannot erase a successful vote and failed votes can retry', async ({ page }) => {
  const api = await fixture(page, true);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  await expect.poll(api.personalRequested).toBe(true);
  api.failNext();
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect(panel.getByRole('alert')).toHaveText('网络连接中断，请稍后重试');
  await expect(cafe.getByRole('button', { name: '投票建设' })).toBeFocused();
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
  api.release();
  await api.pushVoteCount();
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
  expect(api.requests).toHaveLength(2);
  expect(api.requests[1].requestId).toBe(api.requests[0].requestId);
});

test('failed city refresh keeps focus inside the commons dialog', async ({ page }) => {
  await fixture(page);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  await panel.getByRole('button', { name: '关闭' }).focus();
  await page.route('**/town-api/city/state', (route) => route.fulfill({ status: 503, json: { error: 'Unavailable' } }));
  await page.evaluate(async () => {
    const modulePath = '/src/city/cityGovernanceClient.ts';
    await (await import(modulePath)).loadCityGovernance();
  });
  await expect(panel).toContainText('城市建设数据暂时不可用');
  await expect(panel.getByRole('button', { name: '关闭' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(panel.getByRole('button', { name: '重试', exact: true })).toBeFocused();
});

test('commons keeps the scrolled project and nearby focus across refreshes and voting', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const api = await fixture(page, false, 24);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const body = panel.locator('.city-governance-body');
  const project = panel.locator('[data-building-id="extra-18"]');
  const vote = project.getByRole('button', { name: '投票建设' });
  await expect(async () => {
    await vote.scrollIntoViewIfNeeded();
    await expect(vote).toBeInViewport();
  }).toPass();
  const scrollTop = await body.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(100);
  await api.pushVoteCount();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeCloseTo(scrollTop, 0);
  await panel.getByRole('button', { name: '个人建设', exact: true }).click();
  await panel.getByRole('button', { name: '城市集体建设', exact: true }).click();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeCloseTo(scrollTop, 0);
  api.holdNextVote();
  await vote.focus();
  await page.keyboard.press('Enter');
  await expect(project.getByRole('button', { name: '正在投票…' })).toBeDisabled();
  await expect(project.getByRole('spinbutton')).toBeFocused();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeCloseTo(scrollTop, 0);
  await expect.poll(() => api.requests.length).toBe(1);
  api.releaseVote();
  await expect(project.getByRole('button', { name: '已投票' })).toBeDisabled();
  await expect(project.getByRole('spinbutton')).toBeFocused();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeCloseTo(scrollTop, 0);
});

test('an HTML gateway error shows a readable vote failure and retries the same request', async ({ page }) => {
  const api = await fixture(page);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  api.failNextHtml();
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect(panel.getByRole('alert')).toContainText(/投票.*重试/);
  await expect(panel.getByRole('alert')).not.toContainText(/Unexpected|JSON|html/i);
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
  expect(api.requests).toHaveLength(2);
  expect(api.requests[1].requestId).toBe(api.requests[0].requestId);
  await expect(panel.getByRole('alert')).toHaveCount(0);
});

test('an expired session closes the top-layer panel before showing login', async ({ page }) => {
  await fixture(page);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  await page.evaluate(() => localStorage.removeItem('minicityServerToken'));
  await panel.locator('[data-building-id="catcafe"]').getByRole('button', { name: '投票建设' }).click();
  await expect(panel).not.toBeVisible();
  await expect(page.locator('#loginOverlay')).toBeVisible();
  await expect(page.locator('#loginInput')).toBeFocused();
});

test('a committed vote with malformed totals retries the same receipt', async ({ page }) => {
  const api = await fixture(page);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  api.failNextInvalidState();
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect(panel.getByRole('alert')).toHaveText('投票结果暂时不可用，请重试');
  await expect(cafe).toContainText('0 位居民支持建设');
  await expect(cafe.getByRole('button', { name: '投票建设' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
  await expect(cafe).toContainText('1 位居民支持建设');
  expect(api.requests).toHaveLength(2);
  expect(api.requests[1].requestId).toBe(api.requests[0].requestId);
});

test('a vote response from a previous session does not mark the new resident as voted', async ({ page }) => {
  const api = await fixture(page);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  api.holdNextVote();
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect.poll(() => api.requests.length).toBe(1);
  await page.evaluate(() => localStorage.setItem('minicityServerToken', 'another-test-session'));
  api.releaseVote();
  await expect(panel.getByRole('alert')).toHaveText('登录状态已变更，请重新打开众议院');
  await expect(cafe.getByRole('button', { name: '投票建设' })).toBeEnabled();
  await expect(cafe).toContainText('0 位居民支持建设');
});
