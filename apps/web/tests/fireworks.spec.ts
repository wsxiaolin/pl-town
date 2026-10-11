// 烟花玩法烟雾测试：设计台（拼字网格 + 两步确认存云端）、海边观景台
// 观景模式（HUD 节目单 + 退出）、服务端主题下发（春节装饰组挂载）。
// WS 用规格内 stub 应答 fireworks.* / world.theme，无真实服务器。
import { expect, test, type Page } from '@playwright/test';
import { seedCityStorage, waitForCityBooted } from './helpers';

/** 烟花玩法专用 WS stub：hello 带 theme，应答 fireworks.*，暴露 __pushTheme。 */
function stubFireworksWebSocket(page: Page, user = 'fw-tester'): void {
  void page.addInitScript((u) => {
    const DESIGN = {
      v: 1, height: 52, shape: 'peony',
      colors: { primary: '#ffd76e', secondary: '#ff5f8a', trail: '#ffe9b0' },
      size: 100, sparkle: 35,
    };
    const PATTERN_DESIGN = {
      ...DESIGN, shape: 'pattern', height: 60,
      pattern: { cols: 21, rows: 21, cells: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' },
    };
    const NativeWebSocket = window.WebSocket;
    class FireworksGameWebSocket extends EventTarget {
      readyState = NativeWebSocket.CONNECTING;
      currency = 500;
      own = [];
      constructor() { super(); queueMicrotask(() => { this.readyState = NativeWebSocket.OPEN; this.dispatchEvent(new Event('open')); }); }
      deliver(message: Record<string, unknown>) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(message) })); }
      send(raw: string) {
        const request = JSON.parse(raw);
        if (request.type === 'hello') {
          this.deliver({
            type: 'hello', token: 'fw-token',
            user: { id: 'fw-user', nickname: u, email: null, position: { x: 0, y: 0, z: -6 } },
            players: [], houses: [], requests: [],
            progress: { currency: this.currency, inventory: {}, achievements: ['citizen'], unlockedBuildings: ['fireworks_shop', 'observation_deck'], visitedBuildings: [], daily: {} },
            catalog: { initialCurrency: 0, buildingPrices: {}, achievementRewards: {}, products: {} },
            weather: 'clear', theme: { id: 'default' },
          });
          return;
        }
        if (request.type === 'progress.building.visit' || request.type === 'progress.building.unlock') {
          this.deliver({ type: 'progress.updated', progress: { currency: this.currency, inventory: {}, achievements: [], unlockedBuildings: ['fireworks_shop', 'observation_deck'], visitedBuildings: [], daily: {} }, catalog: {}, event: {} });
          return;
        }
        if (request.type === 'fireworks.list') {
          this.deliver({
            type: 'fireworks.listed',
            own: this.own,
            community: [
              { id: 'c1', name: '金牡丹', design: DESIGN, authorId: 'a', authorNickname: '阿金', createdAt: '', updatedAt: '' },
              { id: 'c2', name: '我的名字', design: PATTERN_DESIGN, authorId: 'b', authorNickname: '小临', createdAt: '', updatedAt: '' },
              { id: 'c3', name: '垂柳', design: { ...DESIGN, shape: 'willow' }, authorId: 'c', authorNickname: '柳生', createdAt: '', updatedAt: '' },
            ],
            revision: '3',
          });
          return;
        }
        if (request.type === 'fireworks.save') {
          this.currency = Math.max(0, this.currency - 30);
          const record = {
            id: `own-${request.requestId}`, name: request.name, design: request.design,
            authorId: 'fw-user', authorNickname: u, createdAt: '', updatedAt: '',
          };
          this.own = [...this.own, record];
          this.deliver({ type: 'fireworks.saved', requestId: request.requestId, record, replayed: false, pricePaid: 30 });
          this.deliver({ type: 'progress.updated', progress: { currency: this.currency, inventory: {}, achievements: [], unlockedBuildings: [], visitedBuildings: [], daily: {} }, catalog: {}, event: {} });
          return;
        }
        if (request.type === 'fireworks.delete') {
          this.own = this.own.filter((record: { id: string }) => record.id !== request.designId);
          this.deliver({ type: 'fireworks.deleted', designId: request.designId });
          return;
        }
      }
      close() { this.readyState = NativeWebSocket.CLOSED; this.dispatchEvent(new Event('close')); }
    }
    const sockets: FireworksGameWebSocket[] = [];
    (window as unknown as { __pushTheme: (theme: { id: string }) => void }).__pushTheme = (theme) => {
      sockets.forEach((socket) => socket.deliver({ type: 'world.theme', theme }));
    };
    Object.defineProperty(window, 'WebSocket', { configurable: true, value: new Proxy(NativeWebSocket, {
      construct(Target, args) {
        if (!String(args[0]).includes(':8787')) return Reflect.construct(Target, args);
        const socket = new FireworksGameWebSocket();
        sockets.push(socket);
        return socket;
      },
    }) });
  }, user);
}

