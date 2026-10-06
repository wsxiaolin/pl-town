import * as THREE from 'three';
import type { ResourcePool } from '../core/ResourcePool';
import { readRenderSettings } from '../rendering/createRenderer';
import { createWorldDecorations } from '../rendering/worldDecorations';
import { createCityConstructionScene } from '../rendering/cityConstructionScene';
import { createCitySurfaces } from '../rendering/createCitySurfaces';
import { createMountainTerrain } from '../rendering/terrain/mountainRanges';
import { createRiverChenxi } from '../rendering/terrain/riverChenxi';
import { createMinglanIsles } from '../rendering/terrain/minglanIsles';
import { createCityGround } from '../rendering/terrain/cityGround';
import { batchStaticMeshes } from '../rendering/staticMeshBatcher';
import { addRealBuildingModels } from '../rendering/realBuildingModels';
import { addEchoObservatoryArea } from '../rendering/echoObservatoryArea';
import { createSceneInterestPoints } from '../rendering/sceneInterestPoints';
import { createBuildingSceneController } from './buildingSceneController';
import { createBuildingLabelController } from '../adapters/ui/buildingLabelController';
import { applyStoryLockedBuildingPresentation } from './storyLockedBuildingPresentation';
import { createNpcSystem, type Npc } from './npcSystem';
import { NPC_PROFILES } from './data/npcs';
import { BUILDING_DEFS } from './data/buildings';
import { CITY_LIMIT, NORTH_DISTRICT_AREA, PALETTE, ROAD_COORDS } from './data/cityConfig';
import { addCityFountain } from './citySceneBootstrap';
import type { CityGraphics } from './cityGraphics';
import type { BuildingEntity, ResidenceEntity } from './buildingEntity';

type RoadNavigation = {
  registerObstacleGroup: (group: THREE.Object3D) => void;
  cacheBuildingBoxes: () => void;
  nearestRoadCoord: (value: number) => number;
  buildRoadPath: (from: THREE.Vector3, to: THREE.Vector3) => THREE.Vector3[];
};

