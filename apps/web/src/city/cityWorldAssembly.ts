import * as THREE from 'three';
import type { ResourcePool } from '../core/ResourcePool';
import { readRenderSettings } from '../rendering/createRenderer';
import { createWorldDecorations } from '../rendering/worldDecorations';
import { createCitySurfaces } from '../rendering/createCitySurfaces';
import { addRealBuildingModels } from '../rendering/realBuildingModels';
import { addEchoObservatoryArea } from '../rendering/echoObservatoryArea';
import { createSceneInterestPoints } from '../rendering/sceneInterestPoints';
import { createBuildingSceneController } from './buildingSceneController';
import { createBuildingLabelController } from '../adapters/ui/buildingLabelController';
import { applyStoryLockedBuildingPresentation } from './storyLockedBuildingPresentation';
import { createNpcSystem, type Npc } from './npcSystem';
import { NPC_PROFILES } from './data/npcs';
import { BUILDING_DEFS } from './data/buildings';
import { CITY_LIMIT, PALETTE, ROAD_COORDS } from './data/cityConfig';
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
    pathMaterials: options.pathMats,
    lampMaterials: options.lampGlobes,
    getIsNight: options.getIsNight,
    makeMaterial: graphics.mesh.stdMat,
    makeMesh: graphics.mesh.mk,
    addPart: graphics.mesh.part,
    addRaycastGroup: (group) => raycastBuildingGroups.push(group),
    addObstacleGroup: (group) => options.roadNavigation.registerObstacleGroup(group),
    waterRendering: readRenderSettings().waterRendering,
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
  npcSystem.addCharacters();
  const sceneInterestPoints = createSceneInterestPoints({
    scene,
    makeMaterial: graphics.mesh.stdMat,
    makeMesh: graphics.mesh.mk,
    waterRendering: readRenderSettings().waterRendering,
  });
  sceneInterestPoints.obstacleRoots.forEach((root) => options.roadNavigation.registerObstacleGroup(root));
  addRealBuildingModels(scene, options.buildings)
    .then(() => {
      options.roadNavigation.cacheBuildingBoxes();
      options.onModelsLoaded();
    })
    .catch((error) => console.error('3D model loading failed', error));
  const buildingLabelController = createBuildingLabelController({
    getBuildings: () => options.buildings,
    isStoryLocked: options.isBuildingUnavailable,
    interact: options.interactOrWalk,
  });
  buildingLabelController.addLabels();
  buildingLabelController.applyRenames();
  applyStoryLockedBuildingPresentation(options.buildings.filter(options.isStoryLocked));
  return {
    worldDecorations,
    npcSystem,
    buildingSceneController,
    buildingLabelController,
    sceneInterestPoints,
    raycastBuildingGroups,
  };
}
