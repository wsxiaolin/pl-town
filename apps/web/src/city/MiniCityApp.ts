import * as THREE from 'three';
import { gsap } from 'gsap';
import { ResourcePool } from '../core/ResourcePool';
import { readRenderSettings } from '../rendering/createRenderer';
import { createProceduralTextureLibrary } from '../rendering/proceduralTextureLibrary';
import { createBuildingMeshFactory } from '../rendering/buildingMeshFactory';
import { createWorldDecorations } from '../rendering/worldDecorations';
import { BUILDING_PLATFORM_HEIGHT, CAMERA_OFFSET, CITY_CONFIG, CITY_LIMIT, ECHO_OBSERVATORY_AREA, PALETTE, ROAD_COORDS, WEST_BEACH } from './data/cityConfig';
import { BUILDING_DEFS, BUILDING_CONTENT } from './data/buildings';
import { MUSIC_HALL_LYRICS } from './data/musicHallLyrics';
import { MEMORIAL_ROSTER } from './data/memorialRoster';
import { NPC_PROFILES } from './data/npcs';
import { createCitySurfaces } from '../rendering/createCitySurfaces';
import { addRealBuildingModels } from '../rendering/realBuildingModels';
import { destroyCG, initCG, shouldShowCG, startCG } from './cg';
import { destroyMusterCG } from './musterCg';
import { startInvasionCG, stopInvasionCG } from './invasionCg';
import { SIDE_QUESTS } from '../gameplay/content/quests/sideQuests';
import { LocalStorageQuestJournalRepository } from '../adapters/storage/LocalStorageQuestJournalRepository';
import { QuestRuntime } from '../gameplay/quests/QuestRuntime';
import { createCityDialogController, type CityDialogController, type NpcEntityLike } from '../adapters/ui/cityDialogController';
import { createCommunityPanelController } from '../adapters/ui/communityPanelController';
import { createMultiplayerHousingController } from '../adapters/ui/multiplayerHousingController';
import { createWriterCatalogController, type WriterCatalogController } from '../adapters/ui/writerCatalogController';
import { createNewsstandController, type NewsstandController } from '../adapters/ui/newsstandController';
import { createAcademyController, type AcademyController } from '../adapters/ui/academyController';
import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import type { SceneInterestPoints } from '../rendering/sceneInterestPoints';
import type { SceneInterestPointController } from './sceneInterestPointController';
import { calcLevel, formatDate, formatTime, getStats, getUserId, saveStats, startTimeTracking } from './progression/legacyStats';
import { createRoadNavigationSystem } from './navigation/roadNavigation';
import { createNpcSystem, type Npc } from './npcSystem';
import { createSceneInterestPoints } from '../rendering/sceneInterestPoints';
import type { SceneInterestPointId } from '../rendering/sceneInterestPoints';
import { addEchoObservatoryArea } from '../rendering/echoObservatoryArea';
import { createSceneInterestPointController } from './sceneInterestPointController';
import { createMapController } from './mapController';
import { createPlayerController } from './navigation/playerController';
import { createMovementInputController } from './navigation/movementInputController';
import { createCameraController } from './navigation/cameraController';
import { createCameraPanController } from './navigation/cameraPanController';
import { createProgressionController } from './progression/progressionController';
import { createBuildingSceneController } from './buildingSceneController';
import { findBuildingFromRaycastHits } from './buildingRaycast';
import { createBuildingLabelController } from '../adapters/ui/buildingLabelController';
import { applyStoryLockedBuildingPresentation } from './storyLockedBuildingPresentation';
import { createBuildingDamageController } from './buildingDamageController';
import { createLoginController } from '../adapters/ui/loginController';
import { createOnboardingTutorialController } from '../adapters/ui/onboardingTutorialController';
import { createStatsPanelController } from '../adapters/ui/statsPanelController';
import { townGameDay, townGameHour } from '../gameplay/time/townClock';
import { ACHIEVEMENTS, createUnlockTiers } from './progression/achievements';
import { createMeshHelpers, type MeshHelpers } from '../rendering/meshFactory';
import { createThemeClock } from './themeClock';
import { createInteractionPointer } from './interactionPointer';
import { showUnlockToast } from './toast';
import { createInteractionTracker } from './interactionTracker';
import { createSceneAnimations } from './sceneAnimations';
import { createFrameLoop } from './frameLoop';
import { createBurnCityEffect } from './burnCityEffect';
import { createWildMushroomRestaurant } from './wildMushroomRestaurant';
import { installDebugApi } from './debugApi';
import { createBuildingInteraction } from './buildingInteraction';
import { createEventBindings } from './eventBindings';
import { createFilmCityExperienceController } from './filmCity/filmCityExperienceController';
import { preloadTextureResources } from './textureResourcePreloader';
import { createIceKingFeatureExperience } from './iceKing/createIceKingFeatureExperience';
import { createIceKingBuildingFeature } from './iceKing/createIceKingBuildingFeature';
import { createBuildingFeatureRegistry } from './buildingFeatures/buildingFeatureRegistry';
import { createWeatherEffect } from '../rendering/weatherEffect';
import { createNavigationTargetMarker } from '../rendering/navigationTargetMarker';
import { createBuildingAvailability, storyLockedBuildingIds } from './buildingAvailability';
import { addCityFountain, addCityLighting, createCityOrthographicCamera, createCityScene, createCityWebRenderer } from './citySceneBootstrap';
import { createStoryOrchestration, routeNpcDialog, type StoryOrchestration } from './storyOrchestration';
import { createWeatherController } from './weatherController';
const resources = new ResourcePool();
let clockInterval = 0, trackingInterval = 0;
let started = false;
let eventController = new AbortController(), raycastBuildingGroups: THREE.Object3D[] = [];
const buildingPlotTargets: THREE.Object3D[] = [];
const labelWorldPosition = new THREE.Vector3();
const MOBILE  = () => window.innerWidth <= 680;
const REDUCED = false;
const P = PALETTE;
const weatherController = createWeatherController({
  apply: (next, changed) => {
    document.body.dataset.weather = next;
    weatherEffect?.set(next);
    if (!changed) return;
    refreshWeather();
    proceduralTextures.refreshWeather();
  },
});
const proceduralTextures = createProceduralTextureLibrary(
  resources,
  () => renderer,
  () => readRenderSettings().anisotropy,
  () => weatherController.get(),
  () => readRenderSettings().textureRendering,
);
const TEX = proceduralTextures.backgrounds;
const _tex = proceduralTextures.repeat;
const addFacade = proceduralTextures.addFacade;
const { stdMat, mk, part, refreshWeather }: MeshHelpers = createMeshHelpers(resources, _tex, () => weatherController.get());

let renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.OrthographicCamera;
const pathMats: THREE.MeshStandardMaterial[] = [], groundMats: { mat: THREE.MeshStandardMaterial; night: number; day: number }[] = [], lampGlobes: THREE.MeshStandardMaterial[] = [], buildings: BuildingEntity[] = [], npcList: Npc[] = [];
let cursorChar: THREE.Group | null = null;
let playerPath: THREE.Vector3[] = [];
let playerMarker: THREE.Group | null = null; // 玩家头顶的三角标记，用于高亮
let cameraZoom: number; // 当前视野宽度，由滚轮/双指缩放调整
let preIceCameraZoom: number = CITY_CONFIG.cameraNearSize;
let lastFrameTime = performance.now();
let isNight    = false; // 由社区时间自动决定
const residences: ResidenceEntity[] = [];
const availability = createBuildingAvailability({
  storyLockedIds: storyLockedBuildingIds(BUILDING_DEFS),
  getResidences: () => residences,
});
let currentFilter = 'all';
const cameraTarget = new THREE.Vector3(0,0,0);
let cityDialogs: CityDialogController | null = null;
let stories: StoryOrchestration;
let mapController: ReturnType<typeof createMapController>;
let loginController: ReturnType<typeof createLoginController>;
let onboardingTutorial: ReturnType<typeof createOnboardingTutorialController>;
let statsPanelController: ReturnType<typeof createStatsPanelController>;
let playerController: ReturnType<typeof createPlayerController>, movementInputController: ReturnType<typeof createMovementInputController>;
let cameraController: ReturnType<typeof createCameraController>;
let cameraPanController: ReturnType<typeof createCameraPanController>;
let filmCityCinematicActive = false;
let progressionController: ReturnType<typeof createProgressionController>;
let buildingSceneController: ReturnType<typeof createBuildingSceneController>;
let buildingLabelController: ReturnType<typeof createBuildingLabelController>;
let communityPanels: ReturnType<typeof createCommunityPanelController>, writerCatalogController: WriterCatalogController, newsstandController: NewsstandController, academyController: AcademyController;
let multiplayerHousing: ReturnType<typeof createMultiplayerHousingController>;
let worldDecorations: ReturnType<typeof createWorldDecorations>;
let npcSystem: ReturnType<typeof createNpcSystem>;
let sceneInterestPoints: SceneInterestPoints | null = null;
let sceneInterestPointController: SceneInterestPointController | null = null;
let iceKingFeature: ReturnType<typeof createIceKingFeatureExperience> | null = null;
const buildingFeatureRegistry = createBuildingFeatureRegistry();
buildingFeatureRegistry.register(createIceKingBuildingFeature({
  getSanctum: () => iceKingFeature?.sanctum ?? null,
  showLocked: () => showUnlockToast('皇冠建筑已经无法再次进入'),
}));
let weatherEffect: ReturnType<typeof createWeatherEffect> | null = null;
let navigationTargetMarker: ReturnType<typeof createNavigationTargetMarker> | null = null;
let buildingDamageController: ReturnType<typeof createBuildingDamageController>;
let questEventSequence = 0;
const questRuntime = new QuestRuntime(SIDE_QUESTS, new LocalStorageQuestJournalRepository());
let gameClock = townGameHour();

const mouse2D     = new THREE.Vector2(-9999, -9999);
const raycaster   = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorWorld = new THREE.Vector3();
const CONFIG = CITY_CONFIG;

const PLH = BUILDING_PLATFORM_HEIGHT;

const themeClock = createThemeClock({
  getSkyTextures: () => TEX,
  getScene: () => scene,
  getPalette: () => P,
  getPathMaterials: () => pathMats,
  getGroundMaterials: () => groundMats,
  getLampGlobes: () => lampGlobes,
  getIsNight: () => isNight,
  setIsNight: (value) => { isNight = value; },
  getGameClock: () => gameClock,
  setGameClock: (value) => { gameClock = value; },
  announceGuide: () => stories?.announceGuide(),
  invalidateMapShot: () => mapController?.invalidateShot(),
  updateNpcSchedules: () => npcSystem?.updateNpcSchedules(),
  getStats,
  saveStats,
  checkAchievements,
});

const interactionPointer = createInteractionPointer({
  getCamera: () => camera,
  getRaycaster: () => raycaster,
  getMouse2D: () => mouse2D,
  getGroundPlane: () => groundPlane,
  getCursorWorld: () => cursorWorld,
  getRaycastBuildingGroups: () => raycastBuildingGroups,
  getCursorChar: () => cursorChar,
  getBuildings: () => buildings,
  getSceneInterestPoints: () => sceneInterestPoints,
  getEchoStoryController: () => stories?.echo,
  getCityDialogs: () => cityDialogs,
  getConfig: () => CONFIG,
  isBuildingUnavailable: availability.isBuildingUnavailable,
  isResidenceUnavailable: availability.isResidenceUnavailable,
  findRaycastBuilding,
  raycastUserData,
  npcForRaycast,
  nearestNpcTo,
  openNpcDialog,
  openResidence,
  onYouClick,
  movePlayerTo,
  selectNavigationTarget,
  clearNavigationTarget,
  navigateTo,
  interactWithSceneInterestPoint,
  interactWithInterestPointController: (id) => sceneInterestPointController?.interact(id),
  getSpecialInterior: () => iceKingFeature?.sanctum.isActive() ? iceKingFeature.sanctum : null,
});

