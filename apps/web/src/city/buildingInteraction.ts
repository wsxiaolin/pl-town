import { BUILDING_API_QUERIES } from './data/buildings';
import type { BuildingEntity } from './buildingEntity';
import type { CityDialogController } from '../adapters/ui/cityDialogController';
import type { WildMushroomInteractResult } from './wildMushroomRestaurant';
import { openCityGovernancePanel } from '../adapters/ui/cityGovernancePanel';
import { isConstructionPending } from './cityGovernanceClient';

type SocialKind = 'profile' | 'mine' | 'favorites' | 'following' | 'followers' | 'volunteers';

export type BuildingInteractionOptions = {
  isBuildingUnavailable: (building: BuildingEntity) => boolean;
  getMultiplayerHousing: () => { progression: { interactBuilding: (id: string, onUnlock: () => void) => boolean; openShop: () => void } } | null;
  getCityDialogs: () => CityDialogController | null;
  getEchoStoryController?: () => { interactBuilding: (id: string, dialogs: CityDialogController) => boolean } | null;
  /** 剧情入口统一路由（含互斥判定与被拦提示）。 */
  getStoryRouter?: () => { routeBuilding: (buildingId: string, dialogs: CityDialogController) => 'handled' | 'blocked' | 'unhandled' } | null;
  getStatsPanelController: () => { open: () => void } | null;
  getCommunityPanels: () => ReturnType<typeof import('../adapters/ui/communityPanelController').createCommunityPanelController> | null;
  getWriterCatalogController: () => { open: () => void; close: () => void } | null;
  getNewsstandController: () => { open: () => void; close: () => void } | null;
  getAcademyController?: () => { open: () => void; close: () => void; closeReader: () => void } | null;
  getMutualAidController?: () => { open: () => void; close: () => void } | null;
  trackInteraction: (buildingId: string) => void;
  getWildMushroomRestaurant?: () => { interact: (onComplete?: () => void) => WildMushroomInteractResult } | null;
  getFilmCityController?: () => { interact: () => void } | null;
  interactWithFeature?: (building: BuildingEntity) => boolean;
  /**
   * Opens the standalone bulletin page. Injected from adapters/ui so this
   * module stays DOM-free; returns whether the tab actually opened (a
   * walk-up arrival has no user activation left, in which case the opener
   * itself falls back to a clickable toast).
   */
  openBulletinBoard?: () => boolean;
};

const PHONE_BUILDINGS: Record<string, [string, import('../adapters/ui/communityPanelController').SocialKind?]> = {
  news: ['inventory'],
  community: ['social', 'profile'], records: ['social', 'mine'],
  tradingpost: ['social', 'favorites'], guildhall: ['social', 'volunteers'],
};

// The bulletin board no longer opens the phone: it renders the Physics Lab
// client's live announcement feed on a dedicated page (bulletin.html), so the
// city shell stays open in this tab while the notices get their own space.

export function createBuildingInteraction(options: BuildingInteractionOptions) {
  function openGovernanceIfNeeded(building: BuildingEntity): boolean {
    if (building.id !== 'commons' && building.id !== 'commons_outer' && !isConstructionPending(building.id)) return false;
    openCityGovernancePanel(building.id);
    options.trackInteraction(building.id);
    return true;
  }
  function openModal(building: BuildingEntity) {
    options.getCityDialogs()?.openBuilding(building);
  }

  function closeModal() {
    options.getCityDialogs()?.closeBuilding();
  }

  function navigateUnlocked(b: BuildingEntity) {
    if (openGovernanceIfNeeded(b)) return;
    if (options.isBuildingUnavailable(b)) return;
    if (options.interactWithFeature?.(b)) return;
    if (b.id === 'film_city') {
      options.getFilmCityController?.()?.interact();
      options.trackInteraction(b.id);
      return;
    }
    // 点击「野生菌餐馆」（原文训社外环）触发野生菌小剧情：每次进店都会被放倒、烧一次城。
    if (b.id === 'writingclub_outer') {
      const restaurant = options.getWildMushroomRestaurant?.();
      if (restaurant) {
        // 小剧情走到最终离开选项时，才算完成一次互动。
        if (restaurant.interact(() => options.trackInteraction(b.id)) === 'opened') return;
      }
      options.trackInteraction(b.id);
      openModal(b);
      return;
    }
    const dialogs = options.getCityDialogs();
    const storyRouter = options.getStoryRouter?.();
    const storyResult = dialogs ? storyRouter?.routeBuilding(b.id, dialogs) : 'unhandled';
    if (storyResult === 'handled') { options.trackInteraction(b.id); return; }
    if (storyResult === 'blocked') return;
    if (b.isStats) { options.getStatsPanelController()?.open(); options.trackInteraction('stats'); return; }
    if (b.id === 'mutualaid') {
      options.getMutualAidController?.()?.open();
      options.trackInteraction(b.id);
      return;
    }
    if (b.id === 'mall_south' || b.id === 'mall_west') {
      options.getMultiplayerHousing()?.progression.openShop();
      options.trackInteraction(b.id);
      return;
    }
    if (b.id === 'bulletin') {
      // Handled in navigateTo: the page (or the popup-blocker fallback toast)
      // already opened on the click's activation window. Nothing to do on
      // visit completion — falling through would re-open or show the generic
      // building dialog.
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
    if (b.id === 'academy_library') {
      options.getAcademyController?.()?.open();
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
    if (openGovernanceIfNeeded(b)) return;
    if (options.isBuildingUnavailable(b)) return;
    const interactionAccepted = options.getMultiplayerHousing()?.progression.interactBuilding(b.id, () => navigateUnlocked(b));
    // The bulletin board is outbound navigation, not an in-city panel: open
    // the page while the click's user-activation window is still live instead
    // of waiting for the visit round trip — a WS round trip (or the walk up
    // to a distant board) outlives that window and hands window.open to the
    // popup blocker. When the walk-up arrival has no activation left, the
    // opener falls back to a clickable toast; when the round trip itself was
    // rejected (offline, a pending interaction), skip the open so a repeat
    // click cannot stack a second tab.
    if (b.id === 'bulletin' && interactionAccepted !== false) {
      options.openBulletinBoard?.();
      options.trackInteraction(b.id);
    }
  }

  return { navigateTo, navigateUnlocked, openModal, closeModal };
}
