import * as THREE from 'three';
import { gsap } from 'gsap';
import { ResourcePool } from '../core/ResourcePool';
import { InstancedBatch } from '../core/InstancedBatch';
import { createRenderer, readRenderSettings } from '../rendering/createRenderer';
import { createProceduralTextureLibrary } from '../rendering/proceduralTextureLibrary';
import { createBuildingMeshFactory } from '../rendering/buildingMeshFactory';
import { createWorldDecorations } from '../rendering/worldDecorations';
import { RENDER_ORDER, SURFACE_Y } from '../rendering/layers';
import { BUILDING_PLATFORM_HEIGHT, CAMERA_OFFSET, CITY_CONFIG, CITY_LIMIT, ECHO_OBSERVATORY_AREA, PALETTE, ROAD_COORDS, WEST_BEACH } from './data/cityConfig';
import { BUILDING_DEFS, BUILDING_CONTENT } from './data/buildings';
import { MUSIC_HALL_LYRICS } from './data/musicHallLyrics';
import { MEMORIAL_ROSTER } from './data/memorialRoster';
import { NPC_PROFILES } from './data/npcs';
import { createCitySurfaces } from '../rendering/createCitySurfaces';
import { addRealBuildingModels } from '../rendering/realBuildingModels';
import { destroyCG, initCG, shouldShowCG, startCG } from './cg';
import { startInvasionCG, stopInvasionCG } from './invasionCg';
import { SIDE_QUESTS } from '../gameplay/content/quests/sideQuests';
import { LocalStorageQuestJournalRepository } from '../adapters/storage/LocalStorageQuestJournalRepository';
import { QuestRuntime } from '../gameplay/quests/QuestRuntime';
import { createCityDialogController, type CityDialogController, type NpcEntityLike } from '../adapters/ui/cityDialogController';
import { createCommunityPanelController } from '../adapters/ui/communityPanelController';
import { createMultiplayerHousingController } from '../adapters/ui/multiplayerHousingController';
import { createWriterCatalogController, type WriterCatalogController } from '../adapters/ui/writerCatalogController';
import { createNewsstandController, type NewsstandController } from '../adapters/ui/newsstandController';
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
import { createEchoStoryController } from './echo/echoStoryController';
import { createYesterdaySongController } from './yesterday/yesterdaySongController';
import { createMagiStoryController } from './magi/magiStoryController';
import { createOvercoatStoryController } from './overcoat/overcoatStoryController';
import { createMapController } from './mapController';
import { createPlayerController } from './navigation/playerController';
import { createMovementInputController } from './navigation/movementInputController';
import { createCameraController } from './navigation/cameraController';
import { createProgressionController } from './progression/progressionController';
import { createBuildingSceneController } from './buildingSceneController';
import { findBuildingFromRaycastHits } from './buildingRaycast';
import { addCityFountain, addCityLighting } from './scenePresentationController';
import { createBuildingLabelController } from '../adapters/ui/buildingLabelController';
import { applyStoryLockedBuildingPresentation } from './storyLockedBuildingPresentation';
import { isBuildingDestroyed } from './buildingDamage';
import { createBuildingDamageController } from './buildingDamageController';
import { createLoginController } from '../adapters/ui/loginController';
import { createStatsPanelController } from '../adapters/ui/statsPanelController';
import { townGameDay, townGameHour } from '../gameplay/time/townClock';
import { ACHIEVEMENTS, createUnlockTiers } from './progression/achievements';
import { BUILDING_PLOT_MAP } from './data/buildingPlots';
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
const resources = new ResourcePool();
let clockInterval = 0, trackingInterval = 0;
let started = false;
let eventController = new AbortController(), raycastBuildingGroups: THREE.Object3D[] = [];
const buildingPlotTargets: THREE.Object3D[] = [];
const labelWorldPosition = new THREE.Vector3();
const MOBILE  = () => window.innerWidth <= 680;
const REDUCED = false;
const P = PALETTE;
const proceduralTextures = createProceduralTextureLibrary(
  resources,
  () => renderer,
  () => readRenderSettings().anisotropy,
);
const TEX = proceduralTextures.backgrounds;
const _tex = proceduralTextures.repeat;
const addFacade = proceduralTextures.addFacade;
const { stdMat, mk, part }: MeshHelpers = createMeshHelpers(resources, _tex);

let renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.OrthographicCamera;
const pathMats: THREE.MeshStandardMaterial[] = [], groundMats: { mat: THREE.MeshStandardMaterial; night: number; day: number }[] = [], lampGlobes: THREE.MeshStandardMaterial[] = [], buildings: BuildingEntity[] = [], npcList: Npc[] = [];
let cursorChar: THREE.Group | null = null;
let playerPath: THREE.Vector3[] = [];
let playerMarker: THREE.Group | null = null; // 玩家头顶的三角标记，用于高亮
let cameraZoom: number; // 当前视野宽度，由滚轮/双指缩放调整
let lastFrameTime = performance.now();
let isNight    = false; // 由社区时间自动决定
const STORY_LOCKED_BUILDINGS = new Set(BUILDING_DEFS.filter((building) => building.storyLocked).map((building) => building.id));
let currentFilter = 'all';
const cameraTarget = new THREE.Vector3(0,0,0);
// The interior camera is kept above the roof line and inside the floor footprint.
// The roof is hidden while inside, so this avoids a near-wall/roof clip while
// still letting the camera look down into the complete room.
let cityDialogs: CityDialogController | null = null;
let echoStoryController: ReturnType<typeof createEchoStoryController>;
let yesterdaySongController: ReturnType<typeof createYesterdaySongController>;
let magiStoryController: ReturnType<typeof createMagiStoryController>;
let overcoatStoryController: ReturnType<typeof createOvercoatStoryController>;
let mapController: ReturnType<typeof createMapController>;
let loginController: ReturnType<typeof createLoginController>;
let statsPanelController: ReturnType<typeof createStatsPanelController>;
let playerController: ReturnType<typeof createPlayerController>, movementInputController: ReturnType<typeof createMovementInputController>;
let cameraController: ReturnType<typeof createCameraController>;
let progressionController: ReturnType<typeof createProgressionController>;
let buildingSceneController: ReturnType<typeof createBuildingSceneController>;
let buildingLabelController: ReturnType<typeof createBuildingLabelController>;
let communityPanels: ReturnType<typeof createCommunityPanelController>, writerCatalogController: WriterCatalogController, newsstandController: NewsstandController;
let multiplayerHousing: ReturnType<typeof createMultiplayerHousingController>;
let worldDecorations: ReturnType<typeof createWorldDecorations>;
let npcSystem: ReturnType<typeof createNpcSystem>;
let sceneInterestPoints: SceneInterestPoints | null = null;
let sceneInterestPointController: SceneInterestPointController | null = null;
let buildingDamageController: ReturnType<typeof createBuildingDamageController>;
let questEventSequence = 0, activeStoryActorIds = new Set<string>();
let echoActiveActors = new Set<string>();
let yesterdayActiveActors = new Set<string>();
let magiActiveActors = new Set<string>();
let overcoatActiveActors = new Set<string>();
function mergeActiveStoryActorIds() {
  activeStoryActorIds = new Set([...echoActiveActors, ...yesterdayActiveActors, ...magiActiveActors, ...overcoatActiveActors]);
  npcSystem?.updateNpcSchedules();
}
const questRuntime = new QuestRuntime(SIDE_QUESTS, new LocalStorageQuestJournalRepository());
let gameClock = townGameHour();
const residences: ResidenceEntity[] = [];

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
  announceGuide: () => {
    echoStoryController?.announceGuide();
    yesterdaySongController?.announceGuide();
    magiStoryController?.announceGuide();
    overcoatStoryController?.announceGuide();
  },
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
  getEchoStoryController: () => echoStoryController,
  getCityDialogs: () => cityDialogs,
  getConfig: () => CONFIG,
  isBuildingUnavailable,
  isResidenceUnavailable,
  findRaycastBuilding,
  raycastUserData,
  npcForRaycast,
  nearestNpcTo,
  openNpcDialog,
  openResidence,
  onYouClick,
  movePlayerTo,
  navigateTo,
  interactWithSceneInterestPoint,
  interactWithInterestPointController: (id) => sceneInterestPointController?.interact(id),
});

