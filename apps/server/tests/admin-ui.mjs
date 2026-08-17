import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceDir = resolve(serverDir, '../..');
const dataDir = mkdtempSync(resolve(tmpdir(), 'minicity-admin-ui-'));
const screenshotDir = resolve(workspaceDir, 'test-results');
mkdirSync(screenshotDir, { recursive: true });

const reservePort = () => new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    if (!address || typeof address === 'string') return reject(new Error('Could not reserve a local port'));
    probe.close((error) => error ? reject(error) : resolvePort(address.port));
  });
});

const port = await reservePort();
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['dist/index.js'], {
  cwd: serverDir,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    HOST: '127.0.0.1',
    PORT: String(port),
    DATA_DIR: dataDir,
    LOG_DIR: resolve(dataDir, 'logs'),
    BACKUP_DIR: resolve(dataDir, 'backups'),
    ALLOWED_ORIGINS: origin,
    ADMIN_USERNAME: 'operator',
    ADMIN_PASSWORD: 'admin-ui-test-password',
    AUTO_BACKUP_ENABLED: 'false',
    BACKUP_ON_START: 'false',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', (chunk) => { output += chunk; });
server.stderr.on('data', (chunk) => { output += chunk; });

const waitForHealth = async () => {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited before readiness:\n${output}`);
    try {
      const response = await fetch(`${origin}/readyz`);
      if (response.ok) return;
    } catch { /* server is still starting */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Server did not become ready:\n${output}`);
};

const stopServer = async () => {
  if (server.exitCode !== null) return;
  server.kill('SIGTERM');
  await Promise.race([
    new Promise((resolveExit) => server.once('exit', resolveExit)),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Server did not stop after SIGTERM')), 5_000)),
  ]);
};

let browser;
try {
  await waitForHealth();
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const browserErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => browserErrors.push(`page: ${error.message}`));

  await page.goto(`${origin}/admin/`, { waitUntil: 'networkidle' });
  await page.locator('#loginUsername').fill('operator');
  await page.locator('#loginPassword').fill('admin-ui-test-password');
  await page.locator('#loginButton').click();
  await page.locator('#appView').waitFor({ state: 'visible' });
  await page.locator('#metrics .metric').first().waitFor();

  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (desktopOverflow) throw new Error('Admin desktop layout has horizontal page overflow');
  await page.screenshot({ path: resolve(screenshotDir, 'admin-desktop.png'), fullPage: true });

  await page.locator('[data-view="backups"]').click();
  await page.locator('#backupRows').waitFor();
  const offsitePanelHidden = await page.locator('#offsitePanel').evaluate((element) => element.hidden);
  if (!offsitePanelHidden) throw new Error('Admin off-site backup panel must stay hidden when OSS is not configured');
  await page.locator('[data-view="users"]').click();
  await page.locator('#userRows').waitFor();

  // NPC management: list + dialog hierarchy render without errors.
  await page.locator('[data-view="npc"]').click();
  await page.locator('#npcRows').waitFor();
  const npcRowCount = await page.locator('#npcRows tr').count();
  if (npcRowCount === 0) throw new Error('NPC management view must list NPCs');
   await page.locator('#npcRows tr').first().click();
   await page.locator('#npcDialog .npc-dialog-node').first().waitFor();
   if (!await page.locator('#npcDetailDialog[open]').count()) throw new Error('NPC details must open in an independent dialog');
   const npcDialogWidth = await page.locator('#npcDetailDialog').evaluate((element) => element.getBoundingClientRect().width);
   if (npcDialogWidth < 600) throw new Error('NPC detail dialog must provide a wide editing workspace');
   await page.locator('#npcRequestRows').waitFor();

  await page.locator('[data-view="telemetry"]').click();
  await page.locator('#telemetryMetrics .metric').first().waitFor();
  await page.locator('#serverLogs').waitFor();
  await page.locator('[data-view="overview"]').click();
  await page.locator('#metrics .metric').first().waitFor();

  // Story topology: read-only standalone graph page renders nodes/edges.
  const topologyPage = await context.newPage();
  topologyPage.on('pageerror', (error) => browserErrors.push(`topology: ${error.message}`));
  await topologyPage.goto(`${origin}/admin/story-topology`, { waitUntil: 'networkidle' });
  await topologyPage.locator('#topologyStorySelect').waitFor();
  const topologyOptionCount = await topologyPage.locator('#topologyStorySelect option').count();
  if (topologyOptionCount === 0) throw new Error('Story topology page must list stories to inspect');
  // The page auto-loads the first story; wait for the SVG graph to render nodes.
  await topologyPage.locator('#topologySvg').waitFor();
  await topologyPage.locator('#topologySvg .topology-node').first().waitFor({ timeout: 10_000 });
  await topologyPage.close();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  if (mobileOverflow) throw new Error('Admin mobile layout has horizontal page overflow');
  const mobileBounds = await page.locator('.sidebar').evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right };
  });
  if (mobileBounds.left < 0 || mobileBounds.right > 390) throw new Error('Admin mobile navigation is outside the viewport');
  await page.screenshot({ path: resolve(screenshotDir, 'admin-mobile.png'), fullPage: true });

  if (browserErrors.length) throw new Error(`Admin browser errors:\n${browserErrors.join('\n')}`);
  console.log(`Admin UI passed on desktop and mobile; screenshots: ${screenshotDir}`);
} finally {
  await browser?.close();
  await stopServer();
  let reachable = true;
  try { await fetch(`${origin}/healthz`); } catch { reachable = false; }
  if (reachable) throw new Error(`Test server is still reachable on port ${port}`);
  rmSync(dataDir, { recursive: true, force: true });
}