export function assembleCityWorld(options: {
  scene: THREE.Scene;
  resources: ResourcePool;
  graphics: CityGraphics;
  reduced: boolean;
  isMobile: () => boolean;
  isNight: boolean;
  getIsNight: () => boolean;
  roadNavigation: RoadNavigation;
  buildings: BuildingEntity[];
  residences: ResidenceEntity[];
  pathMats: THREE.MeshStandardMaterial[];
  groundMats: { mat: THREE.MeshStandardMaterial; night: number; day: number }[];
  lampGlobes: THREE.MeshStandardMaterial[];
  buildingPlotTargets: THREE.Object3D[];
  npcList: Npc[];
  actors: {
    get cursorChar(): THREE.Group | null;
    set cursorChar(value: THREE.Group | null);
    get playerMarker(): THREE.Group | null;
    set playerMarker(value: THREE.Group | null);
  };
  raycaster: THREE.Raycaster;
  getGameClock: () => number;
  getCurrentFilter: () => string;
  getCameraZoom: () => number;
  setCameraZoom: (zoom: number) => void;
  updateCameraProjection: (zoom: number) => void;
  getMapMode: () => boolean;
  getDialogOpen: () => boolean;
  getActiveStoryActorIds: () => Set<string>;
  isBuildingUnavailable: (building: BuildingEntity) => boolean;
  isStoryLocked: (building: BuildingEntity) => boolean;
  interactOrWalk: (building: BuildingEntity) => void;
  onModelsLoaded: () => void;
  onConstructionChanged: () => void;
}) {
  const { scene, resources, graphics } = options;
  const raycastBuildingGroups: THREE.Object3D[] = [];
  const worldDecorations = createWorldDecorations({
    scene,
    resources,
    palette: PALETTE,
    roadCoords: ROAD_COORDS,
    cityLimit: CITY_LIMIT,
    buildings: options.buildings,
    residences: options.residences,
    lampMaterials: options.lampGlobes,
    getIsNight: options.getIsNight,
    makeMaterial: graphics.mesh.stdMat,
    addPart: graphics.mesh.part,
    addRaycastGroup: (group) => raycastBuildingGroups.push(group),
    addObstacleGroup: (group) => options.roadNavigation.registerObstacleGroup(group),
  });
  const npcSystem = createNpcSystem({
    scene,
    profiles: NPC_PROFILES,
    npcList: options.npcList,
    actors: {
      get cursorChar() { return options.actors.cursorChar; },
      set cursorChar(value) { options.actors.cursorChar = value; },
      get playerMarker() { return options.actors.playerMarker; },
      set playerMarker(value) { options.actors.playerMarker = value; },
    },
    raycaster: options.raycaster,
    roadCoords: ROAD_COORDS,
    reduced: options.reduced,
    isMobile: options.isMobile,
    getGameClock: options.getGameClock,
    getCurrentFilter: options.getCurrentFilter,
    nearestRoadCoord: options.roadNavigation.nearestRoadCoord,
    buildRoadPath: options.roadNavigation.buildRoadPath,
    makeMaterial: graphics.mesh.stdMat,
    makeMesh: graphics.mesh.mk,
    makeCharacterMaterial: (partName, color, factory) => resources.material(
      { kind: 'character', partName, color },
      factory,
    ),
    view: {
      get mapMode() { return options.getMapMode(); },
      get dialogOpen() { return options.getDialogOpen(); },
      get cameraZoom() { return options.getCameraZoom(); },
      set cameraZoom(value) { options.setCameraZoom(value); },
    },
    updateCameraProjection: options.updateCameraProjection,
    getActiveStoryActorIds: options.getActiveStoryActorIds,
  });
  createCitySurfaces({
    scene,
    isNight: options.isNight,
    roadCoords: ROAD_COORDS,
    cityLimit: CITY_LIMIT,
    colors: { asphalt: PALETTE.ASPHALT, dayPath: PALETTE.DAY_PATH, nightPath: PALETTE.NIGHT_PATH },
    createMaterial: graphics.mesh.stdMat,
    createMesh: graphics.mesh.mk,
    pathMaterials: options.pathMats,
    groundMaterials: options.groundMats,
    addLamps: (positions) => worldDecorations.addLamps(positions),
  });
  // ── 世界地形（岚屏岭山脉 / 晨溪河 / 明澜外海 / 城缘草甸）：地表 ground 之后挂接。
  // 配置在 city/data/terrain/，渲染器逐条消费；山脉与草甸工厂不自行挂接
  // 场景，由这里 scene.add；河流与外海工厂内部自行 scene.add。
  const mountainTerrain = createMountainTerrain({ scene });
  scene.add(mountainTerrain.object);
  const cityGround = createCityGround({ scene });
  scene.add(cityGround.object);
  // 松树（v7 起为顶点色单材质）与草簇/花丛/灌木按 18 单位网格实例化合批：
  // 此前约 110 棵松树各带 4 材质组（≈440 draw call），合批后每格每变体
  // 一个 InstancedMesh；山体/麓原/草甸为逐峰唯一几何，批量器自动跳过。
  batchStaticMeshes(scene, [mountainTerrain.object, cityGround.object]);
  const riverChenxi = createRiverChenxi({ scene });
  const minglanIsles = createMinglanIsles({ scene });
  // 昼夜水色接线（review #218：晨溪河面此前从未跟随昼夜时钟，夜间保持
  // 日间亮色）：MiniCityApp 的 setWaterDaylight 经 worldDecorations 分发，
  // 这里转发给晨溪（河面 + 河口湾面）。
  const baseSetWaterDaylight = worldDecorations.setWaterDaylight.bind(worldDecorations);
  worldDecorations.setWaterDaylight = (value?: number, instant = false) => {
    baseSetWaterDaylight(value, instant);
    riverChenxi.setDaylight(value ?? 1, instant);
  };
  // 导航：不把地形注册为障碍组。registerObstacleGroup 对整组只生成一个
  // setFromObject AABB——山脉组横跨 x≈[-97,115]、z≈[-114,110]，会把环线
  // （半径 38）与全城道路边全部判 blocked，玩家 movement 也被锁死；
  // 而寻路基于道路图、movement 又钳制在 WORLD_BOUNDS（≈x[-50,76]/z±50），
  // 远景地形（河 z≤-50.2、外海 x<-40）本就不在导航范围内。北麓少量山脚
  // 印影伸入 z∈[-44,-50] 边缘带属可接受的视觉穿插，误注册的代价远大于此。
  addCityFountain({ scene, palette: PALETTE, part: graphics.mesh.part });
  const buildingSceneController = createBuildingSceneController({
    scene,
    definitions: BUILDING_DEFS,
    builders: graphics.buildingBuilders,
    addFacade: graphics.textures.addFacade,
    material: graphics.mesh.stdMat,
    addPlot: (plot) => options.buildingPlotTargets.push(plot),
    addBuilding: (building) => options.buildings.push(building),
    isNight: options.getIsNight,
  });
  buildingSceneController.addBuildings();
  raycastBuildingGroups.push(...options.buildings.map((building) => building.group), ...options.buildingPlotTargets);
  addEchoObservatoryArea({
    scene,
    makeMaterial: (parameters) => resources.material({ kind: 'echo-observatory', ...parameters }, () => graphics.mesh.stdMat(parameters)),
  }).forEach((group) => options.roadNavigation.registerObstacleGroup(group));
  options.roadNavigation.cacheBuildingBoxes();
  worldDecorations.addDecorations();
  // 星语北城公园内容（树阵与长椅走世界装饰批次，与主城基础设施同级）。
  worldDecorations.addTrees(NORTH_DISTRICT_AREA.parkTrees.map(([x, z]) => [x, 0, z] as const));
  NORTH_DISTRICT_AREA.parkBenches.forEach(([x, z, rotY]) => worldDecorations.addBench(x, 0, z, rotY));
  npcSystem.addCharacters();
  const sceneInterestPoints = createSceneInterestPoints({
    scene,
    makeMaterial: graphics.mesh.stdMat,
    makeMesh: graphics.mesh.mk,
    waterRendering: readRenderSettings().waterRendering,
  });
  sceneInterestPoints.obstacleRoots.forEach((root) => options.roadNavigation.registerObstacleGroup(root));
  const catCafeAttachments: THREE.Object3D[] = (['cat-cafe-note', 'cat-cafe-ice-wall'] as const)
    .flatMap((id) => {
      const object = sceneInterestPoints.entities.get(id)?.object;
      return object ? [object] : [];
    });
  const buildingLabelController = createBuildingLabelController({
    getBuildings: () => options.buildings,
    isUnavailable: options.isBuildingUnavailable,
    interact: options.interactOrWalk,
  });
  buildingLabelController.addLabels();
  buildingLabelController.applyRenames();
  applyStoryLockedBuildingPresentation(options.buildings.filter(options.isStoryLocked));
  let disposed = false;
  const loadModels = (buildings: BuildingEntity[]) => addRealBuildingModels(scene, buildings)
    .then(() => {
      if (disposed) return;
      options.roadNavigation.cacheBuildingBoxes();
      options.onModelsLoaded();
    })
    .catch((error) => console.error('3D model loading failed', error));
  const constructionScene = createCityConstructionScene({
    scene,
    makeMaterial: graphics.mesh.stdMat,
    buildings: options.buildings,
    getIsNight: options.getIsNight,
    buildingPlots: options.buildingPlotTargets,
    getLightingPosition: () => options.actors.cursorChar?.position ?? scene.position,
    buildingAttachments: new Map([['catcafe', catCafeAttachments]]),
    refreshCollisions: options.roadNavigation.cacheBuildingBoxes,
    refreshLabels: () => { buildingLabelController.addLabels(); buildingLabelController.applyRenames(); },
    onConstructionChanged: options.onConstructionChanged,
    onBuildingRestored: (building) => { void loadModels([building]); },
  });
  void loadModels(options.buildings);
  const updateDecorations = worldDecorations.update;
  worldDecorations.update = (elapsed) => { updateDecorations(elapsed); constructionScene.update(); riverChenxi.update(elapsed ?? 0); };
  return {
    constructionScene: { dispose() { disposed = true; constructionScene.dispose(); } },
    worldDecorations,
    npcSystem,
    buildingSceneController,
    buildingLabelController,
    sceneInterestPoints,
    raycastBuildingGroups,
    terrain: {
      dispose() {
        mountainTerrain.dispose();
        cityGround.dispose();
        riverChenxi.dispose();
        minglanIsles.dispose();
      },
    },
  };
}
