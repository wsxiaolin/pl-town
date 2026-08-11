import {
  EMPTY_PLAYER_PROGRESS,
  EMPTY_PROGRESSION_CATALOG,
  canInteractWithBuilding,
  inventoryEntries,
  normalizePlayerProgress,
  toQuestProgressView,
  type PlayerProgress,
  type ProgressionCatalog,
  type ProgressionEvent,
} from '../../gameplay/progression/playerProgress';

type ProgressionCommand =
  | { type: 'progress.get' }
  | { type: 'progress.building.visit'; buildingId: string }
  | { type: 'progress.building.unlock'; buildingId: string }
  | { type: 'progress.achievement.unlock'; achievementId: string }
  | { type: 'progress.shop.buy'; productId: string; quantity?: number }
  | { type: 'progress.item.consume'; itemId: string; quantity?: number }
  | { type: 'progress.reward.claim'; rewardId: string };

type Options = {
  document: Document;
  signal: AbortSignal;
  showToast: (message: string) => void;
  send: (command: ProgressionCommand) => boolean;
};

export type CloudProgressionController = ReturnType<typeof createCloudProgressionController>;

export function createCloudProgressionController(options: Options) {
  let progress = normalizePlayerProgress(EMPTY_PLAYER_PROGRESS);
  let catalog: ProgressionCatalog = EMPTY_PROGRESSION_CATALOG;
  let online = false;
  let pendingBuilding: { id: string; phase: 'unlock' | 'visit'; continueInteraction: () => void } | null = null;
  let panel: HTMLElement | null = null;
  let inventoryList: HTMLElement | null = null;
  let currencyValue: HTMLElement | null = null;
  let shopArea: HTMLElement | null = null;
  let panelTitle: HTMLElement | null = null;
  let welcomeButton: HTMLButtonElement | null = null;
  const pendingConsumption = new Map<string, (consumed: boolean) => void>();
  const pendingRewards = new Map<string, (claimed: boolean) => void>();

  function setup(): void {
    const welcome = options.document.querySelector<HTMLElement>('.welcome-block');
    if (welcome && !welcome.querySelector('[data-inventory-button]')) {
      welcomeButton = options.document.createElement('button');
      welcomeButton.type = 'button';
      welcomeButton.dataset.inventoryButton = '';
      welcomeButton.className = 'inventory-trigger';
      welcomeButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8.5V7a5 5 0 0 1 10 0v1.5"/><path d="M5.5 8.5h13a1 1 0 0 1 1 1v8.8a2.2 2.2 0 0 1-2.2 2.2H6.7a2.2 2.2 0 0 1-2.2-2.2V9.5a1 1 0 0 1 1-1Z"/><path d="M8.5 12.5h7M8.5 15.5h7"/></svg>';
      welcomeButton.title = '打开背包';
      welcomeButton.hidden = true;
      welcomeButton.style.pointerEvents = 'auto';
      welcomeButton.addEventListener('click', openInventory, { signal: options.signal });
      welcome.appendChild(welcomeButton);
    }

    panel = options.document.createElement('aside');
    panel.id = 'inventoryPanel';
    panel.className = 'stats-panel inventory-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', '背包');
    panel.innerHTML = `
      <div class="sp-head">
        <span class="sp-title" data-panel-title>背包</span>
        <button class="sp-close" type="button" data-inventory-close aria-label="关闭背包">X</button>
      </div>
      <div class="sp-body">
        <div class="inventory-balance"><span>物实币</span><strong data-currency>0</strong></div>
        <div class="sp-unlocks" data-inventory-section><div class="sp-ul-title">已有物品</div><div data-inventory-list></div></div>
        <div class="sp-unlocks" data-shop-area hidden><div class="sp-ul-title">商城</div><div data-shop-list></div></div>
      </div>`;
    options.document.body.appendChild(panel);
    inventoryList = panel.querySelector('[data-inventory-list]');
    currencyValue = panel.querySelector('[data-currency]');
    shopArea = panel.querySelector('[data-shop-area]');
    panelTitle = panel.querySelector('[data-panel-title]');
    panel.querySelector('[data-inventory-close]')?.addEventListener('click', closePanel, { signal: options.signal });
    render();
  }

  function setConnection(isOnline: boolean): void {
    online = isOnline;
    if (!online) handleError();
    render();
  }

  function applySnapshot(next: unknown, nextCatalog: ProgressionCatalog | undefined, event?: ProgressionEvent): void {
    progress = normalizePlayerProgress(next);
    if (nextCatalog) catalog = nextCatalog;
    render();
    describeEvent(event);
    if (event?.type === 'item.consumed' && event.itemId) {
      pendingConsumption.get(event.itemId)?.(true);
      pendingConsumption.delete(event.itemId);
    }
    if (event?.type === 'reward.claimed' && event.rewardId) {
      pendingRewards.get(event.rewardId)?.(Boolean(event.claimed));
      pendingRewards.delete(event.rewardId);
    }
    if (event?.type === 'building.unlocked' && event.buildingId && pendingBuilding?.id === event.buildingId && pendingBuilding.phase === 'unlock') {
      pendingBuilding.phase = 'visit';
      if (!options.send({ type: 'progress.building.visit', buildingId: event.buildingId })) handleError();
    }
    if (event?.type === 'building.visited' && event.buildingId && pendingBuilding?.id === event.buildingId && pendingBuilding.phase === 'visit') {
      const continuation = pendingBuilding.continueInteraction;
      pendingBuilding = null;
      continuation();
    }
  }

  function describeEvent(event?: ProgressionEvent): void {
    if (!event) return;
    if (event.welcomeItemsGranted) options.showToast('背包已解锁，获得城市导览册和居民纪念徽章');
    else if (event.type === 'achievement.unlocked' && event.reward) options.showToast(`成就奖励 +${event.reward} 物实币`);
    else if (event.type === 'shop.purchased') options.showToast('龙井茶已放入背包');
    else if (event.type === 'reward.claimed') options.showToast(event.claimed ? '今日沃柑已放入背包' : '今天已经领取过沃柑了');
  }

  function render(): void {
    if (currencyValue) currencyValue.textContent = String(progress.currency);
    if (inventoryList) {
      const entries = inventoryEntries(progress);
      inventoryList.replaceChildren(...(entries.length ? entries.map((entry) => {
        const row = options.document.createElement('div');
        row.className = 'sp-ul-item done';
        row.dataset.itemId = entry.itemId;
        const icon = options.document.createElement('span');
        icon.className = 'inventory-item-icon';
        icon.textContent = entry.itemId === 'mandarin' ? '柑' : entry.itemId === 'dragonwell_tea' ? '茶' : entry.itemId === 'beef' ? '肉' : entry.itemId === 'radish' ? '萝' : entry.itemId === 'music_box' ? '音' : entry.itemId === 'city_badge' ? '章' : '册';
        const name = options.document.createElement('span');
        name.className = 'sp-ul-name';
        name.textContent = entry.name;
        const count = options.document.createElement('span');
        count.className = 'sp-ul-thresh';
        count.textContent = `× ${entry.quantity}`;
        row.append(icon, name, count);
        return row;
      }) : [emptyRow('背包里还没有物品')]));
    }
    renderShop();
    const hasInventory = progress.visitedBuildings.length >= 2;
    const welcome = options.document.querySelector<HTMLElement>('.welcome-block');
    welcome?.classList.remove('hidden');
    welcome?.querySelectorAll<HTMLElement>('.welcome-main, .welcome-sub, .welcome-accent').forEach((element) => { element.hidden = hasInventory; });
    if (welcomeButton) welcomeButton.hidden = !hasInventory;
  }

  function renderShop(): void {
    const list = shopArea?.querySelector<HTMLElement>('[data-shop-list]');
    if (!list) return;
    list.replaceChildren(...Object.entries(catalog.products).map(([productId, product]) => {
      const row = options.document.createElement('div');
      row.className = 'shop-product';
      const icon = options.document.createElement('span');
      icon.className = 'shop-product-icon';
      icon.textContent = '茶';
      const copy = options.document.createElement('span');
      copy.className = 'shop-product-copy';
      const name = options.document.createElement('span');
      name.className = 'sp-ul-name';
      name.textContent = product.name;
      const detail = options.document.createElement('small');
      detail.textContent = '西湖龙井 · 可用于石井剧情';
      copy.append(name, detail);
      const buy = options.document.createElement('button');
      buy.type = 'button';
      buy.className = 'inventory-buy';
      buy.textContent = `${product.unitPrice} 币`;
      buy.disabled = !online || progress.currency < product.unitPrice;
      buy.addEventListener('click', () => buyProduct(productId), { signal: options.signal });
      row.append(icon, copy, buy);
      return row;
    }));
  }

  function emptyRow(message: string): HTMLElement {
    const row = options.document.createElement('div');
    row.className = 'sp-ul-item';
    row.textContent = message;
    return row;
  }

  function openInventory(): void {
    if (!panel) return;
    if (shopArea) shopArea.hidden = true;
    panel.querySelector<HTMLElement>('[data-inventory-section]')?.removeAttribute('hidden');
    panelTitle && (panelTitle.textContent = '背包');
    panel.classList.remove('shop-mode');
    panel.classList.add('open');
  }

  function openShop(): void {
    if (!online) return offlineNotice();
    openInventory();
    panel?.querySelector<HTMLElement>('[data-inventory-section]')?.setAttribute('hidden', '');
    if (panelTitle) panelTitle.textContent = '物实商店';
    panel?.classList.add('shop-mode');
    if (shopArea) shopArea.hidden = false;
  }

  function closePanel(): void { panel?.classList.remove('open'); }

  function interactBuilding(buildingId: string, continueInteraction: () => void): boolean {
    if (!online) { offlineNotice(); return false; }
    if (pendingBuilding) return false;
    if (canInteractWithBuilding(progress, buildingId)) {
      pendingBuilding = { id: buildingId, phase: 'visit', continueInteraction };
      if (!options.send({ type: 'progress.building.visit', buildingId })) { pendingBuilding = null; return false; }
      return true;
    }
    const price = catalog.buildingPrices[buildingId];
    if (catalog.buildingUnlockable && catalog.buildingUnlockable[buildingId] !== true) {
      options.showToast('这座建筑尚未开放');
      return false;
    }
    if (price === undefined) { options.showToast('这座建筑暂时无法解锁'); return false; }
    if (progress.currency < price) { options.showToast(`解锁需要 ${price} 物实币，余额不足`); return false; }
    pendingBuilding = { id: buildingId, phase: 'unlock', continueInteraction };
    if (!options.send({ type: 'progress.building.unlock', buildingId })) { pendingBuilding = null; return false; }
    options.showToast(price > 0 ? `正在使用 ${price} 物实币解锁建筑` : '正在解锁建筑');
    return true;
  }

  function unlockAchievement(achievementId: string): boolean {
    if (!online) return false;
    if (progress.achievements.includes(achievementId)) return true;
    return options.send({ type: 'progress.achievement.unlock', achievementId });
  }

  function syncAchievements(achievementIds: readonly string[]): void {
    if (!online) return;
    achievementIds.forEach((achievementId) => {
      if (achievementId in catalog.achievementRewards && !progress.achievements.includes(achievementId)) {
        options.send({ type: 'progress.achievement.unlock', achievementId });
      }
    });
  }

  function buyProduct(productId: string, quantity = 1): boolean {
    if (!online) { offlineNotice(); return false; }
    return options.send({ type: 'progress.shop.buy', productId, quantity });
  }

  function consumeItem(itemId: string, quantity = 1): Promise<boolean> {
    if (!online) { offlineNotice(); return Promise.resolve(false); }
    if ((progress.inventory[itemId] ?? 0) < quantity || pendingConsumption.has(itemId)) return Promise.resolve(false);
    return new Promise((resolve) => {
      pendingConsumption.set(itemId, resolve);
      if (!options.send({ type: 'progress.item.consume', itemId, quantity })) {
        pendingConsumption.delete(itemId);
        resolve(false);
      }
    });
  }

  function claimDailyReward(rewardId: string): Promise<boolean> {
    if (!online) { offlineNotice(); return Promise.resolve(false); }
    if (pendingRewards.has(rewardId)) return Promise.resolve(false);
    return new Promise((resolve) => {
      pendingRewards.set(rewardId, resolve);
      if (!options.send({ type: 'progress.reward.claim', rewardId })) {
        pendingRewards.delete(rewardId);
        resolve(false);
      }
    });
  }

  function offlineNotice(): void { options.showToast('此功能需要连接服务器'); }

  function handleError(): void {
    pendingBuilding = null;
    pendingConsumption.forEach((resolve) => resolve(false));
    pendingRewards.forEach((resolve) => resolve(false));
    pendingConsumption.clear();
    pendingRewards.clear();
  }

  function destroy(): void { handleError(); panel?.remove(); panel = null; }

  return {
    setup, setConnection, applySnapshot, interactBuilding, unlockAchievement, syncAchievements,
    buyProduct, consumeItem, claimDailyReward, openInventory, openShop, closePanel,
    getProgress: () => progress,
    getQuestProgressView: () => toQuestProgressView(progress),
    isOnline: () => online, handleError,
    destroy,
  };
}
