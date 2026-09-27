import { expect, test, type Page } from '@playwright/test';

type Notice = {
  id: string;
  subject: string;
  content: string;
  link: string | null;
  linkText: string | null;
  start: string | null;
  finish: string | null;
  priority: number;
  isAttendance: boolean;
};

const FEED: Notice[] = [
  {
    id: 'ann-1',
    subject: '版本更新 2.5.3 - 迟到的更新',
    content: '修复了一些已知问题。\n更新说明详见链接。',
    link: 'https://example.com/release-notes',
    linkText: '查看详情',
    start: '2026-07-01T00:00:00+00:00',
    finish: '2030-12-31T00:00:00+00:00',
    priority: 1,
    isAttendance: false,
  },
  {
    id: 'ann-2',
    subject: '物理实验室讨论群',
    content: '加入物理实验室 QQ 学生讨论群，参与开发和使用讨论！',
    link: null,
    linkText: null,
    start: '2018-08-02T00:00:00+00:00',
    finish: null,
    priority: 0,
    isAttendance: false,
  },
];

async function mockFeed(page: Page): Promise<void> {
  await page.route('**/town-api/announcements', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ source: 'live', cached: false, announcements: FEED }) }));
}

test('the bulletin board page lists live community announcements', async ({ page }) => {
  await mockFeed(page);
  await page.goto('/bulletin.html');

  await expect(page.locator('.notice')).toHaveCount(2);
  const first = page.locator('.notice').first();
  await expect(first.locator('.notice-subject')).toHaveText('版本更新 2.5.3 - 迟到的更新');
  await expect(first.locator('.notice-content')).toHaveText('修复了一些已知问题。\n更新说明详见链接。');
  await expect(first.locator('.notice-meta')).toContainText('2026-07-01 起');
  await expect(first.locator('.notice-meta')).toContainText('至 2030-12-31');
  const link = first.locator('.notice-actions a');
  await expect(link).toHaveText('查看详情');
  await expect(link).toHaveAttribute('href', 'https://example.com/release-notes');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

  // A notice without a link renders no action row.
  await expect(page.locator('.notice').nth(1).locator('.notice-actions')).toHaveCount(0);
});

test('the bulletin board page renders external copy as inert text', async ({ page }) => {
  await page.route('**/town-api/announcements', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ source: 'live', cached: false, announcements: [{ ...FEED[0], id: 'xss', subject: '<img src=x onerror=window.__pwned=1>', content: '<script>window.__pwned=1</script>' }] }),
  }));
  await page.goto('/bulletin.html');

  await expect(page.locator('.notice-subject')).toHaveText('<img src=x onerror=window.__pwned=1>');
  await expect(page.locator('.notice-content')).toHaveText('<script>window.__pwned=1</script>');
  expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();
});

test('an empty feed shows the placeholder state', async ({ page }) => {
  await page.route('**/town-api/announcements', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ source: 'live', cached: false, announcements: [] }) }));
  await page.goto('/bulletin.html');

  await expect(page.locator('#state')).toContainText('公告板上暂时空空如也');
});

test('a feed failure surfaces with a retry that recovers', async ({ page }) => {
  await page.route('**/town-api/announcements', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'upstream down' }) }));
  await page.goto('/bulletin.html');

  await expect(page.locator('#state')).toContainText('公告服务暂时不可用');
  await expect(page.locator('#state button')).toBeVisible();

  await page.route('**/town-api/announcements', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ source: 'live', cached: false, announcements: FEED }) }));
  await page.locator('#state button').click();
  await expect(page.locator('.notice')).toHaveCount(2);
});
