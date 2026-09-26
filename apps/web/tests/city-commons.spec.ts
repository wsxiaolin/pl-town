import { expect, test, type Page, type Request, type Route } from '@playwright/test';
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
  let personalReads = 0;
  let failNextVote: 'network' | 'html' | 'invalid-state' | null = null;
  let holdVote = false;
  let releaseVote: (() => void) | null = null;
  stubCityWebSocket(page, { user: 'commons-tester', unlockedBuildings: ['commons'] });
  await page.route('**/town-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/city/config')) return route.fulfill({ json: cityConfig });
    if (path.endsWith('/city/state')) return route.fulfill({ json: state });
    if (path.endsWith('/city/votes')) {
      personalReads += 1;
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
    personalReads: () => personalReads,
    holdNextRead: () => { delayPersonalVotes = true; personalRequested = false; },
    release: () => { delayPersonalVotes = false; releasePersonalVotes?.(); },
    failNext: () => { failNextVote = 'network'; },
    failNextHtml: () => { failNextVote = 'html'; },
    failNextInvalidState: () => { failNextVote = 'invalid-state'; },
    holdNextVote: () => { holdVote = true; },
    releaseVote: () => { holdVote = false; releaseVote?.(); },
    pushVoteCount: async (epoch = state.epoch) => {
      state = { ...state, epoch, revision: state.revision + 1, projects: state.projects.map((project) => ({ ...project, votes: project.votes + 1 })) };
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
    const notice = panel.getByRole('status', { name: '投票结果', exact: true });
    await expect(notice).toHaveText('');
    const noticeNode = await notice.elementHandle();
    expect(await notice.evaluate((element) => !element.hasAttribute('hidden')
      && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden')).toBe(true);
    const cafe = panel.locator('[data-building-id="catcafe"]');
    await cafe.getByRole('button', { name: '投票建设' }).click();
    await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
    await expect(panel.getByRole('status', { name: '投票结果', exact: true })).toHaveText('「猫猫咖啡厅」投票成功，已计入建设支持。');
    expect(await noticeNode!.evaluate((element) => element === document.querySelector('[data-city-vote-notice]'))).toBe(true);
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
      const gutters = await panel.evaluate((element) => {
        const heading = element.querySelector('.city-governance-head')!;
        const headStyle = getComputedStyle(heading);
        return {
          left: headStyle.paddingLeft, right: headStyle.paddingRight,
          feedback: [...element.querySelectorAll('[data-city-status], [role="alert"], [role="status"]')]
            .map((region) => { const style = getComputedStyle(region); return {
              emptyStatus: region.matches('[role="status"]:empty'), left: style.marginLeft, right: style.marginRight,
            }; }),
        };
      });
      expect(gutters.feedback).toHaveLength(5);
      for (const { emptyStatus, left, right } of gutters.feedback) {
        expect({ left, right }).toEqual(emptyStatus ? { left: '0px', right: '0px' }
          : { left: gutters.left, right: gutters.right });
      }
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
  expect(api.requests[1]!.requestId).toBe(api.requests[0]!.requestId);
});

test('reopening preserves known votes while a read is pending and repeated opening keeps focus', async ({ page }) => {
  const api = await fixture(page);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
  api.holdNextRead();
  await panel.getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  await expect.poll(api.personalRequested).toBe(true);
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
  const reads = api.personalReads();
  await cafe.getByRole('spinbutton').fill('321');
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  await expect(cafe.getByRole('spinbutton')).toBeFocused();
  await expect(cafe.getByRole('spinbutton')).toHaveValue('321');
  expect(api.personalReads()).toBe(reads);
  expect(api.requests).toHaveLength(1);
  api.release();
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
});

test('close and unavailable snapshots preserve the last real tab scroll', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await fixture(page, false, 24);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const body = panel.locator('.city-governance-body');
  await body.evaluate((element) => { element.scrollTop = 1200; });
  const scrollTop = await body.evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(100);
  await panel.getByRole('button', { name: '关闭', exact: true }).click();
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeCloseTo(scrollTop, 0);
  let unavailable = true;
  await page.route('**/town-api/city/state', (route) => unavailable
    ? route.fulfill({ status: 503, json: { error: 'Unavailable' } }) : route.fallback());
  const reload = () => page.evaluate(async () => {
    const path = '/src/city/cityGovernanceClient.ts';
    await (await import(path)).loadCityGovernance();
  });
  await reload();
  await expect(panel).toContainText('城市建设数据暂时不可用');
  await reload();
  unavailable = false;
  await reload();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeCloseTo(scrollTop, 0);
});

test('a successful vote read clears old read errors without erasing a newer vote failure', async ({ page }) => {
  const api = await fixture(page);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  let failRead = true;
  let pendingRead: Route | undefined;
  let holdRead = false;
  await page.route('**/town-api/city/votes', (route) => {
    if (holdRead) { pendingRead = route; return; }
    if (failRead) return route.fulfill({ status: 503, json: { error: 'Unavailable' } });
    return route.fallback();
  });
  await api.pushVoteCount('read-failure');
  await expect(panel.getByRole('alert')).toHaveText('暂时无法读取已投票记录，请重试');
  failRead = false;
  await api.pushVoteCount('read-recovery');
  await expect(panel.getByRole('alert')).toHaveCount(0);
  let pendingVote: Route | undefined;
  await page.route('**/town-api/city/vote', (route) => { pendingVote = route; });
  await panel.locator('[data-building-id="catcafe"]').getByRole('button', { name: '投票建设' }).click();
  await expect.poll(() => Boolean(pendingVote)).toBe(true);
  holdRead = true;
  await api.pushVoteCount('new-vote-failure');
  await expect.poll(() => Boolean(pendingRead)).toBe(true);
  await pendingVote!.abort('connectionreset');
  await expect(panel.getByRole('alert')).toHaveText('网络连接中断，请稍后重试');
  await pendingRead!.fulfill({ json: { epoch: 'new-vote-failure', projectIds: [] } });
  await settlePaint(page);
  await expect(panel.getByRole('alert')).toHaveText('网络连接中断，请稍后重试');
});

test('vote rejections explain a changed catalog and a removed project', async ({ page }) => {
  await fixture(page);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const vote = panel.locator('[data-building-id="catcafe"]').getByRole('button', { name: '投票建设' });
  const failures = [
    { status: 409, error: 'City config changed; reload config', message: '建设配置已更新，请确认最新信息后重试投票' },
    { status: 404, error: 'Unknown project', message: '投票项目不存在，请刷新建设列表后重试' },
  ];
  let next = 0;
  await page.route('**/town-api/city/vote', (route) => {
    const failure = failures[next++]!;
    return route.fulfill({ status: failure.status, json: { error: failure.error } });
  });
  for (const failure of failures) {
    await vote.click();
    await expect(panel.getByRole('alert')).toHaveText(failure.message);
  }
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
  expect(api.requests[1]!.requestId).toBe(api.requests[0]!.requestId);
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
  const closedPanel = page.locator('.city-governance-panel');
  await expect(closedPanel.locator('[data-city-vote-feedback]')).toHaveText('');
  await expect(closedPanel.locator('[data-city-vote-feedback]')).toHaveJSProperty('hidden', true);
});

test('a rejected vote leaves its closed dialog clear while login takes focus', async ({ page }) => {
  await fixture(page);
  await page.route('**/town-api/city/vote', (route) => route.fulfill({ status: 401, json: { error: 'Please sign in' } }));
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  await panel.locator('[data-building-id="catcafe"]').getByRole('button', { name: '投票建设' }).click();
  await expect(panel).not.toBeVisible();
  await expect(page.locator('#loginInput')).toBeFocused();
  await settlePaint(page);
  const closedPanel = page.locator('.city-governance-panel');
  await expect(closedPanel.locator('[data-city-vote-feedback]')).toHaveText('');
  await expect(closedPanel.locator('[data-city-vote-feedback]')).toHaveJSProperty('hidden', true);
});

test('commons cancels an active city route and camera drag while its modal is open', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await fixture(page);
  await page.keyboard.press('Escape');
  const started = await page.evaluate(() => {
    const mini = (window as any)._mini;
    const point = new mini.THREE.Vector3(0, 0, -20).project(mini.camera);
    document.querySelector('#c')!.dispatchEvent(new MouseEvent('click', {
      bubbles: true, clientX: (point.x + 1) * innerWidth / 2, clientY: (1 - point.y) * innerHeight / 2,
    }));
    const pathLength = mini.getPlayerPath().length;
    mini.interactBuilding('commons');
    return { pathLength, position: mini.player.position.toArray(), frame: mini.renderer.info.render.frame };
  });
  expect(started.pathLength).toBeGreaterThan(0);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  await expect(panel).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any)._mini.getPlayerPath().length)).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any)._mini.renderer.info.render.frame)).toBeGreaterThan(started.frame + 8);
  expect(await page.evaluate(() => (window as any)._mini.player.position.toArray())).toEqual(started.position);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any)._mini.renderer.info.render.frame)).toBeGreaterThan(started.frame + 16);
  expect(await page.evaluate(() => (window as any)._mini.getPlayerPath().length)).toBe(0);

  await page.mouse.move(640, 400);
  await page.mouse.down();
  await expect(page.locator('body')).toHaveClass(/camera-pan-active/);
  await page.evaluate(() => (window as any)._mini.interactBuilding('commons'));
  await expect(panel).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/camera-pan-active/);
  await page.mouse.up();
  await expect(panel.getByRole('button', { name: '关闭' })).toBeFocused();
});

