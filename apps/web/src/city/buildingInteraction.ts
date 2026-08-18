import { BUILDING_API_QUERIES } from './data/buildings';

export type BuildingInteractionOptions = {
  isBuildingUnavailable: (building: any) => boolean;
  getMultiplayerHousing: () => { progression: { interactBuilding: (id: string, onUnlock: () => void) => void; openShop: () => void } } | null;
  getCityDialogs: () => { openBuilding: (building: any) => void; closeBuilding: () => void } | null;
  getEchoStoryController: () => { interactBuilding: (id: string, dialogs: any) => boolean } | null;
  getStatsPanelController: () => { open: () => void } | null;
  getCommunityPanels: () => {
    openPhoneApp: (tab: string, kind: string) => void;
    openWorksPanel: (context: string, queryOverride: any) => void;
    closeWorkDetail: () => void;
    loadWorkComments: () => any;
    postWorkComment: (event: any) => any;
    loadWorkDerivatives: () => any;
    loadWorkSupporters: () => any;
    toggleWorkSupport: () => any;
    toggleWorkStar: () => any;
    closeWorksPanel: () => void;
  } | null;
  getWriterCatalogController: () => { open: () => void; close: () => void } | null;
  getNewsstandController: () => { open: () => void; close: () => void } | null;
  trackInteraction: (buildingId: string) => void;
  burnCity?: (onDone?: () => void) => boolean;
  getWildMushroomRestaurant?: () => { interact: () => void } | null;
};

const PHONE_BUILDINGS: Record<string, [string, string?]> = {
  bulletin: ['inventory'], news: ['inventory'],
  community: ['social', 'profile'], records: ['social', 'mine'],
  tradingpost: ['social', 'favorites'], guildhall: ['social', 'volunteers'],
  mutualaid: ['social', 'following'],
};

export function createBuildingInteraction(options: BuildingInteractionOptions) {
  function openModal(building: any) {
    options.getCityDialogs()?.openBuilding(building);
  }

  function closeModal() {
    options.getCityDialogs()?.closeBuilding();
  }

  function navigateUnlocked(b: any) {
    if (options.isBuildingUnavailable(b)) return;
    // 点击「野生菌餐馆」（原文训社外环）触发野生菌小剧情：每次进店都会被放倒、烧一次城。
    if (b.id === 'writingclub_outer') {
      const restaurant = options.getWildMushroomRestaurant?.();
      if (restaurant) {
        options.trackInteraction(b.id);
        restaurant.interact();
        return;
      }
      options.trackInteraction(b.id);
      options.burnCity?.();
      return;
    }
    const dialogs = options.getCityDialogs();
    const echo = options.getEchoStoryController();
    if (dialogs && echo?.interactBuilding(b.id, dialogs)) { options.trackInteraction(b.id); return; }
    if (b.isStats) { options.getStatsPanelController()?.open(); options.trackInteraction('stats'); return; }
    if (b.id === 'mall_south' || b.id === 'mall_west') {
      options.getMultiplayerHousing()?.progression.openShop();
      options.trackInteraction(b.id);
      return;
    }
    const phoneEntry = PHONE_BUILDINGS[b.id];
    if (phoneEntry) {
      options.getCommunityPanels()?.openPhoneApp(phoneEntry[0], phoneEntry[1] as any);
      options.trackInteraction(b.id);
      return;
    }
    if (b.id === 'culturehall') {
      options.getWriterCatalogController()?.open();
      options.trackInteraction(b.id);
      return;
    }
    if (b.id === 'newsstand') {
      options.getNewsstandController()?.open();
      options.trackInteraction(b.id);
      return;
    }
    const configuredQuery = (BUILDING_API_QUERIES as Record<string, any>)[b.id];
    if (configuredQuery) {
      options.getCommunityPanels()?.openWorksPanel(b.id, configuredQuery);
      options.trackInteraction(b.id);
      return;
    }
    options.trackInteraction(b.id);
    openModal(b);
  }

  function navigateTo(b: any) {
    if (options.isBuildingUnavailable(b)) return;
    options.getMultiplayerHousing()?.progression.interactBuilding(b.id, () => navigateUnlocked(b));
  }

  return { navigateTo, navigateUnlocked, openModal, closeModal };
}
