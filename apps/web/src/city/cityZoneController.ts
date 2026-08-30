// 城市分区控制器：把 9 个分区（内区 / 东南西北外区 / 东南西北延伸区）
// 的建造阶段应用到渲染层（道路 → 装饰 → 非民居 → 民居）并同步导航、碰撞与地图。
import * as THREE from 'three';
import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import { BUILDING_DEFS } from './data/buildings';
import {
  CITY_ZONE_IDS, classifyZone, readZoneStages, writeZoneStages, zoneLevelFromStage,
  ZONE_LABELS, ZONE_STAGE_ORDER,
  type ZoneId, type ZoneStage, type ZoneStageMap,
} from './data/cityZones';
import type { SceneInterestPointId, SceneInterestPoints } from '../rendering/sceneInterestPoints';

type ZoneSurfaceApi = {
  setZoneRoadsVisible: (zone: ZoneId, visible: boolean) => void;
  setZoneGroundVisible: (zone: ZoneId, visible: boolean) => void;
};

type ZoneDecorationsApi = {
  setZoneDecorVisible: (zone: ZoneId, visible: boolean) => void;
  setZoneResidencesVisible: (zone: ZoneId, visible: boolean) => void;
  setZonePathsVisible: (zone: ZoneId, visible: boolean) => void;
};

export type CityZoneControllerOptions = {
  scene: THREE.Scene;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  getBuildings: () => readonly BuildingEntity[];
  getResidences: () => readonly ResidenceEntity[];
  getCitySurfaces: () => ZoneSurfaceApi | null;
  getWorldDecorations: () => ZoneDecorationsApi | null;
  getSceneInterestPoints: () => SceneInterestPoints | null;
  invalidateRoadGraph: () => void;
  invalidateMapShot: () => void;
  refreshNpcs: () => void;
};

export type CityZoneController = ReturnType<typeof createCityZoneController>;

// 特殊大型构筑物（按名称在场景中定位）：喷泉与回声观星台建筑群属于“非民居”层级。
const STRUCTURE_ROOT_NAMES = ['city-fountain', 'echo-observatory', 'linche-home', 'echo-observatory-sign'] as const;
// 内部场景（回声小屋内部，x≈220）不属于城市分区，不做分区控制。
const CITY_WORLD_MAX_X = 100;

export function createCityZoneController(options: CityZoneControllerOptions) {
  const storage = options.storage ?? window.localStorage;
  const stages: ZoneStageMap = readZoneStages(storage);
  const buildingCoords = new Map(BUILDING_DEFS.map((definition) => [definition.id, { x: definition.x, z: definition.z } as const]));

  function stageOf(zone: ZoneId): ZoneStage {
    return stages[zone] ?? 'unlocked';
  }

  function levelOf(zone: ZoneId): number {
    return zoneLevelFromStage(stageOf(zone));
  }

  function levelAt(x: number, z: number): number {
    return levelOf(classifyZone(x, z));
  }

  function buildingPosition(building: BuildingEntity): { x: number; z: number } {
    return buildingCoords.get(building.id) ?? { x: building.group.position.x, z: building.group.position.z };
  }

  // 大型构筑物根节点只查找一次（ getObjectByName 每次全场景遍历）。
  let cachedStructureRoots: { zone: ZoneId; root: THREE.Object3D }[] | null = null;
  function structureRoots(): { zone: ZoneId; root: THREE.Object3D }[] {
    if (cachedStructureRoots) return cachedStructureRoots;
    cachedStructureRoots = [];
    for (const name of STRUCTURE_ROOT_NAMES) {
      const root = options.scene.getObjectByName(name);
      if (root) cachedStructureRoots.push({ zone: classifyZone(root.position.x, root.position.z), root });
    }
    return cachedStructureRoots;
  }

  function applyAll(): void {
    const buildings = options.getBuildings();
    const surfaces = options.getCitySurfaces();
    const decorations = options.getWorldDecorations();
    const residences = options.getResidences();
    for (const zone of CITY_ZONE_IDS) {
      const level = levelOf(zone);
      surfaces?.setZoneRoadsVisible(zone, level >= 1);
      surfaces?.setZoneGroundVisible(zone, level >= 1);
      decorations?.setZonePathsVisible(zone, level >= 1);
      decorations?.setZoneDecorVisible(zone, level >= 2);
      // 非民居建筑：建造 3 阶段起显示（摧毁废墟由 damage 模块自行呈现）。
      for (const building of buildings) {
        const position = buildingPosition(building);
        if (classifyZone(position.x, position.z) !== zone) continue;
        building.group.visible = level >= 3;
        if (building.labelEl) building.labelEl.style.display = level >= 3 ? '' : 'none';
      }
      // 民居（含住宅地块与地图标签）：已解锁（4 阶段）才显示。
      for (const residence of residences) {
        if (classifyZone(residence.group.position.x, residence.group.position.z) !== zone) continue;
        if (residence.labelEl) residence.labelEl.style.display = level >= 4 ? '' : 'none';
      }
      decorations?.setZoneResidencesVisible(zone, level >= 4);
      for (const { zone: rootZone, root } of structureRoots()) {
        if (rootZone !== zone) continue;
        root.visible = level >= 3;
      }
    }
    // 场景兴趣点（含西海滩实体）：装饰层级（阶段 >= 2）；内部场景跳过。
    options.getSceneInterestPoints()?.entities.forEach((entity) => {
      const position = entity.interactionPosition;
      if (position.x > CITY_WORLD_MAX_X) return;
      entity.object.visible = levelAt(position.x, position.z) >= 2;
    });
    options.invalidateRoadGraph();
    options.invalidateMapShot();
    options.refreshNpcs();
  }

  function setStage(zone: ZoneId, stage: ZoneStage): boolean {
    if (!(CITY_ZONE_IDS as readonly string[]).includes(zone)) return false;
    if (!ZONE_STAGE_ORDER.includes(stage)) return false;
    stages[zone] = stage;
    writeZoneStages(stages, storage);
    applyAll();
    return true;
  }

  function setAll(stage: ZoneStage): boolean {
    if (!ZONE_STAGE_ORDER.includes(stage)) return false;
    for (const zone of CITY_ZONE_IDS) stages[zone] = stage;
    writeZoneStages(stages, storage);
    applyAll();
    return true;
  }

  function reset(): void {
    setAll('unlocked');
  }

  return {
    applyAll,
    setStage,
    setAll,
    reset,
    getStages: (): ZoneStageMap => ({ ...stages }),
    list: () => CITY_ZONE_IDS.map((zone) => ({ zone, label: ZONE_LABELS[zone], stage: stageOf(zone), level: levelOf(zone) })),
    levelAt,
    isBuildingHiddenByZone: (building: BuildingEntity): boolean => {
      const position = buildingPosition(building);
      return levelAt(position.x, position.z) < 3;
    },
    isResidenceHiddenByZone: (residenceId: string): boolean => {
      const residence = options.getResidences().find((item) => item.id === residenceId);
      if (!residence) return false;
      return levelAt(residence.group.position.x, residence.group.position.z) < 4;
    },
    isInterestPointOpen: (id: SceneInterestPointId): boolean => {
      const entity = options.getSceneInterestPoints()?.entities.get(id);
      if (!entity) return true;
      if (entity.interactionPosition.x > CITY_WORLD_MAX_X) return true;
      return levelAt(entity.interactionPosition.x, entity.interactionPosition.z) >= 2;
    },
  };
}