test('a vote timeout explains the stalled request and preserves its retry receipt', async ({ page }) => {
  const api = await fixture(page);
  let stalled: Route | null = null;
  let firstRequestId = '';
  await page.route('**/town-api/city/vote', async (route) => {
    if (!stalled) {
      stalled = route;
      firstRequestId = route.request().postDataJSON().requestId;
      return;
    }
    await route.fallback();
  });
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect(panel.getByRole('alert')).toHaveText('投票服务响应超时，请稍后重试', { timeout: 12_000 });
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
  expect(api.requests).toHaveLength(1);
  expect(api.requests[0]!.requestId).toBe(firstRequestId);
  await (stalled as Route | null)?.abort().catch(() => {});
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
  expect(api.requests[1]!.requestId).toBe(api.requests[0]!.requestId);
});

test('out-of-order successful votes preserve both confirmed project choices', async ({ page }) => {
  await fixture(page);
  const pending = new Map<string, Route>();
  await page.route('**/town-api/city/vote', (route) => { pending.set(route.request().postDataJSON().projectId, route); });
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  const shrine = panel.locator('[data-building-id="shrine"]');
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await shrine.getByRole('button', { name: '投票建设' }).click();
  await expect.poll(() => pending.size).toBe(2);
  const response = (ids: string[]) => ({
    state: { epoch: 'commons-epoch', revision: ids.length, configVersion: config.version,
      projects: config.projects.map(({ id }) => ({ id, funded: 0, built: false, votes: ids.includes(id) ? 1 : 0 })), decorations: [] },
    votes: { epoch: 'commons-epoch', projectIds: ids },
  });
  await pending.get('shrine')!.fulfill({ json: response(['catcafe', 'shrine']) });
  await expect(shrine.getByRole('button', { name: '已投票' })).toBeDisabled();
  await pending.get('catcafe')!.fulfill({ json: response(['catcafe']) });
  await expect(panel.getByRole('status', { name: '投票结果', exact: true })).toHaveText('「猫猫咖啡厅」投票成功，已计入建设支持。');
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
  await expect(shrine.getByRole('button', { name: '已投票' })).toBeDisabled();
  await expect(shrine).toContainText('1 位居民支持建设');
});