async function seed(page: Page, user?: string): Promise<void> {
  stubFireworksWebSocket(page, user);
  await seedCityStorage(page, user);
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as any)._mini?.player), undefined, { timeout: 30_000 });
  await expect(page.locator('#bootScreen')).toHaveClass(/is-ready/, { timeout: 30_000 });
  await page.waitForTimeout(1_000);
}

test('烟花铺设计台：拼字网格绘制与两步确认存云端', async ({ page }) => {
  await seed(page, 'fw-designer');
  await page.evaluate(() => (window as any)._mini.fireworks.openDesigner());
  const panel = page.locator('#fireworksPanel');
  await expect(panel).toBeVisible();

  await page.locator('[data-fw-name]').fill('测试烟花');
  // 切到拼字花形 → 点阵画布出现。
  await page.locator('[data-fw-shape="pattern"]').click();
  await expect(page.locator('[data-fw-pattern-section]')).toBeVisible();
  await expect(page.locator('[data-fw-cells]')).toHaveText('0 点');

  // 在网格上点两格（对称开启 → 实际 4 点）。
  const grid = page.locator('[data-fw-grid]');
  const box = await grid.boundingBox();
  const cell = box!.width / 21;
  await page.mouse.click(box!.x + cell * 5.5, box!.y + cell * 10.5);
  await page.mouse.click(box!.x + cell * 8.5, box!.y + cell * 4.5);
  await expect(page.locator('[data-fw-cells]')).toHaveText('4 点');

  // 两步确认：第一次点击只进入确认态，第二次才发送。
  await page.locator('[data-fw-save]').click();
  await expect(page.locator('[data-fw-save]')).toHaveText(/确认花费 30 金币存入？/);
  await page.evaluate(() => (document.querySelector('[data-fw-save]') as HTMLElement).click());
  await expect(page.locator('[data-fw-status]')).toContainText('已存入云端');

  // 预览画布在动（rAF 循环）。
  const preview = page.locator('[data-fw-preview]');
  await expect(preview).toBeVisible();
});

test('海边观景台：进入观景模式轮播云端烟花并可退出', async ({ page }) => {
  await seed(page, 'fw-deck');
  await page.evaluate(() => (window as any)._mini.fireworks.startShow());

  // 确认对话框 → 开始观景。
  await page.getByText('开始观景').click();
  const hud = page.locator('#deckShowHud');
  await expect(hud).toBeVisible();
  await expect(page.locator('[data-deck-act]')).toContainText('第 1 /');
  await expect(page.locator('[data-deck-names]')).toContainText('《金牡丹》');

  // 退出观景。
  await page.locator('[data-deck-exit]').click();
  await expect(hud).toBeHidden();
});

test('服务端主题下发：切换春节主题挂载装饰组', async ({ page }) => {
  await seed(page, 'fw-theme');
  await expect(page.locator('body')).not.toHaveAttribute('data-city-theme', /.+/);
  await page.evaluate(() => (window as unknown as { __pushTheme: (theme: { id: string }) => void }).__pushTheme({ id: 'spring-festival' }));
  await expect(page.locator('body')).toHaveAttribute('data-city-theme', 'spring-festival');
  const decor = await page.evaluate(() => {
    const object = (window as any)._mini.scene.getObjectByName('spring-festival-decor');
    return object ? { visible: object.visible, children: object.children.length } : null;
  });
  expect(decor).not.toBeNull();
  expect(decor!.visible).toBe(true);
  expect(decor!.children).toBeGreaterThan(10);

  // 切回默认主题：装饰组隐藏。
  await page.evaluate(() => (window as unknown as { __pushTheme: (theme: { id: string }) => void }).__pushTheme({ id: 'default' }));
  await expect(page.locator('body')).not.toHaveAttribute('data-city-theme', /.+/);
  const hidden = await page.evaluate(() => (window as any)._mini.scene.getObjectByName('spring-festival-decor')?.visible);
  expect(hidden).toBe(false);
});