const interactionTracker = createInteractionTracker({
  getStats,
  saveStats,
  checkAchievements,
  updateWelcome,
  getProgressionController: () => progressionController,
  getQuestRuntime: () => questRuntime,
  getEchoStoryController: () => stories?.echo,
  getCamera: () => camera,
  getQuestEventSequence: () => questEventSequence,
  incrementQuestEventSequence: () => { questEventSequence++; },
  getCursorChar: () => cursorChar,
});

const sceneAnimations = createSceneAnimations({
  getBuildings: () => buildings,
  reduced: REDUCED,
});

const frameLoop = createFrameLoop({
  getRenderer: () => renderer,
  getScene: () => scene,
  getCamera: () => camera,
  getBuildings: () => buildings,
  getResidences: () => residences,
  getLabelWorldPosition: () => labelWorldPosition,
  getNpcList: () => npcSystem?.getAvoidanceNpcs() ?? npcList,
  getPlayerController: () => playerController,
  getCameraPanController: () => cameraPanController,
  getMultiplayerHousing: () => multiplayerHousing,
  getSceneInterestPoints: () => sceneInterestPoints,
  getSceneInterestPointController: () => sceneInterestPointController,
  getWorldDecorations: () => worldDecorations,
  getMapController: () => mapController,
  getNavigationTargetMarker: () => navigationTargetMarker,
  getBurnOverlay: () => burnCityEffect,
  getCursorChar: () => cursorChar,
  getCityDialogs: () => cityDialogs,
  getBeachEncounterActive: () => Boolean(cityDialogs?.isOpen()),
  getSpecialInterior: () => iceKingFeature?.sanctum.isActive() ? iceKingFeature.sanctum : null,
  updateWeather: (delta) => weatherEffect?.update(delta),
  getLastFrameTime: () => lastFrameTime,
  setLastFrameTime: (value) => { lastFrameTime = value; },
  npcYieldToPlayer,
  isStoryLockedBuilding: availability.isStoryLocked,
});

const roadNavigation = createRoadNavigationSystem({
  roadCoords: ROAD_COORDS,
  echoObservatoryArea: ECHO_OBSERVATORY_AREA,
  westBeach: WEST_BEACH,
  cityLimit: CITY_LIMIT,
  getBuildings: () => buildings,
});
const FOUNTAIN_CLEAR = roadNavigation.fountainClear;
const buildRoadPath = roadNavigation.buildRoadPath;
const buildingRoadEntry = roadNavigation.buildingRoadEntry;
const pointInAnyBuilding = roadNavigation.pointInAnyBuilding;
const cacheBuildingBoxes = roadNavigation.cacheBuildingBoxes;
const nearestRoadCoord = roadNavigation.nearestRoadCoord;
const clamp = roadNavigation.clamp;

const burnCityEffect = createBurnCityEffect({
  getScene: () => scene,
  getRenderer: () => renderer,
  cityLimit: CITY_LIMIT,
  reduced: REDUCED,
});

const wildMushroomRestaurant = createWildMushroomRestaurant({
  getDialogs: () => cityDialogs,
  burnCity: (onDone) => burnCityEffect.trigger(onDone),
  awardAchievement: awardDirectAchievement,
});

const filmCityExperience = createFilmCityExperienceController({
  dialogs: () => cityDialogs,
  getCurrency: () => multiplayerHousing?.progression.getProgress().currency ?? 0,
  purchase: () => multiplayerHousing?.progression.purchaseFilmCityExperience() ?? Promise.resolve(false),
  getCameraSnapshot: () => ({ x: cameraTarget.x, z: cameraTarget.z, zoom: cameraZoom }),
  playShots: (shots, onComplete) => cameraController?.playSequence(shots, onComplete),
  stopShots: () => cameraController?.stop(),
  restoreCamera: (snapshot) => {
    cameraZoom = snapshot.zoom;
    updateCameraProjection(cameraZoom);
    cameraController?.setTarget(snapshot.x, snapshot.z, true);
  },
  setCinematicActive: (active) => {
    filmCityCinematicActive = active;
    movementInputController?.setLocked(active);
  },
  clearPlayerPath: () => { playerPath = []; },
  showToast: showUnlockToast,
});

const buildingInteraction = createBuildingInteraction({
  isBuildingUnavailable: availability.isBuildingUnavailable,
  getMultiplayerHousing: () => multiplayerHousing,
  getCityDialogs: () => cityDialogs,
  getStoryRouter: () => stories?.router,
  getStatsPanelController: () => statsPanelController,
  getCommunityPanels: () => communityPanels,
  getWriterCatalogController: () => writerCatalogController,
  getNewsstandController: () => newsstandController,
  getAcademyController: () => academyController,
  trackInteraction,
  getWildMushroomRestaurant: () => wildMushroomRestaurant,
  getFilmCityController: () => filmCityExperience,
  interactWithFeature: buildingFeatureRegistry.interact,
});

