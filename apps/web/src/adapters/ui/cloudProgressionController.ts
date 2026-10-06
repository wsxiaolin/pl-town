import {
  EMPTY_PLAYER_PROGRESS,
  EMPTY_PROGRESSION_CATALOG,
  canInteractWithBuilding,
  inventoryEntries,
  ITEM_DETAILS,
  ITEM_LABELS,
  normalizePlayerProgress,
  toQuestProgressView,
  type MarketListingView,
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
  | { type: 'progress.shop.buy'; productId: string; quantity?: number; dealDay?: string }
  | { type: 'progress.daily.checkin' }
  | { type: 'progress.daily.mission.claim'; missionId: string }
  | { type: 'market.recipe.craft'; recipeId: string }
  | { type: 'market.supply.fulfill'; orderId: string }
  | { type: 'market.listings.get' }
  | { type: 'market.listing.create'; itemId: string; quantity: number; price: number }
  | { type: 'market.listing.buy'; listingId: string }
  | { type: 'market.listing.cancel'; listingId: string }
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
// Known items keep their hand-picked glyph; an admin-configured product falls
// back to the first character of its (possibly renamed) configured name.
const KNOWN_ITEM_ICONS: Readonly<Record<string, string>> = Object.freeze({
  city_guide: '册', mandarin: '柑', dragonwell_tea: '茶', beef: '肉', radish: '萝',
  music_box: '音', city_badge: '章', tirpitz_card: '舰',
  shared_meal: '炖', tea_service: '席', memory_parcel: '礼',
  [ICE_KING_ITEMS.wetCrown.id]: ICE_KING_ITEMS.wetCrown.icon,
  [ICE_KING_ITEMS.lemonade.id]: ICE_KING_ITEMS.lemonade.icon,
});
const itemIcon = (itemId: string, name: string): string => KNOWN_ITEM_ICONS[itemId] ?? name.charAt(0) ?? '册';
// The server settles listings at unit price × quantity (db.ts buyMarketListing);
// a single helper keeps label, disabled rule and click guard from drifting apart.
const listingTotal = (listing: MarketListingView): number => listing.price * listing.quantity;
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
  let shopTabs: HTMLElement | null = null;
  let dailyBoard: HTMLElement | null = null;
  let exchangeBoard: HTMLElement | null = null;
  let activeShopCategory: 'all' | 'food' | 'story' = 'all';
  const shopQuantities = new Map<string, number>();
  const pendingShopProducts = new Set<string>();
  const pendingDailyClaims = new Set<string>();
  const pendingMarketActions = new Set<string>();
  let listings: { active: MarketListingView[]; own: MarketListingView[] } = { active: [], own: [] };
  // Names of every product ever seen in a catalog. The live catalog drops
  // delisted admin products, but residents who already own them must keep
  // their display name in the backpack instead of degrading to a raw itemId.
  const lastKnownProductNames = new Map<string, string>();
  const listingDraft = { itemId: '', quantity: 1, price: 1 };
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
    shopPanel.setAttribute('aria-label', '物实市集');
    shopPanel.innerHTML = `
      <div class="sp-head">
        <span class="sp-title shop-title">物实市集 <small><strong data-shop-currency>0</strong> 物实币</small></span>
        <button class="sp-close" type="button" data-shop-close aria-label="关闭物实市集">X</button>
      </div>
      <div class="sp-body">
        <section class="market-daily" data-daily-board aria-label="今日任务"></section>
        <nav class="market-tabs" data-market-tabs aria-label="商品分类"></nav>
        <div class="market-products" data-shop-area><div data-shop-list></div></div>
        <section class="market-exchange" data-market-exchange aria-label="市集工坊与交易所"></section>
      </div>`;
    options.document.body.appendChild(shopPanel);
    inventoryList = panel.querySelector('[data-inventory-list]');
    currencyValue = panel.querySelector('[data-currency]');
    shopArea = shopPanel.querySelector('[data-shop-area]');
    shopTabs = shopPanel.querySelector('[data-market-tabs]');
    dailyBoard = shopPanel.querySelector('[data-daily-board]');
    exchangeBoard = shopPanel.querySelector('[data-market-exchange]');
    shopCurrencyValue = shopPanel.querySelector('[data-shop-currency]');
    shopPanel.querySelector('[data-shop-close]')?.addEventListener('click', closeShop, { signal: options.signal });
    shopPanel.addEventListener('click', onShopClick, { signal: options.signal });
    shopPanel.addEventListener('input', onShopInput, { signal: options.signal });
    render();
  }

  function setConnection(isOnline: boolean): void {
    online = isOnline;
    if (!online) handleError();
    render();
  }

  function applySnapshot(next: unknown, nextCatalog: ProgressionCatalog | undefined, event?: ProgressionEvent): void {
    progress = normalizePlayerProgress(next);
    if (nextCatalog) mergeCatalog(nextCatalog);
    if (event?.type === 'shop.purchased' && event.productId) pendingShopProducts.delete(event.productId);
    if (event?.type === 'daily.checkin') pendingDailyClaims.delete('checkin');
    if (event?.type === 'daily.mission.claimed' && event.missionId) pendingDailyClaims.delete(`mission:${event.missionId}`);
    if (event?.type === 'market.crafted' && event.recipeId) pendingMarketActions.delete(`craft:${event.recipeId}`);
    if (event?.type === 'market.order.fulfilled' && event.orderId) pendingMarketActions.delete(`order:${event.orderId}`);
    if ((event?.type === 'market.listing.created' || event?.type === 'market.listing.cancelled') && event.listingId) {
      pendingMarketActions.delete('listing:create');
      pendingMarketActions.delete(`listing:${event.listingId}`);
    }
    if (event?.type === 'market.listing.sold' && event.listingId) pendingMarketActions.delete(`listing:${event.listingId}`);
    if (event?.type === 'market.listing.sold') requestListings();
    evaluateStatAchievements();
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

  // A world-config change (admin building unlock overrides) refreshes the
  // catalog for already-connected residents without touching their progress.
  // Merge onto the current catalog so an omitted field in a partial push keeps
  // its previous value instead of falling back to undefined.
  function applyCatalog(nextCatalog: ProgressionCatalog | undefined): void {
    if (!nextCatalog) return;
    mergeCatalog(nextCatalog);
    render();
  }

  function mergeCatalog(nextCatalog: ProgressionCatalog): void {
    for (const [itemId, product] of Object.entries(nextCatalog.products ?? {})) {
      if (product?.name) lastKnownProductNames.set(itemId, product.name);
    }
    catalog = {
      ...catalog,
      ...nextCatalog,
      products: nextCatalog.products ?? catalog.products,
      dailyCheckIn: nextCatalog.dailyCheckIn ?? catalog.dailyCheckIn,
      dailyMissions: nextCatalog.dailyMissions ?? catalog.dailyMissions,
      store: nextCatalog.store ? { ...catalog.store, ...nextCatalog.store } : catalog.store,
      recipes: nextCatalog.recipes ?? catalog.recipes,
      dailySupplyOrder: nextCatalog.dailySupplyOrder ?? catalog.dailySupplyOrder,
      market: nextCatalog.market ?? catalog.market,
      tradeableItemIds: nextCatalog.tradeableItemIds ?? catalog.tradeableItemIds,
    };
    if (listingDraft.itemId && !isTradeable(listingDraft.itemId)) { listingDraft.itemId = ''; listingDraft.quantity = 1; }
  }

  /** Catalog products plus remembered names for items that were delisted. */
  function knownProducts(): Record<string, { name: string }> {
    const merged: Record<string, { name: string }> = {};
    for (const [itemId, name] of lastKnownProductNames) merged[itemId] = { name };
    for (const [itemId, product] of Object.entries(catalog.products)) merged[itemId] = { name: product.name };
    return merged;
  }

  /** Server push of the escrow board (also covers other residents' trades). */
  function applyListings(next: unknown): void {
    if (!next || typeof next !== 'object') return;
    const input = next as { active?: unknown; own?: unknown };
    const validListing = (value: unknown): value is MarketListingView => Boolean(value && typeof value === 'object'
      && typeof (value as MarketListingView).id === 'string' && typeof (value as MarketListingView).itemId === 'string');
    listings = {
      active: Array.isArray(input.active) ? input.active.filter(validListing) : [],
      own: Array.isArray(input.own) ? input.own.filter(validListing) : [],
    };
    renderExchange();
  }

  function requestListings(): void {
    if (online) options.send({ type: 'market.listings.get' });
  }

  function isTradeable(itemId: string): boolean {
    return catalog.tradeableItemIds?.includes(itemId) ?? false;
  }

  function itemName(itemId: string): string {
    return catalog.products[itemId]?.name ?? lastKnownProductNames.get(itemId) ?? ITEM_LABELS[itemId] ?? itemId;
  }

  function describeEvent(event?: ProgressionEvent): void {
    if (!event) return;
    if (event.welcomeItemsGranted) options.showToast('背包已解锁，获得城市导览册和居民纪念徽章');
    else if (event.type === 'achievement.unlocked' && event.reward) options.showToast(`成就奖励 +${event.reward} 物实币`);
    else if (event.type === 'shop.purchased') {
      const productName = event.productId ? catalog.products[event.productId]?.name : undefined;
      options.showToast(`${productName ?? '商品'}已放入背包${event.pricePaid ? ` · 支付 ${event.pricePaid} 币` : ''}`);
    }
    else if (event.type === 'daily.checkin') options.showToast(event.claimed ? `签到成功，获得 ${event.reward ?? 0} 物实币 · 连续 ${event.streak ?? 1} 天` : '今天已经签到过了');
    else if (event.type === 'daily.mission.claimed') options.showToast(event.claimed ? `今日委托完成，获得 ${event.reward ?? 0} 物实币` : '先完成今日委托再来领取');
    else if (event.type === 'market.crafted') options.showToast(event.crafted ? `${catalog.recipes?.find((recipe) => recipe.id === event.recipeId)?.name ?? '合成品'}已放入背包` : '合成失败，食材不足');
    else if (event.type === 'market.order.fulfilled') options.showToast(event.fulfilled ? `供货完成，获得 ${event.reward ?? 0} 物实币` : '这份委托今天已经交付过了');
    else if (event.type === 'market.listing.payout') options.showToast(`挂单售出，收到 ${(event.price ?? 0) * (event.quantity ?? 0)} 物实币`);
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
      const entries = inventoryEntries(progress, knownProducts());
      inventoryList.replaceChildren(...(entries.length ? entries.map((entry) => {
        const row = options.document.createElement('div');
        row.className = 'sp-ul-item done';
        row.dataset.itemId = entry.itemId;
        const icon = options.document.createElement('span');
        icon.className = 'inventory-item-icon';
        icon.textContent = itemIcon(entry.itemId, entry.name);
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
    renderDailyBoard();
    renderShop();
    renderExchange();
    const hasInventory = progress.visitedBuildings.length >= 2;
    const welcome = options.document.querySelector<HTMLElement>('.welcome-block');
    welcome?.classList.remove('hidden');
    welcome?.querySelectorAll<HTMLElement>('.welcome-main, .welcome-sub, .welcome-accent').forEach((element) => { element.hidden = hasInventory; });
  }

  function renderShop(): void {
    const list = shopArea?.querySelector<HTMLElement>('[data-shop-list]');
    if (!list) return;
    const categories = [
      { id: 'all' as const, label: '全部' },
      { id: 'food' as const, label: '食材' },
      { id: 'story' as const, label: '剧情道具' },
    ];
    shopTabs?.replaceChildren(...categories.map((category) => {
      const tab = options.document.createElement('button');
      tab.type = 'button';
      tab.className = `market-tab${activeShopCategory === category.id ? ' active' : ''}`;
      tab.dataset.marketCategory = category.id;
      tab.setAttribute('aria-pressed', String(activeShopCategory === category.id));
      tab.textContent = category.label;
      return tab;
    }));
    const entries = Object.entries(catalog.products).filter(([, product]) => activeShopCategory === 'all' || product.category === activeShopCategory);
    list.replaceChildren(...(entries.length ? entries.map(([productId, product]) => {
      const presentation = PRODUCT_PRESENTATIONS[product.itemId] ?? { icon: itemIcon(product.itemId, product.name), detail: `${product.name} · 商场在售商品` };
      const row = options.document.createElement('div');
      row.className = `shop-product${productId === catalog.store.featuredProductId ? ' featured' : ''}`;
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
      const deal = productId === catalog.store.featuredProductId && catalog.store.dayKey.length > 0;
      if (deal) {
        const badge = options.document.createElement('span');
        badge.className = 'market-deal-badge';
        badge.textContent = `今日特惠 −${catalog.store.discountPercent}%`;
        copy.append(badge);
      }
      const price = deal ? Math.max(1, Math.floor(product.unitPrice * (100 - catalog.store.discountPercent) / 100)) : product.unitPrice;
      const unitPrice = options.document.createElement('span');
      unitPrice.className = 'market-unit-price';
      unitPrice.textContent = deal ? `${product.unitPrice} → ${price} 币/件` : `${price} 币/件`;
      copy.append(unitPrice);
      const quantity = Math.max(1, Math.min(20, shopQuantities.get(productId) ?? 1));
      const controls = options.document.createElement('div');
      controls.className = 'market-purchase-controls';
      const quantityPicker = options.document.createElement('div');
      quantityPicker.className = 'market-quantity';
      const decrease = options.document.createElement('button');
      decrease.type = 'button';
      decrease.className = 'market-quantity-step';
      decrease.dataset.quantityStep = '-1';
      decrease.dataset.productId = productId;
      decrease.setAttribute('aria-label', `减少${product.name}数量`);
      decrease.textContent = '−';
      const count = options.document.createElement('span');
      count.className = 'market-quantity-value';
      count.textContent = String(quantity);
      const increase = options.document.createElement('button');
      increase.type = 'button';
      increase.className = 'market-quantity-step';
      increase.dataset.quantityStep = '1';
      increase.dataset.productId = productId;
      increase.setAttribute('aria-label', `增加${product.name}数量`);
      increase.textContent = '+';
      quantityPicker.append(decrease, count, increase);
      const total = price * quantity;
      const buy = options.document.createElement('button');
      buy.type = 'button';
      buy.className = 'inventory-buy';
      buy.dataset.shopBuy = productId;
      buy.textContent = `购买 · ${total} 币`;
      buy.disabled = !online || progress.currency < total || pendingShopProducts.has(productId);
      controls.append(quantityPicker, buy);
      row.append(icon, copy, controls);
      return row;
    }) : [emptyRow('这个货架今天没有商品')]));
  }

  function renderDailyBoard(): void {
    if (!dailyBoard) return;
    const daily = progress.daily;
    const claimedToday = daily.checkInClaimed;
    const previousStreak = claimedToday ? Math.max(0, daily.checkInStreak - 1) : daily.checkInStreak;
    const checkInReward = catalog.dailyCheckIn.baseReward + Math.min(previousStreak * catalog.dailyCheckIn.streakBonus, catalog.dailyCheckIn.maxStreakBonus);
    const checkIn = options.document.createElement('article');
    checkIn.className = 'market-checkin';
    const checkInCopy = options.document.createElement('div');
    checkInCopy.className = 'market-checkin-copy';
    const checkInTitle = options.document.createElement('strong');
    checkInTitle.textContent = claimedToday || daily.checkInStreak > 0 ? `连续签到 ${daily.checkInStreak} 天` : '今日签到';
    const checkInDetail = options.document.createElement('small');
    checkInDetail.textContent = claimedToday ? '明天再来，连续签到奖励会继续增加' : `领取 ${checkInReward} 币${daily.checkInStreak ? ' · 明日奖励继续增加' : ''}`;
    checkInCopy.append(checkInTitle, checkInDetail);
    const checkInButton = options.document.createElement('button');
    checkInButton.type = 'button';
    checkInButton.className = 'market-claim-button';
    checkInButton.dataset.dailyCheckin = 'true';
    checkInButton.textContent = claimedToday ? '已签到' : pendingDailyClaims.has('checkin') ? '领取中…' : '领取';
    checkInButton.disabled = !online || claimedToday || pendingDailyClaims.has('checkin');
    checkIn.append(checkInCopy, checkInButton);

    const heading = options.document.createElement('div');
    heading.className = 'market-daily-heading';
    const title = options.document.createElement('strong');
    title.textContent = '今日城市委托';
    const date = options.document.createElement('small');
    date.textContent = daily.dayKey;
    heading.append(title, date);
    const missions = catalog.dailyMissions.map((mission) => {
      const item = options.document.createElement('article');
      const complete = daily.claimedMissions.includes(mission.id);
      const count = Math.min(mission.target, daily.visitedBuildings.length);
      item.className = `market-mission${complete ? ' complete' : ''}`;
      const copy = options.document.createElement('div');
      copy.className = 'market-mission-copy';
      const missionTitle = options.document.createElement('strong');
      missionTitle.textContent = mission.title;
      const description = options.document.createElement('small');
      description.textContent = `${mission.description} · ${count}/${mission.target}`;
      const progress = options.document.createElement('span');
      progress.className = 'market-mission-track';
      const fill = options.document.createElement('span');
      fill.style.width = `${Math.min(100, count / mission.target * 100)}%`;
      progress.append(fill);
      copy.append(missionTitle, description, progress);
      const claim = options.document.createElement('button');
      claim.type = 'button';
      claim.className = 'market-claim-button';
      claim.dataset.dailyClaim = mission.id;
      claim.textContent = complete ? '已领取' : pendingDailyClaims.has(`mission:${mission.id}`) ? '领取中…' : `+${mission.reward}`;
      claim.disabled = !online || complete || count < mission.target || pendingDailyClaims.has(`mission:${mission.id}`);
      item.append(copy, claim);
      return item;
    });
    dailyBoard.replaceChildren(checkIn, heading, ...missions);
  }

  function renderExchange(): void {
    if (!exchangeBoard) return;
    const children: HTMLElement[] = [];
    const order = catalog.dailySupplyOrder;
    if (order && catalog.dailySupplyOrder?.id) {
      const fulfilled = progress.daily.fulfilledOrders.includes(order.id);
      const item = options.document.createElement('article');
      item.className = `market-order${fulfilled ? ' complete' : ''}`;
      const copy = options.document.createElement('div');
      copy.className = 'market-order-copy';
      const title = options.document.createElement('strong');
      title.textContent = `今日供货 · ${order.title}`;
      const detail = options.document.createElement('small');
      detail.textContent = `${order.description} 需要 ${order.requirements.map((requirement) => `${itemName(requirement.itemId)}×${requirement.quantity}`).join('、')} · 报酬 ${order.reward} 币`;
      copy.append(title, detail);
      const claim = options.document.createElement('button');
      claim.type = 'button';
      claim.className = 'market-claim-button';
      claim.dataset.supplyFulfill = order.id;
      claim.textContent = fulfilled ? '已交付' : pendingMarketActions.has(`order:${order.id}`) ? '交付中…' : `+${order.reward}`;
      claim.disabled = !online || fulfilled || pendingMarketActions.has(`order:${order.id}`);
      item.append(copy, claim);
      children.push(item);
    }
    for (const recipe of catalog.recipes ?? []) {
      const canCraft = recipe.ingredients.every((ingredient) => (progress.inventory[ingredient.itemId] ?? 0) >= ingredient.quantity);
      const item = options.document.createElement('article');
      item.className = 'market-recipe';
      const copy = options.document.createElement('div');
      copy.className = 'market-recipe-copy';
      const title = options.document.createElement('strong');
      title.textContent = recipe.name;
      const detail = options.document.createElement('small');
      detail.textContent = `${recipe.ingredients.map((ingredient) => `${itemName(ingredient.itemId)}×${ingredient.quantity}`).join(' + ')} → ${itemName(recipe.output.itemId)}×${recipe.output.quantity} · ${recipe.description}`;
      copy.append(title, detail);
      const craft = options.document.createElement('button');
      craft.type = 'button';
      craft.className = 'market-claim-button';
      craft.dataset.recipeCraft = recipe.id;
      craft.textContent = canCraft ? '合成' : '缺食材';
      craft.disabled = !online || !canCraft || pendingMarketActions.has(`craft:${recipe.id}`);
      item.append(copy, craft);
      children.push(item);
    }

    const board = options.document.createElement('div');
    board.className = 'market-board-heading';
    const boardTitle = options.document.createElement('strong');
    boardTitle.textContent = '居民交易所';
    const boardHint = options.document.createElement('small');
    boardHint.textContent = `挂单上限 ${catalog.market?.maxActiveListings ?? 6} 个 · 每单 1–${catalog.market?.maxListingQuantity ?? 20} 件`;
    board.append(boardTitle, boardHint);
    children.push(board);

    const draft = options.document.createElement('div');
    draft.className = 'market-listing-draft';
    const itemSelect = options.document.createElement('select');
    itemSelect.dataset.listingItem = 'true';
    itemSelect.setAttribute('aria-label', '选择要出售的物品');
    const tradeable = (catalog.tradeableItemIds ?? []).filter((itemId) => (progress.inventory[itemId] ?? 0) > 0);
    const placeholder = options.document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '选择背包物品';
    placeholder.disabled = true;
    itemSelect.append(placeholder);
    for (const itemId of tradeable) {
      const option = options.document.createElement('option');
      option.value = itemId;
      option.textContent = `${itemName(itemId)} ×${progress.inventory[itemId]}`;
      itemSelect.append(option);
    }
    if (listingDraft.itemId && tradeable.includes(listingDraft.itemId)) itemSelect.value = listingDraft.itemId;
    else itemSelect.value = '';
    itemSelect.disabled = tradeable.length === 0;
    const quantityInput = options.document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.min = '1';
    quantityInput.max = String(catalog.market?.maxListingQuantity ?? 20);
    quantityInput.value = String(listingDraft.quantity);
    quantityInput.dataset.listingQuantity = 'true';
    quantityInput.setAttribute('aria-label', '出售数量');
    const priceInput = options.document.createElement('input');
    priceInput.type = 'number';
    priceInput.min = '1';
    priceInput.max = String(catalog.market?.maxListingPrice ?? 9999);
    priceInput.value = String(listingDraft.price);
    priceInput.dataset.listingPrice = 'true';
    priceInput.setAttribute('aria-label', '单价');
    const create = options.document.createElement('button');
    create.type = 'button';
    create.className = 'market-claim-button';
    create.dataset.listingCreate = 'true';
    create.textContent = '挂单出售';
    create.disabled = !online || !listingDraft.itemId || !tradeable.includes(listingDraft.itemId);
    draft.append(itemSelect, quantityInput, priceInput, create);
    children.push(draft);

    if (listings.own.length) {
      const ownHeading = options.document.createElement('div');
      ownHeading.className = 'market-board-subheading';
      ownHeading.textContent = '我的挂单';
      const ownWrap = options.document.createElement('div');
      ownWrap.className = 'market-own-listings';
      ownWrap.dataset.ownListings = 'true';
      ownWrap.append(...listings.own.map((listing) => listingRow(listing, true)));
      children.push(ownHeading, ownWrap);
    }
    // 自家挂单已在「我的挂单」区展示（且不能买自己），交易所区只显示他人的在售单。
    const ownActiveIds = new Set(listings.own.filter((listing) => listing.status === 'active').map((listing) => listing.id));
    const otherActive = listings.active.filter((listing) => !ownActiveIds.has(listing.id));
    children.push(...(otherActive.length
      ? otherActive.map((listing) => listingRow(listing, false))
      : [emptyRow('交易所暂时没有在售挂单')]));
    exchangeBoard.replaceChildren(...children);
  }

  function listingRow(listing: MarketListingView, own: boolean): HTMLElement {
    const row = options.document.createElement('div');
    row.className = 'market-listing';
    row.dataset.listingId = listing.id;
    const icon = options.document.createElement('span');
    icon.className = 'inventory-item-icon';
    icon.textContent = itemIcon(listing.itemId, itemName(listing.itemId));
    const copy = options.document.createElement('div');
    copy.className = 'market-listing-copy';
    const name = options.document.createElement('span');
    name.className = 'sp-ul-name';
    name.textContent = `${itemName(listing.itemId)} ×${listing.quantity}`;
    const detail = options.document.createElement('small');
    detail.textContent = listing.status === 'active'
      ? `${listing.sellerNickname} · 单价 ${listing.price} 币 · 合计 ${listingTotal(listing)} 币${own ? ' · 在售中' : ''}`
      : `${listing.sellerNickname} · ${listing.status === 'sold' ? '已售出' : '已取消'} · 单价 ${listing.price} 币`;
    copy.append(name, detail);
    if (own && listing.status === 'active') {
      const cancel = options.document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'market-claim-button secondary';
      cancel.dataset.listingCancel = listing.id;
      cancel.textContent = '下架';
      cancel.disabled = !online || pendingMarketActions.has(`listing:${listing.id}`);
      row.append(icon, copy, cancel);
      return row;
    }
    if (listing.status === 'active') {
      const buy = options.document.createElement('button');
      buy.type = 'button';
      buy.className = 'market-claim-button';
      buy.dataset.listingBuy = listing.id;
      buy.textContent = `购买 · ${listingTotal(listing)} 币`;
      buy.disabled = !online || progress.currency < listingTotal(listing) || pendingMarketActions.has(`listing:${listing.id}`);
      row.append(icon, copy, buy);
      return row;
    }
    row.className += ' closed';
    row.append(icon, copy);
    return row;
  }

  function onShopClick(event: MouseEvent): void {
    const target = event.target;
    const ElementConstructor = options.document.defaultView?.Element;
    if (!ElementConstructor || !(target instanceof ElementConstructor)) return;
    const category = target.closest<HTMLElement>('[data-market-category]')?.dataset.marketCategory;
    if (category === 'all' || category === 'food' || category === 'story') {
      activeShopCategory = category;
      renderShop();
      return;
    }
    const checkIn = target.closest<HTMLElement>('[data-daily-checkin]');
    if (checkIn) {
      if (pendingDailyClaims.has('checkin') || progress.daily.checkInClaimed || !online) return;
      pendingDailyClaims.add('checkin');
      renderDailyBoard();
      if (!options.send({ type: 'progress.daily.checkin' })) { pendingDailyClaims.delete('checkin'); renderDailyBoard(); }
      return;
    }
    const dailyClaim = target.closest<HTMLElement>('[data-daily-claim]')?.dataset.dailyClaim;
    if (dailyClaim) {
      const key = `mission:${dailyClaim}`;
      if (pendingDailyClaims.has(key) || !online) return;
      pendingDailyClaims.add(key);
      renderDailyBoard();
      if (!options.send({ type: 'progress.daily.mission.claim', missionId: dailyClaim })) { pendingDailyClaims.delete(key); renderDailyBoard(); }
      return;
    }
    const quantityButton = target.closest<HTMLElement>('[data-quantity-step]');
    if (quantityButton?.dataset.productId) {
      const productId = quantityButton.dataset.productId;
      const current = shopQuantities.get(productId) ?? 1;
      shopQuantities.set(productId, Math.max(1, Math.min(20, current + Number(quantityButton.dataset.quantityStep))));
      renderShop();
      return;
    }
    const supplyFulfill = target.closest<HTMLElement>('[data-supply-fulfill]')?.dataset.supplyFulfill;
    if (supplyFulfill) {
      const key = `order:${supplyFulfill}`;
      if (pendingMarketActions.has(key) || !online) return;
      pendingMarketActions.add(key);
      renderExchange();
      if (!options.send({ type: 'market.supply.fulfill', orderId: supplyFulfill })) { pendingMarketActions.delete(key); renderExchange(); }
      return;
    }
    const recipeCraft = target.closest<HTMLElement>('[data-recipe-craft]')?.dataset.recipeCraft;
    if (recipeCraft) {
      const key = `craft:${recipeCraft}`;
      if (pendingMarketActions.has(key) || !online) return;
      pendingMarketActions.add(key);
      renderExchange();
      if (!options.send({ type: 'market.recipe.craft', recipeId: recipeCraft })) { pendingMarketActions.delete(key); renderExchange(); }
      return;
    }
    const listingCancel = target.closest<HTMLElement>('[data-listing-cancel]')?.dataset.listingCancel;
    if (listingCancel) {
      const key = `listing:${listingCancel}`;
      if (pendingMarketActions.has(key) || !online) return;
      pendingMarketActions.add(key);
      renderExchange();
      if (!options.send({ type: 'market.listing.cancel', listingId: listingCancel })) { pendingMarketActions.delete(key); renderExchange(); }
      return;
    }
    const listingBuy = target.closest<HTMLElement>('[data-listing-buy]')?.dataset.listingBuy;
    if (listingBuy) {
      const key = `listing:${listingBuy}`;
      const listing = listings.active.find((entry) => entry.id === listingBuy);
      if (!listing || pendingMarketActions.has(key) || !online) return;
      if (progress.currency < listingTotal(listing)) { options.showToast('余额不足，买不下这份挂单'); return; }
      pendingMarketActions.add(key);
      renderExchange();
      if (!options.send({ type: 'market.listing.buy', listingId: listingBuy })) { pendingMarketActions.delete(key); renderExchange(); }
      return;
    }
    const listingCreate = target.closest<HTMLElement>('[data-listing-create]');
    if (listingCreate) {
      if (!online || !listingDraft.itemId || !isTradeable(listingDraft.itemId)) return;
      const maxQuantity = catalog.market?.maxListingQuantity ?? 20;
      const maxPrice = catalog.market?.maxListingPrice ?? 9999;
      const quantity = Math.max(1, Math.min(maxQuantity, Math.floor(listingDraft.quantity)));
      const price = Math.max(1, Math.min(maxPrice, Math.floor(listingDraft.price)));
      if (!Number.isFinite(quantity) || !Number.isFinite(price) || (progress.inventory[listingDraft.itemId] ?? 0) < quantity) return;
      const key = 'listing:create';
      if (pendingMarketActions.has(key)) return;
      pendingMarketActions.add(key);
      renderExchange();
      if (!options.send({ type: 'market.listing.create', itemId: listingDraft.itemId, quantity, price })) { pendingMarketActions.delete(key); renderExchange(); }
      return;
    }
    const productId = target.closest<HTMLElement>('[data-shop-buy]')?.dataset.shopBuy;
    if (!productId) return;
    const quantity = shopQuantities.get(productId) ?? 1;
    const featured = catalog.store.featuredProductId === productId;
    buyProduct(productId, quantity, featured ? catalog.store.dayKey : undefined);
  }

  // The listing draft is uncontrolled state inside a re-rendered panel; update
  // it on input instead of after render.
  function onShopInput(event: Event): void {
    const target = event.target;
    const ElementConstructor = options.document.defaultView?.Element;
    if (!ElementConstructor || !(target instanceof ElementConstructor)) return;
    const itemSelect = target.closest<HTMLElement>('[data-listing-item]');
    if (itemSelect) {
      listingDraft.itemId = (itemSelect as HTMLSelectElement).value;
      renderExchange();
      return;
    }
    const quantityInput = target.closest<HTMLElement>('[data-listing-quantity]');
    if (quantityInput) {
      const value = Number((quantityInput as HTMLInputElement).value);
      listingDraft.quantity = Number.isFinite(value) && value >= 1 ? value : 1;
      return;
    }
    const priceInput = target.closest<HTMLElement>('[data-listing-price]');
    if (priceInput) {
      const value = Number((priceInput as HTMLInputElement).value);
      listingDraft.price = Number.isFinite(value) && value >= 1 ? value : 1;
    }
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
    requestListings();
  }

  function closeShop(): void { shopPanel?.classList.remove('open'); }

  function interactBuilding(buildingId: string, continueInteraction: () => void): boolean {
    if (!online) { offlineNotice(); return false; }
    if (pendingBuilding) return false;
    const globallyUnlocked = catalog.globallyUnlockedBuildings?.includes(buildingId) ?? false;
    if (globallyUnlocked || canInteractWithBuilding(progress, buildingId)) {
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

  // Stat achievements are evaluated from cloud progress after every snapshot;
  // the server re-verifies each claim, so this only ever sends eligible unlocks.
  const STAT_ACHIEVEMENT_CHECKS: ReadonlyArray<{ id: string; met: () => boolean }> = [
    { id: 'citizen', met: () => true },
    { id: 'first_building', met: () => progress.visitedBuildings.length >= 1 },
    { id: 'explorer_5', met: () => progress.visitedBuildings.length >= 5 },
    { id: 'explorer_10', met: () => progress.visitedBuildings.length >= 10 },
    { id: 'unlock_3', met: () => progress.unlockedBuildings.length >= 3 },
  ];
  // Claims that were sent but not yet confirmed, so intermediate snapshots do
  // not re-send them before the server echoes the unlock back.
  const pendingStatAchievements = new Set<string>();

  function evaluateStatAchievements(): void {
    if (!online) return;
    progress.achievements.forEach((id) => pendingStatAchievements.delete(id));
    STAT_ACHIEVEMENT_CHECKS.forEach(({ id, met }) => {
      if (!met() || !(id in catalog.achievementRewards)) return;
      if (progress.achievements.includes(id) || pendingStatAchievements.has(id)) return;
      if (options.send({ type: 'progress.achievement.unlock', achievementId: id })) pendingStatAchievements.add(id);
    });
  }

  function buyProduct(productId: string, quantity = 1, dealDay?: string): boolean {
    if (!online) { offlineNotice(); return false; }
    if (pendingShopProducts.has(productId)) return false;
    const sent = options.send({ type: 'progress.shop.buy', productId, quantity, dealDay });
    if (sent) {
      pendingShopProducts.add(productId);
      renderShop();
    }
    return sent;
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
    pendingShopProducts.clear();
    pendingDailyClaims.clear();
    pendingMarketActions.clear();
    pendingStatAchievements.clear();
    pendingFilmCity?.(false);
    pendingFilmCity = null;
    render();
  }

  function destroy(): void { handleError(); shopPanel?.remove(); shopPanel = null; panel = null; }

  return {
    setup, setConnection, applySnapshot, applyCatalog, applyListings, interactBuilding, unlockAchievement,
 buyProduct, consumeItem, purchaseFilmCityExperience, nextRewardClaimSequence, claimReward, openInventory, openShop,
    getProgress: () => progress,
    getQuestProgressView: () => toQuestProgressView(progress),
    isOnline: () => online, handleError,
    destroy,
  };
}
