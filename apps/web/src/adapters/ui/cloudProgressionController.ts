import {
  EMPTY_PLAYER_PROGRESS,
  EMPTY_PROGRESSION_CATALOG,
  canInteractWithBuilding,
  inventoryEntries,
  ITEM_DETAILS,
  normalizePlayerProgress,
  toQuestProgressView,
  type PlayerProgress,
  type ProgressionCatalog,
  type ProgressionEvent,
} from '../../gameplay/progression/playerProgress';
import { ICE_KING_ITEMS, ICE_KING_REWARDS } from '../../gameplay/content/stories/iceKing/iceKingContent';

type ProgressionCommand =
  | { type: 'progress.get' }
  | { type: 'progress.building.visit'; buildingId: string }
  | { type: 'progress.building.unlock'; buildingId: string }
  | { type: 'progress.achievement.unlock'; achievementId: string }
  | { type: 'progress.shop.buy'; productId: string; quantity?: number }
  | { type: 'progress.item.consume'; itemId: string; quantity?: number }
  | { type: 'progress.filmCity.experience' }
  | { type: 'progress.reward.claim'; rewardId: string; claimSequence?: number };

type Options = {
  document: Document;
  signal: AbortSignal;
  showToast: (message: string) => void;
  send: (command: ProgressionCommand) => boolean;
  openPhoneView: (view: 'inventory') => void;
};

const PRODUCT_PRESENTATIONS: Readonly<Record<string, { icon: string; detail: string }>> = Object.freeze({
  dragonwell_tea: { icon: '茶', detail: '西湖龙井 · 可用于石井剧情' },
  beef: { icon: '肉', detail: '新鲜牛肉 · 林澈遗愿所需食材' },
  radish: { icon: '萝', detail: '新鲜萝卜 · 林澈遗愿所需食材' },
  music_box: { icon: '音', detail: '经典旋律音乐盒 · 林澈遗愿所需物品' },
});
const repeatableRewardIds: ReadonlySet<string> = new Set(Object.values(ICE_KING_REWARDS).map((reward) => reward.id));
const iceRewardById = new Map(Object.values(ICE_KING_REWARDS).map((reward) => [reward.id, reward]));

export type CloudProgressionController = ReturnType<typeof createCloudProgressionController>;