test('an older epoch-triggered read cannot erase a confirmed vote in that epoch', async ({ page }) => {
  const api = await fixture(page);
  let pendingVote: Route | undefined;
  let pendingRead: Route | undefined;
  await page.route('**/town-api/city/vote', (route) => { pendingVote = route; });
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect.poll(() => Boolean(pendingVote)).toBe(true);
  await page.route('**/town-api/city/votes', (route) => { pendingRead = route; });
  await api.pushVoteCount('restored-epoch');
  await expect.poll(() => Boolean(pendingRead)).toBe(true);
  await pendingVote!.fulfill({ json: {
    state: { epoch: 'restored-epoch', revision: 2, configVersion: config.version,
      projects: config.projects.map(({ id }) => ({ id, funded: 0, built: false, votes: id === 'catcafe' ? 1 : 0 })), decorations: [] },
    votes: { epoch: 'restored-epoch', projectIds: ['catcafe'] },
  } });
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
  await pendingRead!.fulfill({ json: { epoch: 'restored-epoch', projectIds: [] } });
  await settlePaint(page);
  await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
});

test('a vote response from a previous session does not mark the new resident as voted', async ({ page }) => {
  const api = await fixture(page);
  const panel = page.getByRole('dialog', { name: '众议院', exact: true });
  const cafe = panel.locator('[data-building-id="catcafe"]');
  api.holdNextVote();
  await cafe.getByRole('button', { name: '投票建设' }).click();
  await expect.poll(() => api.requests.length).toBe(1);
  await page.route('**/town-api/city/votes', (route) => route.fulfill({ json: { epoch: 'commons-epoch', projectIds: [] } }));
  await switchResident(page);
  const completed = page.waitForEvent('requestfinished', (request) => new URL(request.url()).pathname.endsWith('/city/vote'));
  api.releaseVote();
  await completed;
  await settlePaint(page);
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(cafe.getByRole('button', { name: '投票建设' })).toBeEnabled();
  await expect(cafe).toContainText('0 位居民支持建设');
});

function gate() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