const eventBindings = createEventBindings({
  getCanvas: () => document.getElementById('c') as HTMLElement,
  getSignal: () => eventController.signal,
  getRenderer: () => renderer,
  onMouseMove,
  onCanvasClick,
  consumeSuppressedCanvasClick: () => cameraPanController?.consumeSuppressedClick() ?? false,
  onViewInteraction: () => cameraPanController?.notifyViewInteraction(),
  clamp,
  getCameraZoom: () => cameraZoom,
  setCameraZoom: (value) => { cameraZoom = value; },
  updateCameraProjection,
  getConfig: () => CONFIG,
  onYouClick,
  closeRenderSettings: () => eventBindings.closeRenderSettings(),
  getStatsPanelController: () => statsPanelController,
  getCommunityPanels: () => communityPanels,
  getMapController: () => mapController,
  getWriterCatalogController: () => writerCatalogController,
  getAcademyController: () => academyController,
  toggleMapMode,
  closeModal: () => buildingInteraction.closeModal(),
  closeNpcDialog,
  getLoginController: () => loginController,
  isMovementOnlyMode: () => Boolean(iceKingFeature?.sanctum.isActive()),
});

// Unlock tiers reference world decoration helpers, which are created during init().
let UNLOCK_TIERS = createUnlockTiers(
  (positions) => worldDecorations?.addLamps(positions),
  (positions) => worldDecorations?.addTrees(positions),
  (x: number, y: number, z: number, rotY: number) => worldDecorations?.addArch(x, y, z, rotY),
  (x: number, y: number, z: number, rotY: number) => worldDecorations?.addBench(x, y, z, rotY),
);

