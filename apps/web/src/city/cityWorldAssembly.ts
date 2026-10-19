import * as THREE from 'three';
import type { ResourcePool } from '../core/ResourcePool';
import { readRenderSettings } from '../rendering/createRenderer';
import { createWorldDecorations } from '../rendering/worldDecorations';
import { createCityConstructionScene } from '../rendering/cityConstructionScene';
import { createCitySurfaces } from '../rendering/createCitySurfaces';
import { createMountainTerrain } from '../rendering/terrain/mountainRanges';
import { createRiverChenxi } from '../rendering/terrain/riverChenxi';
import { createMinglanIsles } from '../rendering/terrain/minglanIsles';
import { createArchipelagoIsles } from '../rendering/terrain/archipelagoIsles';
import { createYearTownTransit } from '../rendering/terrain/yearTownTransit';
import { createYearTownDecor } from '../rendering/terrain/yearTownDecor';
import { createCityGround } from '../rendering/terrain/cityGround';
import { batchStaticMeshes } from '../rendering/staticMeshBatcher';
import { addRealBuildingModels } from '../rendering/realBuildingModels';
import { updateKomorebiClockworks } from '../rendering/komorebiClockworks';
import { addEchoObservatoryArea } from '../rendering/echoObservatoryArea';
import { createSceneInterestPoints } from '../rendering/sceneInterestPoints';
import { createBuildingSceneController } from './buildingSceneController';
import { createBuildingLabelController } from '../adapters/ui/buildingLabelController';
import { applyStoryLockedBuildingPresentation } from './storyLockedBuildingPresentation';
import { createNpcSystem, type Npc } from './npcSystem';
import { NPC_PROFILES } from './data/npcs';
import { YEAR_TOWN_NPCS } from './data/year-towns/yearTownNpcs';
import { BUILDING_DEFS } from './data/buildings';
import { YEAR_TOWN_BUILDING_DEFS } from './data/year-towns/yearTownBuildings';
import { CITY_LIMIT, NORTH_DISTRICT_AREA, PALETTE, ROAD_COORDS } from './data/cityConfig';
import { addCityFountain } from './citySceneBootstrap';
import type { CityGraphics } from './cityGraphics';
import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import { terrainHeight } from './data/terrain/heightfield/terrainHeight';

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
    // 年份镇主题 NPC 与主城 NPC 同管道合流（T6R-b4）；年份镇 NPC 定点迎宾
    // （home==work、patrolRadius 0、主城路网不可达），主城 NPC 行为不变。
    profiles: [...NPC_PROFILES, ...YEAR_TOWN_NPCS],
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
  // 南洋年份群岛（T3）：8 座岛台 + 沙线盘；南海水面扩展在 westBeach 的唯一
  // Water 实例内完成（sceneInterestPoints 消费），这里只挂岛体。
  const archipelagoIsles = createArchipelagoIsles({ scene });
  // 跨海交通（T4a）：星门大桥 + 群岛环线 + 巡游列车（结构合并为单 mesh，
  // 列车只做矩阵级巡游更新；reduced 时停泊泊位）。
  const yearTownTransit = createYearTownTransit({ scene, reduced: options.reduced });
  // 昼夜水色接线（review #218：晨溪河面此前从未跟随昼夜时钟，夜间保持
  // 日间亮色）：MiniCityApp 的 setWaterDaylight 经 worldDecorations 分发，
  // 这里转发给晨溪（河面 + 河口湾面）。
  const baseSetWaterDaylight = worldDecorations.setWaterDaylight.bind(worldDecorations);
  worldDecorations.setWaterDaylight = (value?: number, instant = false) => {
    baseSetWaterDaylight(value, instant);
    riverChenxi.setDaylight(value ?? 1, instant);
  };
  // 导航：不把地形注册为障碍组。registerObstacleGroup 对整组只生成一个
  // setFromObject AABB——山脉组横跨 x≈[-148,276]、z≈[-294,-110]，会把环线
  // （半径 38）与全城道路边全部判 blocked，玩家 movement 也被锁死；而寻路基于
  // 道路图、山体墙由 roadNavigation.mountainSurfaceBlocked 逐点判定（与渲染
  // 山体网格共享 LANPING_ALPINE_FIELD 高度场，见 roadNavigation.test.ts）。
  addCityFountain({ scene, palette: PALETTE, part: graphics.mesh.part });
  const buildingSceneController = createBuildingSceneController({
    scene,
    // 年份镇合流（设计 §7.1）：115 座与 BUILDING_DEFS 同管道进同一
    // BuildingEntity 工厂（meshFactory 造型 / labels / interaction / 地图图标）；
    // baseY=岛台面、hasPlot:false 由 yearTownBuildings 合流层给出。
    definitions: [...BUILDING_DEFS, ...YEAR_TOWN_BUILDING_DEFS],
    builders: graphics.buildingBuilders,
    addFacade: graphics.textures.addFacade,
    material: graphics.mesh.stdMat,
    addPlot: (plot) => options.buildingPlotTargets.push(plot),
    addBuilding: (building) => options.buildings.push(building),
    isNight: options.getIsNight,
  });
  buildingSceneController.addBuildings();
  raycastBuildingGroups.push(...options.buildings.map((building) => building.group), ...options.buildingPlotTargets);
  // 年份镇主题装置 + XL 地标信标（T6，设计 §4「氛围道具」）：须在建筑建成
  // 后装配（信标顶面按 Box3 实测、建成时 group 在 baseY−3 入场位已折算）；
  // 灯效全 emissive 材质，不新增真实光源（单 WebGL 上下文红线，§5）。
  // 生命周期对齐 yearTownTransit：update 挂 worldDecorations 帧链，dispose 入 terrain 清理。
  const yearTownDecor = createYearTownDecor({ scene, buildings: options.buildings });
  addEchoObservatoryArea({
    scene,
    makeMaterial: (parameters) => resources.material({ kind: 'echo-observatory', ...parameters }, () => graphics.mesh.stdMat(parameters)),
  }).forEach((group) => options.roadNavigation.registerObstacleGroup(group));
  options.roadNavigation.cacheBuildingBoxes();
  worldDecorations.addDecorations();
  // 星语北城公园内容（树阵与长椅走世界装饰批次，与主城基础设施同级）。
  // 北城树阵/长椅 y 走唯一采样器（方案 §6.2；北城在台地内 → 数值恒 0）。
  worldDecorations.addTrees(NORTH_DISTRICT_AREA.parkTrees.map(([x, z]) => [x, terrainHeight(x, z), z] as const));
  NORTH_DISTRICT_AREA.parkBenches.forEach(([x, z, rotY]) => worldDecorations.addBench(x, terrainHeight(x, z), z, rotY));
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
  worldDecorations.update = (elapsed) => {
    updateDecorations(elapsed);
    constructionScene.update();
    riverChenxi.update(elapsed ?? 0);
    updateKomorebiClockworks(options.buildings, elapsed ?? 0, options.reduced);
    // 跨海交通列车巡游（矩阵级更新；frameLoop 每帧调 worldDecorations.update）。
    yearTownTransit.update(elapsed ?? 0);
    // 年份镇装置动画与 XL 信标脉冲（旗摆/喷泉/光环；矩阵与材质级更新，无 gsap）。
    yearTownDecor.update(elapsed ?? 0);
  };
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
        archipelagoIsles.dispose();
        yearTownTransit.dispose();
        yearTownDecor.dispose();
      },
    },
  };
}