async function switchResident(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const path = '/src/adapters/ui/cityGovernancePanel.ts';
    const panel = await import(path);
    panel.closeCityGovernancePanel();
    localStorage.setItem('minicityServerToken', 'another-test-session');
    panel.openCityGovernancePanel('commons');
  });
}

async function settlePaint(page: Page): Promise<void> {
  // Run after the request finishes so the async click handler and its render
  // settle before checking that an obsolete completion had no visible effect.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

type LateFailure = '401' | 'network' | 'html';
async function failResponse(route: Route, failure: LateFailure): Promise<void> {
  if (failure === 'network') await route.abort('connectionreset');
  else if (failure === 'html') await route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad Gateway</html>' });
  else await route.fulfill({ status: 401, json: { error: 'Please sign in' } });
}

for (const failure of ['401', 'network', 'html'] as const) {
  test(`a previous resident's late ${failure} vote cannot affect a new pending vote`, async ({ page }) => {
    await fixture(page);
    const oldVote = gate(), newVote = gate();
    const requests: Array<{ token: string; projectId: string; requestId: string }> = [];
    await page.route('**/town-api/city/votes', (route) => route.fulfill({ json: { epoch: 'commons-epoch', projectIds: [] } }));
    await page.route('**/town-api/city/vote', async (route) => {
      const body = route.request().postDataJSON() as typeof requests[number];
      requests.push(body);
      if (body.token === 'stub-token') {
        await oldVote.promise;
        return failResponse(route, failure);
      }
      await newVote.promise;
      return route.fulfill({ json: {
        state: { epoch: 'commons-epoch', revision: 1, configVersion: config.version,
          projects: config.projects.map(({ id }) => ({ id, funded: 0, built: false, votes: id === body.projectId ? 1 : 0 })), decorations: [] },
        votes: { epoch: 'commons-epoch', projectIds: [body.projectId] },
      } });
    });
    const panel = page.getByRole('dialog', { name: '众议院', exact: true });
    const cafe = panel.locator('[data-building-id="catcafe"]');
    await cafe.getByRole('button', { name: '投票建设' }).click();
    await expect.poll(() => requests.length).toBe(1);
    await switchResident(page);
    await cafe.getByRole('button', { name: '投票建设' }).click();
    await expect.poll(() => requests.length).toBe(2);
    await expect(cafe.getByRole('button', { name: '正在投票…' })).toBeDisabled();
    await cafe.getByRole('spinbutton').focus();
    const isOldVote = (request: Request) => new URL(request.url()).pathname.endsWith('/city/vote')
      && request.postDataJSON().token === 'stub-token';
    const completed = failure === 'network'
      ? page.waitForEvent('requestfailed', isOldVote) : page.waitForEvent('requestfinished', isOldVote);
    oldVote.release();
    await completed;
    await settlePaint(page);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('#loginOverlay')).not.toBeVisible();
    await expect(cafe.getByRole('button', { name: '正在投票…' })).toBeDisabled();
    await expect(cafe.getByRole('spinbutton')).toBeFocused();
    newVote.release();
    await expect(cafe.getByRole('button', { name: '已投票' })).toBeDisabled();
    expect(requests[1]!.requestId).not.toBe(requests[0]!.requestId);
  });

  test(`a previous resident's late ${failure} vote read is silently discarded`, async ({ page }) => {
    await fixture(page);
    const oldRead = gate();
    let started = false;
    await page.route('**/town-api/city/votes', async (route) => {
      if (route.request().headers().authorization === 'Bearer stub-token') {
        started = true;
        await oldRead.promise;
        return failResponse(route, failure);
      }
      return route.fulfill({ json: { epoch: 'commons-epoch', projectIds: ['shrine'] } });
    });
    await page.evaluate(async () => {
      const path = '/src/city/cityVotingClient.ts';
      const client = await import(path);
      // Keep this read alive across opening the next resident's panel, as can
      // happen for another caller without the panel's AbortController.
      (window as any).oldVoteRead = undefined;
      void client.loadCityVotes().then(
        (result: unknown) => { (window as any).oldVoteRead = { result }; },
        (error: Error) => { (window as any).oldVoteRead = { error: error.message }; },
      );
    });
    await expect.poll(() => started).toBe(true);
    await switchResident(page);
    const panel = page.getByRole('dialog', { name: '众议院', exact: true });
    const shrine = panel.locator('[data-building-id="shrine"]');
    await expect(shrine.getByRole('button', { name: '已投票' })).toBeDisabled();
    oldRead.release();
    await expect.poll(() => page.evaluate(() => (window as any).oldVoteRead)).toEqual({ result: null });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('#loginOverlay')).not.toBeVisible();
    await expect(shrine.getByRole('button', { name: '已投票' })).toBeDisabled();
  });
}