function awardDirectAchievement(id: string, name: string) { progressionController?.awardDirectAchievement(id, name); }
function checkAchievements() { progressionController?.checkAchievements(); }
function init() {
  weatherController.set(weatherController.get());
  setupRenderer();
  cameraController = createCameraController({
    getCamera: () => camera,
    getZoom: () => cameraZoom,
    setZoom: (zoom) => { cameraZoom = zoom; },
    getTarget: () => cameraTarget,
    isInteriorActive: () => Boolean(stories?.echo.isInteriorView() || iceKingFeature?.sanctum.isActive()),
    defaultInteriorCenter: ECHO_OBSERVATORY_AREA.interior,
    getInteriorCenter: () => iceKingFeature?.sanctum.isActive() ? iceKingFeature.sanctum.center : ECHO_OBSERVATORY_AREA.interior,
    getInteriorCameraOffset: () => iceKingFeature?.sanctum.isActive() ? [13, 22, 17] : null,
    getInteriorFollowsTarget: () => Boolean(iceKingFeature?.sanctum.isActive()),
    cameraOffset: CAMERA_OFFSET,
  });
  setupCamera(); proceduralTextures.initialize(); setupScene();
  addCityLighting(scene, MOBILE, isNight);
  navigationTargetMarker = createNavigationTargetMarker(scene);
  window.addEventListener('minicity:textures-ready', () => {
    refreshWeather(); proceduralTextures.refreshWeather(); weatherEffect?.set(weatherController.get());
  }, { once: true, signal: eventController.signal });
  worldDecorations = createWorldDecorations({
    scene, resources, palette: P, roadCoords: ROAD_COORDS, cityLimit: CITY_LIMIT,
    buildings, residences, pathMaterials: pathMats, lampMaterials: lampGlobes,
    getIsNight: () => isNight, makeMaterial: stdMat, makeMesh: mk, addPart: part,
    addRaycastGroup: (group) => raycastBuildingGroups.push(group),
    addObstacleGroup: (group) => roadNavigation.registerObstacleGroup(group),
    waterRendering: readRenderSettings().waterRendering,
  });
  npcSystem = createNpcSystem({
    scene, profiles: NPC_PROFILES, npcList,
    actors: {
      get cursorChar() { return cursorChar; },
      set cursorChar(value) { cursorChar = value; },
      get playerMarker() { return playerMarker; },
      set playerMarker(value) { playerMarker = value; },
    },
    raycaster, roadCoords: ROAD_COORDS, reduced: REDUCED, isMobile: MOBILE,
    getGameClock: () => gameClock, getCurrentFilter: () => currentFilter,
    nearestRoadCoord, buildRoadPath, makeMaterial: stdMat, makeMesh: mk,
    makeCharacterMaterial: (partName, color, factory) => resources.material(
      { kind: 'character', partName, color },
      factory,
    ),
    view: {
      get mapMode() { return Boolean(mapController?.isOpen()); },
      get dialogOpen() { return Boolean(cityDialogs?.isOpen()); },
      get cameraZoom() { return cameraZoom; },
      set cameraZoom(value) { cameraZoom = value; },
    },
    updateCameraProjection, getActiveStoryActorIds: () => stories?.getActiveStoryActorIds() ?? new Set(),
  });
  createCitySurfaces({
    scene,
    isNight,
    roadCoords: ROAD_COORDS,
    cityLimit: CITY_LIMIT,
    colors: { asphalt: P.ASPHALT, dayPath: P.DAY_PATH, nightPath: P.NIGHT_PATH },
    createMaterial: stdMat,
    createMesh: mk,
    pathMaterials: pathMats,
    groundMaterials: groundMats,
    addLamps,
  });
  addCityFountain({ scene, palette: P, part });
  buildingSceneController = createBuildingSceneController({
    scene,
    definitions: BUILDING_DEFS,
    builders: SHAPE_FNS,
    addFacade,
    material: stdMat,
    addPlot: (plot) => buildingPlotTargets.push(plot),
    addBuilding: (building) => buildings.push(building),
    isNight: () => isNight,
  });
  buildingSceneController.addBuildings();
  raycastBuildingGroups = [...buildings.map(b => b.group), ...buildingPlotTargets];
  addEchoObservatoryArea({
    scene,
    makeMaterial: (parameters) => resources.material({ kind: 'echo-observatory', ...parameters }, () => stdMat(parameters)),
  }).forEach(group => roadNavigation.registerObstacleGroup(group));
  cacheBuildingBoxes(); addDecorations(); addCharacters();
  sceneInterestPoints = createSceneInterestPoints({ scene, makeMaterial: stdMat, makeMesh: mk, waterRendering: readRenderSettings().waterRendering });
  sceneInterestPoints.obstacleRoots.forEach((root) => roadNavigation.registerObstacleGroup(root));
  addRealBuildingModels(scene, buildings)
    .then(() => { cacheBuildingBoxes(); buildingDamageController?.applyPersisted(); })
    .catch(error => console.error('3D model loading failed', error));
  buildingLabelController = createBuildingLabelController({ getBuildings: () => buildings, isStoryLocked: availability.isBuildingUnavailable, interact: interactOrWalk });
  buildingLabelController.addLabels(); buildingLabelController.applyRenames(); applyStoryLockedBuildings();
  communityPanels = createCommunityPanelController({ setPhoneOpen, showUnlockToast });
  writerCatalogController = createWriterCatalogController({ document });
  newsstandController = createNewsstandController({ document, signal: eventController.signal });
  academyController = createAcademyController(document);
  multiplayerHousing = createMultiplayerHousingController({
    scene, signal: eventController.signal, residences, getCursorChar: () => cursorChar,
    makeCharacter, showLoginEntry, showLoginOverlay, showUnlockToast, movePlayerTo, pointInAnyBuilding,
    fountainClear: FOUNTAIN_CLEAR, getMapIconsBuilt: () => Boolean(mapController?.areIconsBuilt()),
    mapShotSpan: 48, getMapMode: () => Boolean(mapController?.isOpen()), toggleMapMode, communityPanels,
    isResidenceUnavailable: availability.isResidenceUnavailable,
    getLegacyAchievements: () => getStats().achievements || [],
    setWeather: (value) => weatherController.set(value),
  });
  buildingDamageController = createBuildingDamageController({
    getBuildings: () => buildings,
    getResidences: () => residences,
    invalidateMap: () => mapController?.invalidateShot(),
    refreshResidenceLabels: () => multiplayerHousing?.renderMapHouseTags(),
    setResidenceVisualVisible: (id, visible) => worldDecorations?.setResidenceVisualVisible(id, visible),
  });
  buildingDamageController.applyPersisted();
  progressionController = createProgressionController({
    getStats,
    saveStats,
    achievements: ACHIEVEMENTS,
    unlockTiers: UNLOCK_TIERS,
    unlockAchievement: (id) => multiplayerHousing?.progression.unlockAchievement(id),
    showToast: showUnlockToast,
  });
  stories = createStoryOrchestration({
    echo: {
      document,
      consumeItem: (itemId, quantity) => { void multiplayerHousing?.progression.consumeItem(itemId, quantity); },
      setStoryPoints: (ids) => sceneInterestPoints?.setActiveStoryPoints(ids as readonly SceneInterestPointId[]),
      getCursor: () => cursorChar ? { position: cursorChar.position, rotation: cursorChar.rotation, visible: cursorChar.visible } : null,
      clearPlayerPath: () => { playerPath = []; },
      setCameraTarget: (x, z, instant) => cameraController?.setTarget(x, z, instant),
      stopCameraTween: () => cameraController?.stop(),
      getCameraZoom: () => cameraZoom,
      setCameraZoom: (zoom) => { cameraZoom = zoom; },
      updateCameraProjection: (zoom) => cameraController?.updateProjection(zoom),
      isMobile: MOBILE,
      getScene: () => scene,
      sendLocalPosition: (cursor) => multiplayerHousing?.sendLocalPosition({ x: cursor.position.x, y: 0, z: cursor.position.z, rotation: cursor.rotation.y }, performance.now()),
      goToObservatory: () => { cursorChar && setCameraTarget(ECHO_OBSERVATORY_AREA.center[0], ECHO_OBSERVATORY_AREA.center[1], false); },
    },
    getQuestContext: () => ({ ...getQuestProgressView(), gameDay: townGameDay() }),
    awardAchievement: awardDirectAchievement,
    showToast: showUnlockToast,
    updateNpcSchedules: () => npcSystem?.updateNpcSchedules(),
  });
  stories.setupEcho(scene);
  mapController = createMapController({
    document,
    getScene: () => scene,
    getBuildings: () => buildings,
    getCursor: () => cursorChar,
    getStats,
    getCamera: () => camera,
    getBuildingContent: (buildingId) => BUILDING_CONTENT[buildingId],
    isStoryLocked: availability.isBuildingUnavailable,
    getBuildingRoadEntry: (position) => roadNavigation.buildingRoadEntry(position),
    setCameraTarget,
    movePlayerTo,
    clearPlayerPath: () => { playerPath = []; },
    renderMapHouseTags,
    openResidence: () => undefined,
  });
  mapController.setup(eventController.signal);
  movementInputController=createMovementInputController({document,window,signal:eventController.signal,onManualStart:()=>{playerPath=[];interactionPointer.clearPending();clearNavigationTarget();}});
  cameraPanController=createCameraPanController({
    canvas: document.getElementById('c') as HTMLElement, document, window, signal: eventController.signal,
    getCamera: () => camera, getCameraTarget: () => cameraTarget,
    getPlayerPosition: () => cursorChar?.position ?? null, cityLimit: CITY_LIMIT,
    setCameraTarget, stopCameraMotion: () => cameraController?.stop(),
    isBlocked: () => filmCityCinematicActive || Boolean(mapController?.isOpen())
      || Boolean(cityDialogs?.isOpen()) || Boolean(stories?.echo.isInteriorView()),
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filmCityExperience.isActive()) filmCityExperience.stop();
  }, { signal: eventController.signal });
  playerController = createPlayerController({
    getCursor: () => cursorChar,
    getCamera: () => camera,
    getCameraTarget: () => cameraTarget,
    setCameraTarget,
    getPlayerPath: () => playerPath,
    setPlayerPath: (path) => { playerPath = path; },
    isDialogOpen: () => Boolean(cityDialogs?.isOpen()),
    isMapOpen: () => Boolean(mapController?.isOpen()),
    buildRoadPath,
    clamp,
    playerSpeed: CONFIG.playerSpeed,
    getNpcs: () => npcList,
    getEcho: () => stories?.echo,
    getSpecialInterior: () => iceKingFeature?.sanctum.isActive() ? iceKingFeature.sanctum : null,
    echoInterior: ECHO_OBSERVATORY_AREA.interior,
    onIdle: handlePlayerIdle,
    sendPosition: (cursor) => multiplayerHousing?.sendLocalPosition({ x: cursor.position.x, y: cursor.position.y, z: cursor.position.z, rotation: cursor.rotation.y }, performance.now()),
    addDistance: flushDistance,
    getManualMovement: () => movementInputController?.getMovement() ?? { x: 0, z: 0 },
    resolveMovement: (from, target, result) => roadNavigation.resolveMovement(from, target, result),
    isInputLocked: () => filmCityCinematicActive,
    isCinematicCameraActive: () => filmCityCinematicActive,
    isCameraFollowSuspended: () => cameraPanController?.isFollowSuspended() ?? false,
  });
  loginController = createLoginController({
    getStats,
    saveStats,
    ensureUserId: getUserId,
    checkAchievements,
    shouldShowIntro: shouldShowCG,
    startIntro: startCG,
    proceed: proceedToCity,
  });
  onboardingTutorial = createOnboardingTutorialController({ document, signal: eventController.signal });
  statsPanelController = createStatsPanelController({
    getStats,
    getUserId,
    calcLevel,
    formatDate,
    formatTime,
    getBuildingCount: () => BUILDING_DEFS.length,
    getNpcCount: () => NPC_PROFILES.length,
    achievements: ACHIEVEMENTS,
    unlockTiers: UNLOCK_TIERS,
  });
  cityDialogs=createCityDialogController({
    document,
    buildingContent: BUILDING_CONTENT,
    getQuestAction: (npcId)=>questRuntime.getNpcAction(npcId,getQuestProgressView()),
    performQuestAction: (action,at)=>questRuntime.performNpcAction(action,at),
    onNpcInteracted: recordNpcInteraction,
    onDialogueAction: (action)=>{
      if(action.startsWith('teleport:')) mapController?.teleportToBuilding(action.slice(9));
      if(action.startsWith('open-url:')) window.location.href=action.slice(9);
      buildingFeatureRegistry.handleDialogueAction(action, 'city-dialog');
    },
    pauseNpcs,
    resumeNpcs,
    showToast: showUnlockToast,
    musicHallLyrics: MUSIC_HALL_LYRICS,
    memorialRoster: MEMORIAL_ROSTER,
    signal: eventController.signal,
  });
  cityDialogs.setup();
  weatherEffect = createWeatherEffect({ scene, getCursor: () => cursorChar,
    restoreSky: () => themeClock.restoreSky(), onWeatherChanged: (next) => { if (next) document.body.dataset.cityWeather = next; else delete document.body.dataset.cityWeather; } }); weatherEffect.set(weatherController.get());
  iceKingFeature = createIceKingFeatureExperience({
    scene, makeCharacter,
    makeMaterial: (parameters) => resources.material({ kind: 'ice-sanctum', ...parameters }, () => stdMat(parameters)),
    getCursor: () => cursorChar, dialogs: () => cityDialogs,
    progression: multiplayerHousing.progression,
    awardAchievement: awardDirectAchievement,
    showToast: showUnlockToast,
    onEnter: () => {
      if (mapController?.isOpen()) mapController.toggle();
      setPhoneOpen(false); statsPanelController?.close(); eventBindings.closeRenderSettings();
      preIceCameraZoom = cameraZoom; cameraZoom = MOBILE() ? 9.5 : 13.5;
      updateCameraProjection(cameraZoom);
      playerPath = []; interactionPointer.clearPending();
    },
    onReturn: (weather) => {
      weatherController.set(weather === 'rain' ? 'rain' : 'clear');
      cameraZoom = preIceCameraZoom; updateCameraProjection(cameraZoom);
      mapController?.invalidateShot();
      setCameraTarget(cursorChar?.position.x ?? 20, cursorChar?.position.z ?? 26, true);
      multiplayerHousing?.sendLocalPosition({ x: cursorChar?.position.x ?? 20, y: 0, z: cursorChar?.position.z ?? 26, rotation: cursorChar?.rotation.y }, performance.now());
    },
    setCameraTarget: (x, z, instant) => cameraController?.setTarget(x, z, instant),
    focusCamera: (x, z, focusOptions) => cameraController?.focus(x, z, focusOptions),
    stopCameraFocus: () => cameraController?.stop(),
  });
  sceneInterestPointController=createSceneInterestPointController({
    dialogs: cityDialogs,
    inventory: {
      isOnline: () => multiplayerHousing.progression.isOnline(),
      hasItem: (itemId, count=1) => multiplayerHousing.progression.isOnline()
        && (multiplayerHousing.progression.getProgress().inventory[itemId] ?? 0) >= count,
      consumeItem: (itemId, count) => multiplayerHousing.progression.consumeItem(itemId, count),
      claimReward: (rewardId) => multiplayerHousing.progression.claimReward(rewardId), hasAchievement: (achievementId) => multiplayerHousing.progression.getProgress().achievements.includes(achievementId),
    },
    awardAchievement: awardDirectAchievement,
    showToast: showUnlockToast,
    interactWithStory: (id) => cityDialogs ? stories.echo.interactInterestPoint(id, cityDialogs) : false,
    interactWithFeature: (id) => iceKingFeature?.iceWall.interact(id) ?? false,
    setWellPhase: (phase) => {
      sceneInterestPoints?.setWellPhase(phase);
      if (!camera) return;
      if (phase === 'focus' || phase === 'engulf') {
        cameraZoom = Math.min(cameraZoom, 5.2);
        updateCameraProjection(cameraZoom);
        document.body.dataset.wellVision = phase;
      } else {
        cameraZoom = CONFIG.cameraNearSize;
        updateCameraProjection(cameraZoom);
        delete document.body.dataset.wellVision;
      }
    },
    setBeachEncounterPhase: (phase) => sceneInterestPoints?.setBeachEncounterPhase(phase),
    focusBeachEncounter: () => {
      cameraZoom = 5.5;
      updateCameraProjection(cameraZoom);
      cameraController?.focus(-41.2, 11.5);
    },
  });
  setupEvents(); setupFilter();
  applyTheme(isNight, true);
  initAnimations();
  clockInterval = window.setInterval(syncTimeAndTheme, 1000);
  syncTimeAndTheme();
  document.getElementById('labelsWrap')?.classList.add('hidden');
  frameLoop.start();
  updateWelcome();

  loginController.checkLogin();
  setupMultiplayerUI();
}