const interactionTracker = createInteractionTracker({
  getStats,
  saveStats,
  checkAchievements,
  updateWelcome,
  getProgressionController: () => progressionController,
  getQuestRuntime: () => questRuntime,
  getEchoStoryController: () => echoStoryController,
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
  getMultiplayerHousing: () => multiplayerHousing,
  getSceneInterestPoints: () => sceneInterestPoints,
  getSceneInterestPointController: () => sceneInterestPointController,
  getMapController: () => mapController,
  getBurnOverlay: () => burnCityEffect,
  getCursorChar: () => cursorChar,
  getCityDialogs: () => cityDialogs,
  getBeachEncounterActive: () => Boolean(cityDialogs?.isOpen()),
  getLastFrameTime: () => lastFrameTime,
  setLastFrameTime: (value) => { lastFrameTime = value; },
  npcYieldToPlayer,
  isStoryLockedBuilding,
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

const buildingInteraction = createBuildingInteraction({
  isBuildingUnavailable,
  getMultiplayerHousing: () => multiplayerHousing,
  getCityDialogs: () => cityDialogs,
  getEchoStoryController: () => echoStoryController,
  getYesterdayStoryController: () => yesterdaySongController,
  getMagiStoryController: () => magiStoryController,
  getOvercoatStoryController: () => overcoatStoryController,
  getStatsPanelController: () => statsPanelController,
  getCommunityPanels: () => communityPanels,
  getWriterCatalogController: () => writerCatalogController,
  getNewsstandController: () => newsstandController,
  trackInteraction,
  getWildMushroomRestaurant: () => wildMushroomRestaurant,
});

const eventBindings = createEventBindings({
  getCanvas: () => document.getElementById('c') as HTMLElement,
  getSignal: () => eventController.signal,
  getRenderer: () => renderer,
  onMouseMove,
  onCanvasClick,
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
  toggleMapMode,
  closeModal: () => buildingInteraction.closeModal(),
  closeNpcDialog,
  getLoginController: () => loginController,
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
  setupRenderer();
  cameraController = createCameraController({
    getCamera: () => camera,
    getZoom: () => cameraZoom,
    getTarget: () => cameraTarget,
    isEchoInterior: () => Boolean(echoStoryController?.isInteriorView()),
    echoInterior: ECHO_OBSERVATORY_AREA.interior,
    cameraOffset: CAMERA_OFFSET,
  });
  setupCamera(); proceduralTextures.initialize(); setupScene(); setupLighting();
  worldDecorations = createWorldDecorations({
    scene, resources, palette: P, roadCoords: ROAD_COORDS, cityLimit: CITY_LIMIT,
    buildings, residences, pathMaterials: pathMats, lampMaterials: lampGlobes,
    getIsNight: () => isNight, makeMaterial: stdMat, makeMesh: mk, addPart: part,
    addRaycastGroup: (group) => raycastBuildingGroups.push(group),
    addObstacleGroup: (group) => roadNavigation.registerObstacleGroup(group),
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
    updateCameraProjection, getActiveStoryActorIds: () => activeStoryActorIds,
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
  addFountain();
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
  sceneInterestPoints = createSceneInterestPoints({ scene, makeMaterial: stdMat, makeMesh: mk });
  addRealBuildingModels(scene, buildings)
    .then(() => { cacheBuildingBoxes(); buildingDamageController?.applyPersisted(); })
    .catch(error => console.error('3D model loading failed', error));
  buildingLabelController = createBuildingLabelController({ getBuildings: () => buildings, isStoryLocked: isBuildingUnavailable, interact: interactOrWalk });
  buildingLabelController.addLabels(); buildingLabelController.applyRenames(); applyStoryLockedBuildings();
  communityPanels = createCommunityPanelController({ setPhoneOpen, showUnlockToast });
  writerCatalogController = createWriterCatalogController({ document });
  newsstandController = createNewsstandController({ document, signal: eventController.signal });
  multiplayerHousing = createMultiplayerHousingController({
    scene, signal: eventController.signal, residences, getCursorChar: () => cursorChar,
    makeCharacter, showLoginEntry, showLoginOverlay, showUnlockToast, movePlayerTo, pointInAnyBuilding,
    fountainClear: FOUNTAIN_CLEAR, getMapIconsBuilt: () => Boolean(mapController?.areIconsBuilt()),
    mapShotSpan: 48, getMapMode: () => Boolean(mapController?.isOpen()), toggleMapMode, communityPanels,
    isResidenceUnavailable,
    getLegacyAchievements: () => getStats().achievements || [],
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
  echoStoryController = createEchoStoryController({
    document,
    getQuestContext: () => ({ ...getQuestProgressView(), gameDay: townGameDay() }),
    consumeItem: (itemId, quantity) => { void multiplayerHousing?.progression.consumeItem(itemId, quantity); },
    setStoryPoints: (ids) => sceneInterestPoints?.setActiveStoryPoints(ids as readonly SceneInterestPointId[]),
    setActiveActors: (ids) => { echoActiveActors = new Set(ids); mergeActiveStoryActorIds(); },
    updateNpcSchedules: () => npcSystem?.updateNpcSchedules(),
    awardAchievement: (id, name) => progressionController?.awardDirectAchievement(id, name),
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
  });
  echoStoryController.setupScene(scene);
  echoStoryController.setupGuide();
  echoStoryController.restoreAchievements();
  // ── 昨日之歌 · 支线剧情 ──────────────────────────────────────
  yesterdaySongController = createYesterdaySongController({
    awardAchievement: awardDirectAchievement,
    showToast: showUnlockToast,
    getQuestContext: () => ({ ...getQuestProgressView(), gameDay: townGameDay() }),
    onActiveActorsChanged: (ids) => { yesterdayActiveActors = new Set(ids); mergeActiveStoryActorIds(); },
  });
  yesterdaySongController.announceGuide();
  yesterdaySongController.syncActiveActors();
  // ── 麦琪的礼物 · 支线剧情 ──────────────────────────────────────
  magiStoryController = createMagiStoryController({
    awardAchievement: awardDirectAchievement,
    showToast: showUnlockToast,
    getQuestContext: () => ({ ...getQuestProgressView(), gameDay: townGameDay() }),
    onActiveActorsChanged: (ids) => { magiActiveActors = new Set(ids); mergeActiveStoryActorIds(); },
  });
  magiStoryController.announceGuide();
  magiStoryController.syncActiveActors();
  // ── 今晚别走那条街 · 支线剧情 ──────────────────────────────────
  overcoatStoryController = createOvercoatStoryController({
    awardAchievement: awardDirectAchievement,
    showToast: showUnlockToast,
    getQuestContext: () => ({ ...getQuestProgressView(), gameDay: townGameDay() }),
    onActiveActorsChanged: (ids) => { overcoatActiveActors = new Set(ids); mergeActiveStoryActorIds(); },
  });
  overcoatStoryController.announceGuide();
  overcoatStoryController.syncActiveActors();
  mapController = createMapController({
    document,
    getScene: () => scene,
    getBuildings: () => buildings,
    getCursor: () => cursorChar,
    getStats,
    getCamera: () => camera,
    getBuildingContent: (buildingId) => BUILDING_CONTENT[buildingId],
    isStoryLocked: isBuildingUnavailable,
    getBuildingRoadEntry: (position) => roadNavigation.buildingRoadEntry(position),
    setCameraTarget,
    movePlayerTo,
    clearPlayerPath: () => { playerPath = []; },
    renderMapHouseTags,
    openResidence: () => undefined,
  });
  mapController.setup(eventController.signal);
  movementInputController=createMovementInputController({document,window,signal:eventController.signal,onManualStart:()=>{playerPath=[];interactionPointer.clearPending();}});
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
    getEcho: () => echoStoryController,
    echoInterior: ECHO_OBSERVATORY_AREA.interior,
    onIdle: handlePlayerIdle,
    sendPosition: (cursor) => multiplayerHousing?.sendLocalPosition({ x: cursor.position.x, y: cursor.position.y, z: cursor.position.z, rotation: cursor.rotation.y }, performance.now()),
    addDistance: flushDistance,
    getManualMovement: () => movementInputController?.getMovement() ?? { x: 0, z: 0 },
    resolveMovement: (from, target, result) => roadNavigation.resolveMovement(from, target, result),
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
    },
    pauseNpcs,
    resumeNpcs,
    showToast: showUnlockToast,
    musicHallLyrics: MUSIC_HALL_LYRICS,
    memorialRoster: MEMORIAL_ROSTER,
    signal: eventController.signal,
  });
  cityDialogs.setup();
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
    interactWithStory: (id) => cityDialogs ? echoStoryController.interactInterestPoint(id, cityDialogs) : false,
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
  const canvas = document.getElementById('c') as HTMLCanvasElement;
  renderer = createRenderer(canvas);
}
function setupCamera() {
  cameraZoom=CONFIG.cameraNearSize;
  const vs = cameraZoom;
  camera = new THREE.OrthographicCamera(-vs,vs,vs,-vs,0.1,120);
  updateCameraProjection(vs);
  setCameraTarget(0,0,true);
}
function setupScene() {
  scene = new THREE.Scene();
  scene.background = isNight ? TEX.skyNight : TEX.skyDay;
  if (!scene.background) scene.background = new THREE.Color(isNight ? P.NIGHT_BG : P.DAY_BG);
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
    isBuildingUnavailable,
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
  });
}
function setupLighting() { addCityLighting(scene, MOBILE, isNight); }
function addFountain() { addCityFountain({ scene, palette: P, part }); }

const buildingMeshFactory = createBuildingMeshFactory({
  palette: P,
  platformHeight: PLH,
  makeMaterial: stdMat,
  makeMesh: mk,
  addPart: part,
});

const PLOT_MAP = BUILDING_PLOT_MAP;
const SHAPE_FNS = buildingMeshFactory.builders;

function addDecorations() { worldDecorations.addDecorations(); }
function addTrees(positions: readonly (readonly [number, number, number])[]) { worldDecorations.addTrees(positions); }
function addLamps(positions: readonly (readonly [number, number, number])[]) { worldDecorations.addLamps(positions); }
function addArch(x: number, y: number, z: number, rotY: number) { worldDecorations.addArch(x, y, z, rotY); }
function addBench(x: number, y: number, z: number, rotY: number) { worldDecorations.addBench(x, y, z, rotY); }

function makeCharacter(headHex: number, bodyHex: number) { return npcSystem.makeCharacter(headHex, bodyHex); }
function addCharacters() { npcSystem.addCharacters(); }
function onYouClick() { npcSystem.onYouClick(); }
function updateNpcSchedules() { npcSystem.updateNpcSchedules(); }
function npcYieldToPlayer(npc: Npc) { npcSystem.npcYieldToPlayer(npc); }
function pauseNpcs() { npcSystem.pauseNpcs(); }
function resumeNpcs() { npcSystem.resumeNpcs(); }
function nearestNpcTo(position: THREE.Vector3, radius: number) { return npcSystem.nearestNpcTo(position, radius); }
function npcForRaycast() { return npcSystem.npcForRaycast(); }

function setupEvents() { eventBindings.setupEvents(); }

function isStoryLockedBuilding(building: BuildingEntity) { return STORY_LOCKED_BUILDINGS.has(building.id); }

function isBuildingUnavailable(building: BuildingEntity) {
  return isStoryLockedBuilding(building) || isBuildingDestroyed(building);
}

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

function isResidenceUnavailable(residenceId: string): boolean {
  const residence = residences.find((item) => item.id === residenceId);
  return !residence || isBuildingDestroyed(residence);
}

function applyStoryLockedBuildings() { applyStoryLockedBuildingPresentation(buildings.filter(isStoryLockedBuilding)); }

function onMouseMove(e: MouseEvent) { interactionPointer.onMouseMove(e); }

function setupMultiplayerUI() { multiplayerHousing.setupUI(); }
function setupMultiplayer(nickname: string, password?: string) { multiplayerHousing.connect(nickname, password); }
function showLoginEntry() { loginController?.showLoginEntry(); }
function showLoginOverlay() { loginController?.showLogin(); }
function updateRemotePlayers(delta: number) { multiplayerHousing.updateRemotePlayers(delta); }
function setPhoneOpen(open: boolean) { multiplayerHousing?.setPhoneOpen(open); }
function renderMapHouseTags() { multiplayerHousing.renderMapHouseTags(); }
function openResidence(residenceId: string) { multiplayerHousing.openResidence(residenceId); }
function closeResidencePanel() { multiplayerHousing.closeResidencePanel(); }
function navigateToResidence(residenceId: string) { multiplayerHousing.navigateToResidence(residenceId); }
function raycastUserData(object: THREE.Object3D | null, key: string) { return multiplayerHousing.raycastUserData(object, key); }
function findRaycastBuilding(hits: readonly THREE.Intersection[]) { return findBuildingFromRaycastHits({ hits, buildings, readUserData: raycastUserData, isUnavailable: isBuildingUnavailable }); }
function onCanvasClick(event: MouseEvent) { interactionPointer.onCanvasClick(event); }

function talkToOrWalk(npc: Npc) { interactionPointer.talkToOrWalk(npc); }

function interactOrWalk(b: BuildingEntity) { interactionPointer.interactOrWalk(b); }

function navigateTo(b: BuildingEntity) { buildingInteraction.navigateTo(b); }
function openModal(building: BuildingEntity) { buildingInteraction.openModal(building); }
function closeModal() { buildingInteraction.closeModal(); }

function interactWithSceneInterestPoint(id: SceneInterestPointId) { interactionPointer.interactWithSceneInterestPoint(id); }

function applyTheme(night: boolean, instant?: boolean) { themeClock.applyTheme(night, instant); }
function syncTimeAndTheme() { themeClock.syncTimeAndTheme(); }

function entranceAnimation() { sceneAnimations.entranceAnimation(); }
function initAnimations() { sceneAnimations.initAnimations(); }
function updateLabels() { frameLoop.updateLabels(); }

function toggleMapMode() {
  mapController?.toggle();
}

function updateCameraProjection(vs: number) {
  cameraController?.updateProjection(vs);
}

function setCameraTarget(x: number, z: number, instant?: boolean) { cameraController?.setTarget(x,z,instant); }

function movePlayerTo(target: THREE.Vector3) { playerController?.moveTo(target); }

function handlePlayerIdle() { interactionPointer.handlePlayerIdle(); }

function flushDistance(amount: number) { interactionTracker.flushDistance(amount); }

// ══════════════════════════════════════════════════════════════════════════════
// STATS / PROGRESSION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

function trackInteraction(buildingId: string) { interactionTracker.trackInteraction(buildingId); }

function updateWelcome() {
  // Cloud progression owns the unique-building threshold and inventory entry.
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════

function proceedToCity(nickname = localStorage.getItem('minicityUser') || 'visitor', password?: string) {
  entranceAnimation();
  if(cursorChar){ cursorChar.visible=true; }
  trackingInterval=startTimeTracking();
  localStorage.removeItem('minicityPassword');
  setupMultiplayer(nickname, password);
  checkAchievements();
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS PANEL
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// POPULATION FILTER
// ══════════════════════════════════════════════════════════════════════════════

function setupFilter() {
  document.querySelectorAll('.pf-btn').forEach(btn=>{
    btn.addEventListener('click',()=>setFilter((btn as HTMLElement).dataset.filter ?? ''));
  });
}

function setFilter(filter: string) {
  currentFilter=filter;
  document.querySelectorAll('.pf-btn').forEach(b=>b.classList.toggle('active',(b as HTMLElement).dataset.filter===filter));
  updateNpcSchedules();
  if(filter==='friends'){
    showUnlockToast('no friends online yet — invite someone!');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL SYSTEM — ancient paper dialog
// ══════════════════════════════════════════════════════════════════════════════

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
  if (cityDialogs && echoStoryController?.interactNpc(npc.profile.id, cityDialogs)) {
    recordNpcInteraction(npc.profile.id);
    return;
  }
  if (cityDialogs && yesterdaySongController?.interactNpc(npc.profile.id, cityDialogs)) {
    recordNpcInteraction(npc.profile.id);
    return;
  }
  if (cityDialogs && magiStoryController?.interactNpc(npc.profile.id, cityDialogs)) {
    recordNpcInteraction(npc.profile.id);
    return;
  }
  if (cityDialogs && overcoatStoryController?.interactNpc(npc.profile.id, cityDialogs)) {
    recordNpcInteraction(npc.profile.id);
    return;
  }
  cityDialogs?.openNpc(npc as NpcEntityLike, cursorChar ? { x: cursorChar.position.x, z: cursorChar.position.z } : undefined);
}
function closeNpcDialog() { cityDialogs?.closeNpc(); }

export function startMiniCity() {
  if(started)return;
  started=true;
  eventController=new AbortController();
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
  init();
}

export function destroyMiniCity() {
  if(!started)return;
  started=false;
  frameLoop.stop();
  clearInterval(clockInterval);
  clearInterval(trackingInterval);
  multiplayerHousing?.destroy();
  destroyCG();
  stopInvasionCG();
  eventController.abort();
  npcList.forEach(npc=>npc.tween?.kill());
  npcSystem?.destroy();
  gsap.globalTimeline.clear();
  mapController?.destroy();
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
  echoStoryController?.dispose();
  yesterdaySongController?.dispose();
  magiStoryController?.dispose();
  overcoatStoryController?.dispose();
}
