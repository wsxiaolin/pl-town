// 年份镇组合根接线（T3/T4/T6）：生成数据、跨海交通、档案馆目录与海图/相机域
// 的装配集中在此，避免 MiniCityApp（组合根，长期贴着 source-size 上限）继续膨胀。
import type { Object3D } from 'three';
import type { CityDialogController } from '../adapters/ui/cityDialogController';
import {
  CATALOG_ACTION_PREFIX,
  YEAR_TOWN_CATALOG_CONTENT,
  createYearTownCatalogController,
  yearTownMemorialBuildingId,
} from '../adapters/ui/yearTownCatalogController';
import type { YearTownCatalogController } from '../adapters/ui/yearTownCatalogController';
import type { YearTownPanelController } from '../adapters/ui/yearTownPanelController';
import type { TransitStationId } from '../gameplay/world/sceneInteractions';
import { buildTransitRoadGraph } from './data/year-towns/transit';
import { YEAR_TOWN_ANCHORS, YEAR_TOWN_MARKERS, yearTownPanBounds } from './data/year-towns/towns';
import { YEAR_TOWN_BUILDING_CONTENT } from './yearTownBuildings';
import { createTransitRideController } from './transitRideController';

type TransitDialogs = Pick<CityDialogController, 'openStory' | 'dismissNpc'>;

/** MiniCityApp 只暴露年份镇需要的两个海图传送口，避免反向依赖整个 MapController。 */
interface WorldMapLocator {
  teleportToBuilding(buildingId: string): boolean;
  teleportToTown(townId: string): boolean;
}

export interface YearTownWiringOptions {
  document: Document;
  /** 运行时生命周期在 init 之后才建立，目录控制器首次打开时再取。 */
  getSignal: () => AbortSignal;
  cityLimit: number;
  /** 面板由 HUD 在 init 内创建；控制器首次打开目录时才实例化（避免加载期建 DOM）。 */
  getPanel: () => YearTownPanelController | undefined;
  getCursorChar: () => Object3D | null;
  getDialogs: () => TransitDialogs | null;
  getMap: () => WorldMapLocator | null;
  clearPlayerPath: () => void;
  showToast: (message: string) => void;
}

export function createYearTownWiring(options: YearTownWiringOptions) {
  let vehicles: {
    setRideVehicle(line: 'stargate' | 'ring', x: number, y: number, z: number, tx: number, tz: number): void;
    endRide(): void;
  } | null = null;
  const transitRide = createTransitRideController({
    getCursorChar: options.getCursorChar,
    getDialogs: options.getDialogs,
    clearPlayerPath: options.clearPlayerPath,
    setRideVehicle: (...args) => vehicles?.setRideVehicle(...args),
    endRide: () => vehicles?.endRide(),
    showToast: options.showToast,
  });
  let catalog: YearTownCatalogController | null = null;
  function ensureCatalog(): YearTownCatalogController | null {
    if (catalog) return catalog;
    const panel = options.getPanel();
    if (!panel) return null;
    catalog = createYearTownCatalogController({
      document: options.document,
      signal: options.getSignal(),
      panel,
      locate: (entry) => {
        const map = options.getMap();
        if (!map) return false;
        const buildingId = yearTownMemorialBuildingId(entry.key);
        return buildingId ? map.teleportToBuilding(buildingId) : map.teleportToTown(`island-${entry.year}`);
      },
    });
    return catalog;
  }

  return {
    transitRide,
    bindTransitVehicles(next: typeof vehicles): void { vehicles = next; },
    interactTransit(id: string): boolean {
      return transitRide.interact(id as TransitStationId);
    },
    /** 铭牌选项路由：目录入口与作品正文抽屉；未命中返回 false 交给其他注册表。 */
    handleDialogueAction(action: string): boolean {
      if (action.startsWith(CATALOG_ACTION_PREFIX)) {
        ensureCatalog()?.open(action.slice(CATALOG_ACTION_PREFIX.length));
        return true;
      }
      if (action.startsWith('read-body:')) {
        options.getPanel()?.open(action.slice('read-body:'.length));
        return true;
      }
      return false;
    },
    /** 海图/相机/导航共用的静态数据。 */
    anchors: YEAR_TOWN_ANCHORS,
    markers: YEAR_TOWN_MARKERS,
    panBounds: yearTownPanBounds(options.cityLimit),
    transit: buildTransitRoadGraph(),
    buildingContent: { ...YEAR_TOWN_BUILDING_CONTENT, ...YEAR_TOWN_CATALOG_CONTENT },
  };
}