function setupRenderer() {
  renderer = createCityWebRenderer();
}
function setupCamera() {
  cameraZoom=CONFIG.cameraNearSize;
  camera = createCityOrthographicCamera(cameraZoom);
  updateCameraProjection(cameraZoom);
  setCameraTarget(0,0,true);
}
function setupScene() {
  scene = createCityScene(isNight, TEX, P);
  installDebugApi({
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
    getCameraZoom: () => cameraZoom,
    getThree: () => THREE,
    getNpcList: () => npcList,
    getCursorChar: () => cursorChar,
    getNavigation: () => roadNavigation,
    getPlayerPath: () => playerPath,
    getBuildings: () => buildings,
    getResidences: () => residences,
    openNpcDialog,
    navigateTo,
    isBuildingUnavailable: availability.isBuildingUnavailable,
    destroyBuilding,
    destroyResidence,
    destroyAll,
    restoreBuilding,
    restoreResidence,
    restoreAll,
    openModal,
    interactWithSceneInterestPoint,
    getSceneInterestPoints: () => sceneInterestPoints,
    burnCity: () => burnCityEffect.trigger(),
    burnCityActive: () => burnCityEffect.isActive(),
    burnCityProgress: () => burnCityEffect.getProgress(),
    playInvasionCG: startInvasionCG,
    stopInvasionCG,
    getWeather: () => weatherController.get(),
    setWeather: (value) => weatherController.set(value),
    getIceSanctum: () => iceKingFeature?.sanctum ?? null,
    getTutorial: () => onboardingTutorial,
  });
}
const buildingMeshFactory = createBuildingMeshFactory({
  palette: P,
  platformHeight: PLH,
  makeMaterial: stdMat,
  makeMesh: mk,
  addPart: part,
});

