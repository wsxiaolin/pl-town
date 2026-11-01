// 体验玩法接线：野生菌餐馆（火烧城市剧情）、AI 画室、电影运镜、原神研究院
// 与建筑交互路由（面板/工作坊/特性注册表分发）的装配，从组合根抽出。
// 五者共享「对话框」入口且相互导流（餐馆→火烧、画室→画布、建筑→各体验），
// 归成一个领域接线单元。
import type { CityDialogController } from '../adapters/ui/cityDialogController';
import type { PaintingAiCanvasHandlers } from '../adapters/ui/paintingAiCanvasController';
import { openCityGovernancePanel } from '../adapters/ui/cityGovernancePanel';
import type { BuildingEntity } from './buildingEntity';
import { createWildMushroomRestaurant } from './wildMushroomRestaurant';
import { createPaintingAiStudio } from './paintingAiStudio';
import { createFilmCityExperienceController, type FilmCityShot } from './filmCity/filmCityExperienceController';
import { createGenshinInstituteController } from './genshin/genshinInstituteController';
import { createBuildingInteraction, type BuildingInteractionOptions } from './buildingInteraction';
import { showUnlockToast } from './toast';

export interface CityExperienceWiringOptions {
  getDialogs: () => CityDialogController | null;
  /** 火烧城市（burnCityEffect 在运行时基建接线中创建，此处惰性转发）。 */
  burnCity: (onDone?: () => void) => boolean;
  awardAchievement: (id: string, name: string) => void;
  openPaintingCanvas: (handlers: PaintingAiCanvasHandlers) => void;
  closePaintingCanvas: () => void;
  getCurrency: () => number;
  purchase: () => Promise<boolean>;
  getCameraSnapshot: () => { x: number; z: number; zoom: number };
  playShots: (shots: readonly FilmCityShot[], onComplete: () => void) => void;
  stopShots: () => void;
  restoreCamera: (snapshot: { x: number; z: number; zoom: number }) => void;
  setCinematicActive: (active: boolean) => void;
  clearPlayerPath: () => void;
  getRenderer: () => THREE.WebGLRenderer | null;
  reduced: boolean;
  // ── buildingInteraction 透传（窄切面由 BuildingInteractionOptions 定义）──
  openGovernancePanel: BuildingInteractionOptions['openGovernancePanel'];
  isBuildingUnavailable: BuildingInteractionOptions['isBuildingUnavailable'];
  getMultiplayerHousing: BuildingInteractionOptions['getMultiplayerHousing'];
  getStoryRouter: BuildingInteractionOptions['getStoryRouter'];
  getStatsPanelController: BuildingInteractionOptions['getStatsPanelController'];
  getCommunityPanels: BuildingInteractionOptions['getCommunityPanels'];
  getWriterCatalogController: BuildingInteractionOptions['getWriterCatalogController'];
  getNewsstandController: BuildingInteractionOptions['getNewsstandController'];
  getAcademyController: BuildingInteractionOptions['getAcademyController'];
  getMutualAidController: BuildingInteractionOptions['getMutualAidController'];
  getLibrarySearchController: BuildingInteractionOptions['getLibrarySearchController'];
  trackInteraction: (buildingId: string) => void;
  interactWithFeature: (building: BuildingEntity) => boolean;
}

export function createCityExperienceWiring(options: CityExperienceWiringOptions) {
  const wildMushroomRestaurant = createWildMushroomRestaurant({
    getDialogs: options.getDialogs,
    burnCity: options.burnCity,
    awardAchievement: options.awardAchievement,
  });

  const paintingAiStudio = createPaintingAiStudio({
    getDialogs: options.getDialogs,
    openCanvas: (handlers) => options.openPaintingCanvas(handlers),
    closeCanvas: () => options.closePaintingCanvas(),
    showToast: showUnlockToast,
  });

  const filmCityExperience = createFilmCityExperienceController({
    dialogs: options.getDialogs,
    getCurrency: options.getCurrency,
    purchase: options.purchase,
    getCameraSnapshot: options.getCameraSnapshot,
    playShots: options.playShots,
    stopShots: options.stopShots,
    restoreCamera: options.restoreCamera,
    setCinematicActive: options.setCinematicActive,
    clearPlayerPath: options.clearPlayerPath,
    showToast: showUnlockToast,
  });

  // 原神研究院：启动页 chunk 在城市空闲时仅预下载（模块零副作用，不建场景），
  // 重代码（场景/shader/每帧渲染）在选择「好想玩原神！」后才运行。
  const genshinInstitute = createGenshinInstituteController({
    dialogs: options.getDialogs,
    getRenderer: options.getRenderer,
    showToast: showUnlockToast,
    reduced: options.reduced,
  });

  const buildingInteraction = createBuildingInteraction({
    openGovernancePanel: options.openGovernancePanel,
    isBuildingUnavailable: options.isBuildingUnavailable,
    getMultiplayerHousing: options.getMultiplayerHousing,
    getCityDialogs: options.getDialogs,
    getStoryRouter: options.getStoryRouter,
    getStatsPanelController: options.getStatsPanelController,
    getCommunityPanels: options.getCommunityPanels,
    getWriterCatalogController: options.getWriterCatalogController,
    getNewsstandController: options.getNewsstandController,
    getAcademyController: options.getAcademyController,
    getMutualAidController: options.getMutualAidController,
    getLibrarySearchController: options.getLibrarySearchController,
    trackInteraction: options.trackInteraction,
    getWildMushroomRestaurant: () => wildMushroomRestaurant,
    getPaintingAiStudio: () => paintingAiStudio,
    getFilmCityController: () => filmCityExperience,
    getGenshinInstituteController: () => genshinInstitute,
    interactWithFeature: options.interactWithFeature,
  });

  return { wildMushroomRestaurant, paintingAiStudio, filmCityExperience, genshinInstitute, buildingInteraction };
}