export function createCloudProgressionController(options: Options) {
  let progress = normalizePlayerProgress(EMPTY_PLAYER_PROGRESS);
  let catalog: ProgressionCatalog = EMPTY_PROGRESSION_CATALOG;
  let online = false;
  let pendingBuilding: { id: string; phase: 'unlock' | 'visit'; continueInteraction: () => void } | null = null;
  let panel: HTMLElement | null = null;
  let shopPanel: HTMLElement | null = null;
  let inventoryList: HTMLElement | null = null;
  let currencyValue: HTMLElement | null = null;
  let shopCurrencyValue: HTMLElement | null = null;
  let shopArea: HTMLElement | null = null;
  const pendingConsumption = new Map<string, (consumed: boolean) => void>();
  const pendingRewards = new Map<string, {
    claimSequence?: number;
    resolve: (claimed: boolean) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  let pendingFilmCity: ((purchased: boolean) => void) | null = null;

  function pendingRewardStorageKey(rewardId: string): string {
    const resident = options.document.defaultView?.localStorage.getItem('minicityUser') || 'visitor';
    return `minicityPendingReward:${resident}:${rewardId}`;
  }

  function pendingRewardSequence(rewardId: string): number | null {
    try {
      const value = Number(options.document.defaultView?.localStorage.getItem(pendingRewardStorageKey(rewardId)));
      return Number.isSafeInteger(value) && value > 0 ? value : null;
    } catch {
      return null;
    }
  }

  function storePendingRewardSequence(rewardId: string, claimSequence: number): void {
    try { options.document.defaultView?.localStorage.setItem(pendingRewardStorageKey(rewardId), String(claimSequence)); } catch { /* Storage can be unavailable in privacy modes. */ }
  }

  function clearPendingRewardSequence(rewardId: string): void {
    try { options.document.defaultView?.localStorage.removeItem(pendingRewardStorageKey(rewardId)); } catch { /* Storage can be unavailable in privacy modes. */ }
  }

  function setup(): void {
    panel = options.document.getElementById('onlineInventoryView');
    if (!panel) return;
    shopPanel = options.document.createElement('aside');
    shopPanel.id = 'shopPanel';
    shopPanel.className = 'stats-panel shop-panel';
    shopPanel.setAttribute('role', 'dialog');
    shopPanel.setAttribute('aria-label', '物实商店');
    shopPanel.innerHTML = `
      <div class="sp-head">
        <span class="sp-title shop-title">物实商店 <small><strong data-shop-currency>0</strong> 物实币</small></span>
        <button class="sp-close" type="button" data-shop-close aria-label="关闭物实商店">X</button>
      </div>
      <div class="sp-body">
        <div class="sp-unlocks" data-shop-area><div data-shop-list></div></div>
      </div>`;
    options.document.body.appendChild(shopPanel);
    inventoryList = panel.querySelector('[data-inventory-list]');
    currencyValue = panel.querySelector('[data-currency]');
    shopArea = shopPanel.querySelector('[data-shop-area]');
    shopCurrencyValue = shopPanel.querySelector('[data-shop-currency]');
    shopPanel.querySelector('[data-shop-close]')?.addEventListener('click', closeShop, { signal: options.signal });
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
      const pending = pendingRewards.get(event.rewardId);
      const sequenceMatches = event.claimSequence === undefined || pending?.claimSequence === undefined || pending.claimSequence === event.claimSequence;
      if (pending && sequenceMatches) {
        const accepted = pending.claimSequence === undefined ? Boolean(event.claimed) : event.accepted === true || event.claimed === true;
        if (accepted && pending.claimSequence !== undefined) clearPendingRewardSequence(event.rewardId);
        clearTimeout(pending.timeout);
        pending.resolve(accepted);
        pendingRewards.delete(event.rewardId);
      }
    }
    if (event?.type === 'film_city.experience' && pendingFilmCity) {
      const resolve = pendingFilmCity;
      pendingFilmCity = null;
      resolve(event.purchased !== false);
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
else if (event.type === 'shop.purchased') {
      const productName = event.productId ? catalog.products[event.productId]?.name : undefined;
      options.showToast(`${productName ?? '商品'}已放入背包`);
    }
    else if (event.type === 'reward.claimed' && event.rewardId === 'tirpitz_beach') options.showToast(event.claimed ? '皮尔皮茨号已放入背包' : '皮尔皮茨号已经领取过了');
    else if (event.type === 'reward.claimed' && event.rewardId && iceRewardById.has(event.rewardId)) {
      const reward = iceRewardById.get(event.rewardId)!;
      options.showToast(event.claimed ? reward.claimedMessage : event.accepted ? reward.confirmedMessage : reward.failedMessage);
    }
    else if (event.type === 'reward.claimed') options.showToast(event.claimed ? '今日沃柑已放入背包' : '今天已经领取过沃柑了');
  }

  function render(): void {
    if (currencyValue) currencyValue.textContent = String(progress.currency);
    if (shopCurrencyValue) shopCurrencyValue.textContent = String(progress.currency);
    if (inventoryList) {
      const entries = inventoryEntries(progress);
      inventoryList.replaceChildren(...(entries.length ? entries.map((entry) => {
        const row = options.document.createElement('div');
        row.className = 'sp-ul-item done';
        row.dataset.itemId = entry.itemId;
        const icon = options.document.createElement('span');
        icon.className = 'inventory-item-icon';
        icon.textContent = entry.itemId === 'mandarin' ? '柑' : entry.itemId === 'dragonwell_tea' ? '茶' : entry.itemId === 'beef' ? '肉' : entry.itemId === 'radish' ? '萝' : entry.itemId === 'music_box' ? '音' : entry.itemId === 'city_badge' ? '章' : entry.itemId === 'tirpitz_card' ? '舰' : entry.itemId === ICE_KING_ITEMS.wetCrown.id ? ICE_KING_ITEMS.wetCrown.icon : entry.itemId === ICE_KING_ITEMS.lemonade.id ? ICE_KING_ITEMS.lemonade.icon : '册';
        const name = options.document.createElement('span');
        name.className = 'sp-ul-name';
        name.textContent = entry.name;
        const detail = ITEM_DETAILS[entry.itemId];
        if (detail) {
          const copy = options.document.createElement('span');
          copy.className = 'sp-ul-copy';
          name.replaceWith(copy);
          const detailText = options.document.createElement('small');
          detailText.textContent = detail;
          copy.append(name, detailText);
        }
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
  }

  function renderShop(): void {
    const list = shopArea?.querySelector<HTMLElement>('[data-shop-list]');
    if (!list) return;
    list.replaceChildren(...Object.entries(catalog.products).map(([productId, product]) => {
      const presentation = PRODUCT_PRESENTATIONS[product.itemId] ?? { icon: '物', detail: `${product.name} · 商场在售商品` };
      const row = options.document.createElement('div');
      row.className = 'shop-product';
      row.dataset.productId = productId;
      const icon = options.document.createElement('span');
      icon.className = 'shop-product-icon';
      icon.textContent = presentation.icon;
      const copy = options.document.createElement('span');
      copy.className = 'shop-product-copy';
      const name = options.document.createElement('span');
      name.className = 'sp-ul-name';
      name.textContent = product.name;
      const detail = options.document.createElement('small');
      detail.textContent = presentation.detail;
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
    options.openPhoneView('inventory');
  }

  function openShop(): void {
    if (!online) return offlineNotice();
    shopPanel?.classList.add('open');
  }

  function closeShop(): void { shopPanel?.classList.remove('open'); }

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

  function nextRewardClaimSequence(rewardId: string): number | null {
    if (!repeatableRewardIds.has(rewardId)) return null;
    return pendingRewardSequence(rewardId) ?? (progress.repeatableRewardClaims[rewardId] ?? 0) + 1;
  }

  function claimReward(rewardId: string, requestedSequence?: number): Promise<boolean> {
    if (!online) { offlineNotice(); return Promise.resolve(false); }
    if (pendingRewards.has(rewardId)) return Promise.resolve(false);
    const claimSequence = repeatableRewardIds.has(rewardId)
      ? requestedSequence ?? nextRewardClaimSequence(rewardId) ?? undefined
      : undefined;
    if (claimSequence !== undefined) storePendingRewardSequence(rewardId, claimSequence);
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        const pending = pendingRewards.get(rewardId);
        if (!pending || pending.resolve !== resolve) return;
        pendingRewards.delete(rewardId);
        resolve(false);
      }, 10_000);
      pendingRewards.set(rewardId, { claimSequence, resolve, timeout });
      if (!options.send({ type: 'progress.reward.claim', rewardId, claimSequence })) {
        const pending = pendingRewards.get(rewardId);
        if (pending) clearTimeout(pending.timeout);
        pendingRewards.delete(rewardId);
        resolve(false);
      }
    });
  }

  function purchaseFilmCityExperience(): Promise<boolean> {
    if (!online) { offlineNotice(); return Promise.resolve(false); }
    if (progress.currency < 400 || pendingFilmCity) {
      if (progress.currency < 400) options.showToast('体验需要 400 物实币，余额不足');
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      pendingFilmCity = resolve;
      if (!options.send({ type: 'progress.filmCity.experience' })) {
        pendingFilmCity = null;
        resolve(false);
      }
    });
  }

  function offlineNotice(): void { options.showToast('此功能需要连接服务器'); }

  function handleError(): void {
    pendingBuilding = null;
    pendingConsumption.forEach((resolve) => resolve(false));
    pendingRewards.forEach(({ resolve, timeout }) => { clearTimeout(timeout); resolve(false); });
    pendingConsumption.clear();
    pendingRewards.clear();
    pendingFilmCity?.(false);
    pendingFilmCity = null;
  }

  function destroy(): void { handleError(); shopPanel?.remove(); shopPanel = null; panel = null; }

  return {
    setup, setConnection, applySnapshot, interactBuilding, unlockAchievement, syncAchievements,
 buyProduct, consumeItem, purchaseFilmCityExperience, nextRewardClaimSequence, claimReward, openInventory, openShop,
    getProgress: () => progress,
    getQuestProgressView: () => toQuestProgressView(progress),
    isOnline: () => online, handleError,
    destroy,
  };
}
