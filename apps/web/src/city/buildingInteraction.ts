import { BUILDING_API_QUERIES } from './data/buildings';
import type { BuildingEntity } from './buildingEntity';
import type { CityDialogController } from '../adapters/ui/cityDialogController';
import type { WildMushroomInteractResult } from './wildMushroomRestaurant';

type SocialKind = 'profile' | 'mine' | 'favorites' | 'following' | 'followers' | 'volunteers';

export type BuildingInteractionOptions = {
  isBuildingUnavailable: (building: BuildingEntity) => boolean;
  getMultiplayerHousing: () => { progression: { interactBuilding: (id: string, onUnlock: () => void) => void; openShop: () => void } } | null;
  getCityDialogs: () => CityDialogController | null;
  getEchoStoryController: () => { interactBuilding: (id: string, dialogs: CityDialogController) => boolean } | null;
  getYesterdayStoryController?: () => { interactBuilding: (id: string, dialogs: CityDialogController) => boolean } | null;
  getMagiStoryController?: () => { interactBuilding: (id: string, dialogs: CityDialogController) => boolean } | null;
  getOvercoatStoryController?: () => { interactBuilding: (id: string, dialogs: CityDialogController) => boolean } | null;
  getStatsPanelController: () => { open: () => void } | null;
  getCommunityPanels: () => ReturnType<typeof import('../adapters/ui/communityPanelController').createCommunityPanelController> | null;
  getWriterCatalogController: () => { open: () => void; close: () => void } | null;
  getNewsstandController: () => { open: () => void; close: () => void } | null;
  trackInteraction: (buildingId: string) => void;
  getWildMushroomRestaurant?: () => { interact: () => WildMushroomInteractResult } | null;
};

const PHONE_BUILDINGS: Record<string, [string, import('../adapters/ui/communityPanelController').SocialKind?]> = {
  bulletin: ['inventory'], news: ['inventory'],
  community: ['social', 'profile'], records: ['social', 'mine'],
  tradingpost: ['social', 'favorites'], guildhall: ['social', 'volunteers'],
  mutualaid: ['social', 'following'],
};

export function createBuildingInteraction(options: BuildingInteractionOptions) {
  function openModal(building: BuildingEntity) {
    options.getCityDialogs()?.openBuilding(building);
  }

  function closeModal() {
    options.getCityDialogs()?.closeBuilding();
  }

  function navigateUnlocked(b: BuildingEntity) {
    if (options.isBuildingUnavailable(b)) return;
    // 点击「野生菌餐馆」（原文训社外环）触发野生菌小剧情：每次进店都会被放倒、烧一次城。
    if (b.id === 'writingclub_outer') {
      const restaurant = options.getWildMushroomRestaurant?.();
      if (restaurant) {
        // 'opened'：小剧情已展开，仅记录互动；'no-dialog' / 'exhausted' 均回退到普通建筑弹窗。
        if (restaurant.interact() === 'opened') {
          options.trackInteraction(b.id);
          return;
        }
      }
      options.trackInteraction(b.id);
      openModal(b);
      return;
    }
    const dialogs = options.getCityDialogs();
    const echo = options.getEchoStoryController();
    if (dialogs && echo?.interactBuilding(b.id, dialogs)) { options.trackInteraction(b.id); return; }
    const yesterday = options.getYesterdayStoryController?.();
    if (dialogs && yesterday?.interactBuilding(b.id, dialogs)) { options.trackInteraction(b.id); return; }
    const magi = options.getMagiStoryController?.();
    if (dialogs && magi?.interactBuilding(b.id, dialogs)) { options.trackInteraction(b.id); return; }
    const overcoat = options.getOvercoatStoryController?.();
    if (dialogs && overcoat?.interactBuilding(b.id, dialogs)) { options.trackInteraction(b.id); return; }
    if (b.isStats) { options.getStatsPanelController()?.open(); options.trackInteraction('stats'); return; }
    if (b.id === 'mall_south' || b.id === 'mall_west') {
      options.getMultiplayerHousing()?.progression.openShop();
      options.trackInteraction(b.id);
      return;
    }
    const phoneEntry = PHONE_BUILDINGS[b.id];
    if (phoneEntry) {
      options.getCommunityPanels()?.openPhoneApp(phoneEntry[0], phoneEntry[1]);
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
    const configuredQuery = BUILDING_API_QUERIES[b.id as keyof typeof BUILDING_API_QUERIES];
    if (configuredQuery) {
      options.getCommunityPanels()?.openWorksPanel(b.id, configuredQuery as Record<string, unknown>);
      options.trackInteraction(b.id);
      return;
    }
    options.trackInteraction(b.id);
    openModal(b);
  }

  function navigateTo(b: BuildingEntity) {
    if (options.isBuildingUnavailable(b)) return;
    options.getMultiplayerHousing()?.progression.interactBuilding(b.id, () => navigateUnlocked(b));
  }

  return { navigateTo, navigateUnlocked, openModal, closeModal };
}