const SHAPE_FNS = buildingMeshFactory.builders;

function addDecorations() { worldDecorations.addDecorations(); }
function addLamps(positions: readonly (readonly [number, number, number])[]) { worldDecorations.addLamps(positions); }
function makeCharacter(headHex: number, bodyHex: number) { return npcSystem.makeCharacter(headHex, bodyHex); }
function addCharacters() { npcSystem.addCharacters(); }
function onYouClick() { npcSystem.onYouClick(); }
function npcYieldToPlayer(npc: Npc) { npcSystem.npcYieldToPlayer(npc); }
function pauseNpcs() { npcSystem.pauseNpcs(); }
function resumeNpcs() { npcSystem.resumeNpcs(); }
function nearestNpcTo(position: THREE.Vector3, radius: number) { return npcSystem.nearestNpcTo(position, radius); }
function npcForRaycast() { return npcSystem.npcForRaycast(); }
function setupEvents() { eventBindings.setupEvents(); }
export function destroyBuilding(buildingId: string): boolean {
  return buildingDamageController?.destroyBuilding(buildingId) ?? false;
}
export function destroyResidence(residenceId: string): boolean {
  return buildingDamageController?.destroyResidence(residenceId) ?? false;
}
export function destroyAll(): number {
  return buildingDamageController?.destroyAll() ?? 0;
}
export function restoreBuilding(buildingId: string): boolean {
  return buildingDamageController?.restoreBuilding(buildingId) ?? false;
}
export function restoreResidence(residenceId: string): boolean {
  return buildingDamageController?.restoreResidence(residenceId) ?? false;
}
export function restoreAll(): number {
  return buildingDamageController?.restoreAll() ?? 0;
}
function applyStoryLockedBuildings() { applyStoryLockedBuildingPresentation(buildings.filter(availability.isStoryLocked)); }
function onMouseMove(e: MouseEvent) { interactionPointer.onMouseMove(e); }
function setupMultiplayerUI() { multiplayerHousing.setupUI(); }
function setupMultiplayer(nickname: string, password?: string) { multiplayerHousing.connect(nickname, password); }
function showLoginEntry() { loginController?.showLoginEntry(); }
function showLoginOverlay() { loginController?.showLogin(); }
function setPhoneOpen(open: boolean) { multiplayerHousing?.setPhoneOpen(open); }
function renderMapHouseTags() { multiplayerHousing.renderMapHouseTags(); }
function openResidence(residenceId: string) { multiplayerHousing.openResidence(residenceId); }
function raycastUserData(object: THREE.Object3D | null, key: string) { return multiplayerHousing.raycastUserData(object, key); }
function findRaycastBuilding(hits: readonly THREE.Intersection[]) { return findBuildingFromRaycastHits({ hits, buildings, readUserData: raycastUserData, isUnavailable: availability.isBuildingUnavailable }); }
function onCanvasClick(event: MouseEvent) { interactionPointer.onCanvasClick(event); }

