import { expect, test, type Page } from '@playwright/test';

const CATALOG = { items: [{ id: 'linche', name: '林澈', role: '守夜人', npcType: 'resident' }] };

async function mockTownApi(page: Page): Promise<void> {
  await page.route('**/town-api/npc-edit-catalog', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }));
  await page.route('**/town-api/npc-edit-login', (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: body.token ? 'restored-token' : 'npc-test-token', user: { nickname: body.nickname ?? 'tester' } }) });
  });
}

test('resident submits an NPC edit request through the standalone page', async ({ page }) => {
  await mockTownApi(page);
  await page.route('**/town-api/npc-change-requests', (route) => route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 7 }) }));

  await page.goto('/npc-edit-request.html');
  await expect(page.locator('#loginPanel')).toBeVisible();
  await page.locator('#loginNickname').fill('tester');
  await page.locator('#loginPassword').fill('long-enough-password');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#requestPanel')).toBeVisible();
  await expect(page.locator('#requestNpc option')).toHaveCount(2);
  await page.locator('#requestNpc').selectOption('linche');
  await page.locator('#requestTitle').fill('补一段夜间对话');
  await page.locator('#requestSummary').fill('希望补充深夜场台词。');
  await page.locator('#requestSubmit').click();
  await expect(page.locator('#requestStatus')).toHaveClass(/success/);
});

test('add-kind requests use a stable placeholder NPC id', async ({ page }) => {
  await mockTownApi(page);
  let posted: Record<string, unknown> = {};
  await page.route('**/town-api/npc-change-requests', async (route) => { posted = route.request().postDataJSON(); await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, id: 8 }) }); });

  await page.goto('/npc-edit-request.html');
  await page.locator('#loginNickname').fill('tester');
  await page.locator('#loginPassword').fill('long-enough-password');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#requestPanel')).toBeVisible();
  await page.locator('#requestKind').selectOption('add');
  await page.locator('#requestNpcName').fill('报刊亭老板');
  await page.locator('#requestTitle').fill('新增报刊亭 NPC');
  await page.locator('#requestSummary').fill('希望新增一位报摊老板。');
  await page.locator('#requestSubmit').click();
  await expect(page.locator('#requestStatus')).toHaveClass(/success/);
  expect(posted.npcId).toBe('proposal-new');
  expect(posted.change).toEqual({ proposedName: '报刊亭老板' });
});

test('a stale stored token falls back to the sign-in form', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('minicityServerToken', 'stale-token'));
  await page.route('**/town-api/npc-edit-catalog', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }));
  await page.route('**/town-api/npc-edit-login', (route) => route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Session expired' }) }));

  await page.goto('/npc-edit-request.html');
  await expect(page.locator('#loginPanel')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('minicityServerToken'))).toBeNull();
});

test('logout clears the shared session token', async ({ page }) => {
  await mockTownApi(page);

  await page.goto('/npc-edit-request.html');
  await page.locator('#loginNickname').fill('tester');
  await page.locator('#loginPassword').fill('long-enough-password');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#requestPanel')).toBeVisible();
  await page.locator('#logoutButton').click();
  await expect(page.locator('#loginPanel')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('minicityServerToken'))).toBeNull();
});

test('a catalog load failure surfaces on the request panel', async ({ page }) => {
  await page.route('**/town-api/npc-edit-login', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'npc-test-token', user: { nickname: 'tester' } }) }));
  await page.route('**/town-api/npc-edit-catalog', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'upstream down' }) }));

  await page.goto('/npc-edit-request.html');
  await page.locator('#loginNickname').fill('tester');
  await page.locator('#loginPassword').fill('long-enough-password');
  await page.locator('#loginForm button[type="submit"]').click();
  await expect(page.locator('#requestPanel')).toBeVisible();
  await expect(page.locator('#requestStatus')).toContainText('NPC 列表暂时无法加载');
});