function interactOrWalk(b: BuildingEntity) { interactionPointer.interactOrWalk(b); }

function navigateTo(b: BuildingEntity) { buildingInteraction.navigateTo(b); }
function openModal(building: BuildingEntity) { buildingInteraction.openModal(building); }

function interactWithSceneInterestPoint(id: SceneInterestPointId) { interactionPointer.interactWithSceneInterestPoint(id); }

function applyTheme(night: boolean, instant?: boolean) {
  themeClock.applyTheme(night, instant);
  sceneInterestPoints?.setWaterDaylight(night ? 0 : 1, instant);
  worldDecorations?.setWaterDaylight(night ? 0 : 1, instant);
}
function syncTimeAndTheme() { themeClock.syncTimeAndTheme(); weatherEffect?.set(weatherController.get()); }

function entranceAnimation() { sceneAnimations.entranceAnimation(); }
function initAnimations() { sceneAnimations.initAnimations(); }

function toggleMapMode() { mapController?.toggle(); }
function updateCameraProjection(vs: number) { cameraController?.updateProjection(vs); }

function setCameraTarget(x: number, z: number, instant?: boolean) { cameraController?.setTarget(x,z,instant); }

function movePlayerTo(target: THREE.Vector3) { playerController?.moveTo(target); }

function selectNavigationTarget(target: THREE.Vector3) { if (playerController?.moveTo(target)) navigationTargetMarker?.show(target); }

function clearNavigationTarget() { navigationTargetMarker?.hide(); }

function handlePlayerIdle() { interactionPointer.handlePlayerIdle(); }

function flushDistance(amount: number) { interactionTracker.flushDistance(amount); }

function trackInteraction(buildingId: string) { interactionTracker.trackInteraction(buildingId); }
function updateWelcome() { /* Cloud progression owns the unique-building threshold and inventory entry. */ }

function proceedToCity(nickname = localStorage.getItem('minicityUser') || 'visitor', password?: string) {
  entranceAnimation();
  if(cursorChar){ cursorChar.visible=true; }
  trackingInterval=startTimeTracking();
  localStorage.removeItem('minicityPassword');
  setupMultiplayer(nickname, password);
  checkAchievements();
}

function setupFilter() {
  document.querySelectorAll('.pf-btn').forEach(btn=>{
    btn.addEventListener('click',()=>setFilter((btn as HTMLElement).dataset.filter ?? ''));
  });
}

function setFilter(filter: string) {
  currentFilter=filter;
  document.querySelectorAll('.pf-btn').forEach(b=>b.classList.toggle('active',(b as HTMLElement).dataset.filter===filter));
  npcSystem?.updateNpcSchedules();
  if(filter==='friends'){
    showUnlockToast('no friends online yet — invite someone!');
  }
}

function getQuestProgressView() {
  return multiplayerHousing?.progression.getQuestProgressView() ?? {
    flags:{},
    inventory:{},
    achievements:new Set(),
    unlockedBuildings:new Set(),
    unlockedDistricts:new Set(),
  };
}

function recordNpcInteraction(npcId: string) { interactionTracker.recordNpcInteraction(npcId); }

function openNpcDialog(npc: Npc) {
  routeNpcDialog(
    stories.router,
    cityDialogs,
    npc.profile.id,
    () => cityDialogs?.openNpc(npc as NpcEntityLike, cursorChar ? { x: cursorChar.position.x, z: cursorChar.position.z } : undefined),
    () => recordNpcInteraction(npc.profile.id),
  );
}
function closeNpcDialog() { cityDialogs?.closeNpc(); }

export function startMiniCity() {
  if(started)return;
  started=true;
  eventController=new AbortController();
  void preloadTextureResources(readRenderSettings().textureRendering, eventController.signal).then(() => {
    if (!started) return;
    try { init(); } catch (error) { console.error('City initialization failed', error); }
    window.dispatchEvent(new CustomEvent('minicity:city-ready'));
    onboardingTutorial?.start();
  }).catch(() => {
    if (!started) return;
    try { init(); } catch (error) { console.error('City initialization failed', error); }
    window.dispatchEvent(new CustomEvent('minicity:city-ready'));
    onboardingTutorial?.start();
  });
  initCG({
    onFinish: () => {
      showUnlockToast('全屏效果更好哦');
      if(localStorage.getItem('minicityUser')) proceedToCity();
      else loginController?.showLogin();
    },
    reduced: REDUCED,
  });
  document.body.classList.remove('day','night');
  document.body.classList.add(isNight?'night':'day');
}

export function destroyMiniCity() {
  if(!started)return;
  started=false;
  filmCityExperience.dispose();
  frameLoop.stop();
  clearInterval(clockInterval);
  clearInterval(trackingInterval);
  multiplayerHousing?.destroy();
  iceKingFeature?.dispose(); weatherEffect?.dispose();
  iceKingFeature=null; weatherEffect=null;
  destroyCG();
  stopInvasionCG();
  destroyMusterCG();
  eventController.abort();
  npcList.forEach(npc=>npc.tween?.kill());
  npcSystem?.destroy();
  gsap.globalTimeline.clear();
  mapController?.destroy();
  navigationTargetMarker?.dispose();
  navigationTargetMarker=null;
  renderer?.dispose();
  renderer?.forceContextLoss();
  sceneInterestPoints?.dispose();
  scene?.clear();
  resources.dispose();
  buildingPlotTargets.length=0;
  sceneInterestPoints=null;
  sceneInterestPointController=null;
  document.getElementById('labelsWrap')?.replaceChildren();
  document.getElementById('mapIcons')?.replaceChildren();
  stories?.dispose();
}
