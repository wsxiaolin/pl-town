import * as THREE from 'three';
import { ResourcePool } from '../core/ResourcePool';
import { CAMERA_OFFSET, CITY_CONFIG, CITY_LIMIT, ECHO_OBSERVATORY_AREA, ROAD_COORDS, WEST_BEACH } from './data/cityConfig';
import { BUILDING_DEFS, BUILDING_CONTENT } from './data/buildings';
import { MUSIC_HALL_LYRICS } from './data/musicHallLyrics';
import { MEMORIAL_ROSTER } from './data/memorialRoster';
import { NPC_PROFILES } from './data/npcs';
import { shouldShowCG, startCG } from './cg';
import { startInvasionCG, stopInvasionCG } from './invasionCg';
import { SIDE_QUESTS } from '../gameplay/content/quests/sideQuests';
import { LocalStorageQuestJournalRepository } from '../adapters/storage/LocalStorageQuestJournalRepository';
import { QuestRuntime } from '../gameplay/quests/QuestRuntime';
import { createCityDialogController, type CityDialogController, type NpcEntityLike } from '../adapters/ui/cityDialogController';
import { createMultiplayerHousingController } from '../adapters/ui/multiplayerHousingController';
import type { BuildingEntity, ResidenceEntity } from './buildingEntity';
import type { SceneInterestPoints } from '../rendering/sceneInterestPoints';
import type { SceneInterestPointController } from './sceneInterestPointController';
import { calcLevel, formatDate, formatTime, getStats, getUserId, saveStats, startTimeTracking } from './progression/legacyStats';
import { createRoadNavigationSystem } from './navigation/roadNavigation';
import type { Npc } from './npcSystem';
import type { SceneInterestPointId } from '../rendering/sceneInterestPoints';
import { createSceneInterestPointController } from './sceneInterestPointController';
import { createMapController } from './mapController';
import { createPlayerController } from './navigation/playerController';
import { createMovementInputController } from './navigation/movementInputController';
import { createCameraController } from './navigation/cameraController';
import { createCameraPanController } from './navigation/cameraPanController';
import { createProgressionController } from './progression/progressionController';
import { findBuildingFromRaycastHits } from './buildingRaycast';
import { createBuildingDamageController } from './buildingDamageController';
import { createLoginController } from '../adapters/ui/loginController';
import { createOnboardingTutorialController } from '../adapters/ui/onboardingTutorialController';
import { createStatsPanelController } from '../adapters/ui/statsPanelController';
import { townGameDay, townGameHour } from '../gameplay/time/townClock';
import { ACHIEVEMENTS, createUnlockTiers } from './progression/achievements';
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
import { createIceKingFeatureExperience } from './iceKing/createIceKingFeatureExperience';
import { createIceKingBuildingFeature } from './iceKing/createIceKingBuildingFeature';
import { createBuildingFeatureRegistry } from './buildingFeatures/buildingFeatureRegistry';
import { createWeatherEffect } from '../rendering/weatherEffect';
import { createNavigationTargetMarker } from '../rendering/navigationTargetMarker';
import { createBuildingAvailability, storyLockedBuildingIds } from './buildingAvailability';
import { addCityLighting, createCityOrthographicCamera, createCityScene, createCityWebRenderer } from './citySceneBootstrap';
import { createStoryOrchestration, routeNpcDialog, type StoryOrchestration } from './storyOrchestration';
import { createCityGraphics } from './cityGraphics';
import { createCityViewControls } from './cityViewControls';
import { createNpcDistrictFilter } from './npcDistrictFilter';
import { createIceKingCityHooks } from './iceKingCityHooks';
import { createCityThemeSync } from './cityThemeSync';
import { readQuestProgressView } from './cityQuestProgress';
import { assembleCityWorld } from './cityWorldAssembly';
import { createCityHudPanels, type CityHudPanels } from './cityHudPanels';
import { createCityRuntimeLifecycle } from './cityRuntimeLifecycle';

const resources = new ResourcePool();
const MOBILE = () => window.innerWidth <= 680;
const REDUCED = false;
const CONFIG = CITY_CONFIG;
let renderer: THREE.WebGLRenderer;
const graphics = createCityGraphics(resources, () => renderer);
const { palette: P, textures: proceduralTextures, mesh: { stdMat } } = graphics;

let clockInterval = 0, trackingInterval = 0;
let raycastBuildingGroups: THREE.Object3D[] = [];
const buildingPlotTargets: THREE.Object3D[] = [];
const labelWorldPosition = new THREE.Vector3();
let scene: THREE.Scene, camera: THREE.OrthographicCamera;
const pathMats: THREE.MeshStandardMaterial[] = [];
const groundMats: { mat: THREE.MeshStandardMaterial; night: number; day: number }[] = [];
const lampGlobes: THREE.MeshStandardMaterial[] = [];
const buildings: BuildingEntity[] = [];
const npcList: Npc[] = [];
let cursorChar: THREE.Group | null = null;
let playerMarker: THREE.Group | null = null;
let lastFrameTime = performance.now();
let isNight = false;
const residences: ResidenceEntity[] = [];
const availability = createBuildingAvailability({
  storyLockedIds: storyLockedBuildingIds(BUILDING_DEFS),
  getResidences: () => residences,
});
let cityDialogs: CityDialogController | null = null;
let stories: StoryOrchestration;
let mapController: ReturnType<typeof createMapController>;
let loginController: ReturnType<typeof createLoginController>;
let onboardingTutorial: ReturnType<typeof createOnboardingTutorialController>;
let statsPanelController: ReturnType<typeof createStatsPanelController>;
let playerController: ReturnType<typeof createPlayerController>;
let movementInputController: ReturnType<typeof createMovementInputController>;
let cameraController: ReturnType<typeof createCameraController>;
let cameraPanController: ReturnType<typeof createCameraPanController>;
let progressionController: ReturnType<typeof createProgressionController>;
let communityPanels: CityHudPanels['communityPanels'];
let writerCatalogController: CityHudPanels['writerCatalog'];
let newsstandController: CityHudPanels['newsstand'];
let academyController: CityHudPanels['academy'];
let multiplayerHousing: ReturnType<typeof createMultiplayerHousingController>;
let worldDecorations: ReturnType<typeof assembleCityWorld>['worldDecorations'];
let npcSystem: ReturnType<typeof assembleCityWorld>['npcSystem'];
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
const mouse2D = new THREE.Vector2(-9999, -9999);
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorWorld = new THREE.Vector3();

const view = createCityViewControls({
  defaultZoom: CONFIG.cameraNearSize,
  createCamera: createCityOrthographicCamera,
  getCameraController: () => cameraController,
  getPlayerController: () => playerController,
  getNavigationTargetMarker: () => navigationTargetMarker,
});
const districtFilter = createNpcDistrictFilter({
  queryButtons: () => document.querySelectorAll('.pf-btn') as NodeListOf<HTMLElement>,
  onChange: () => npcSystem?.updateNpcSchedules(),
  showToast: showUnlockToast,
});

const themeClock = createThemeClock({
  getSkyTextures: () => proceduralTextures.backgrounds,
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

const themeSync = createCityThemeSync({
  applyClock: (night, instant) => themeClock.applyTheme(night, instant),
  syncClock: () => themeClock.syncTimeAndTheme(),
  setWaterDaylight: (daylight, instant) => {
    sceneInterestPoints?.setWaterDaylight(daylight, instant);
    worldDecorations?.setWaterDaylight(daylight, instant);
  },
  refreshWeatherVisual: () => weatherEffect?.set(graphics.weather.get()),
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
  raycastUserData: (object, key) => multiplayerHousing.raycastUserData(object, key),
  npcForRaycast: () => npcSystem.npcForRaycast(),
  nearestNpcTo: (position, radius) => npcSystem.nearestNpcTo(position, radius),
  openNpcDialog,
  openResidence: (residenceId) => multiplayerHousing.openResidence(residenceId),
  onYouClick: () => npcSystem.onYouClick(),
  movePlayerTo: (target) => playerController?.moveTo(target),
  selectNavigationTarget: (target) => view.selectNavigationTarget(target),
  clearNavigationTarget: () => view.clearNavigationTarget(),
  navigateTo: (building) => buildingInteraction.navigateTo(building),
  interactWithSceneInterestPoint: () => undefined,
  interactWithInterestPointController: (id) => sceneInterestPointController?.interact(id),
  getSpecialInterior: () => iceKingFeature?.sanctum.isActive() ? iceKingFeature.sanctum : null,
});

const interactionTracker = createInteractionTracker({
  getStats,
  saveStats,
  checkAchievements,
  updateWelcome: () => {},
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
  npcYieldToPlayer: (npc) => npcSystem.npcYieldToPlayer(npc),
  isStoryLockedBuilding: availability.isStoryLocked,
});

const roadNavigation = createRoadNavigationSystem({
  roadCoords: ROAD_COORDS,
  echoObservatoryArea: ECHO_OBSERVATORY_AREA,
  westBeach: WEST_BEACH,
  cityLimit: CITY_LIMIT,
  getBuildings: () => buildings,
});

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
  getCameraSnapshot: () => view.snapshot(),
  playShots: (shots, onComplete) => cameraController?.playSequence(shots, onComplete),
  stopShots: () => cameraController?.stop(),
  restoreCamera: (snapshot) => view.restoreSnapshot(snapshot),
  setCinematicActive: (active) => {
    view.setCinematic(active);
    movementInputController?.setLocked(active);
  },
  clearPlayerPath: () => view.clearPlayerPath(),
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
  trackInteraction: (buildingId) => interactionTracker.trackInteraction(buildingId),
  getWildMushroomRestaurant: () => wildMushroomRestaurant,
  getFilmCityController: () => filmCityExperience,
  interactWithFeature: buildingFeatureRegistry.interact,
});

const eventBindings = createEventBindings({
  getCanvas: () => document.getElementById('c') as HTMLElement,
  getSignal: () => lifecycle.signal,
  getRenderer: () => renderer,
  onMouseMove: (event) => interactionPointer.onMouseMove(event),
  onCanvasClick: (event) => interactionPointer.onCanvasClick(event),
  consumeSuppressedCanvasClick: () => cameraPanController?.consumeSuppressedClick() ?? false,
  onViewInteraction: () => cameraPanController?.notifyViewInteraction(),
  clamp: roadNavigation.clamp,
  getCameraZoom: () => view.getZoom(),
  setCameraZoom: (value) => view.setZoom(value),
  updateCameraProjection: (zoom) => view.updateProjection(zoom),
  getConfig: () => CONFIG,
  onYouClick: () => npcSystem.onYouClick(),
  closeRenderSettings: () => eventBindings.closeRenderSettings(),
  getStatsPanelController: () => statsPanelController,
  getCommunityPanels: () => communityPanels,
  getMapController: () => mapController,
  getWriterCatalogController: () => writerCatalogController,
  getAcademyController: () => academyController,
  toggleMapMode: () => mapController?.toggle(),
  closeModal: () => buildingInteraction.closeModal(),
  closeNpcDialog: () => cityDialogs?.closeNpc(),
  getLoginController: () => loginController,
  isMovementOnlyMode: () => Boolean(iceKingFeature?.sanctum.isActive()),
});

let UNLOCK_TIERS = createUnlockTiers(
  (positions) => worldDecorations?.addLamps(positions),
  (positions) => worldDecorations?.addTrees(positions),
  (x, y, z, rotY) => worldDecorations?.addArch(x, y, z, rotY),
  (x, y, z, rotY) => worldDecorations?.addBench(x, y, z, rotY),
);

function awardDirectAchievement(id: string, name: string) { progressionController?.awardDirectAchievement(id, name); }
function checkAchievements() { progressionController?.checkAchievements(); }
function findRaycastBuilding(hits: readonly THREE.Intersection[]) {
  return findBuildingFromRaycastHits({ hits, buildings, readUserData: (object, key) => multiplayerHousing.raycastUserData(object, key), isUnavailable: availability.isBuildingUnavailable });
}
function openNpcDialog(npc: Npc) {
  routeNpcDialog(
    stories.router,
    cityDialogs,
    npc.profile.id,
    () => cityDialogs?.openNpc(npc as NpcEntityLike, cursorChar ? { x: cursorChar.position.x, z: cursorChar.position.z } : undefined),
    () => interactionTracker.recordNpcInteraction(npc.profile.id),
  );
}

function init() {
  graphics.weather.set(graphics.weather.get());
  renderer = createCityWebRenderer();
  cameraController = createCameraController({
    getCamera: () => camera,
    getZoom: () => view.getZoom(),
    setZoom: (zoom) => view.setZoom(zoom),
    getTarget: () => view.cameraTarget,
    isInteriorActive: () => Boolean(stories?.echo.isInteriorView() || iceKingFeature?.sanctum.isActive()),
    defaultInteriorCenter: ECHO_OBSERVATORY_AREA.interior,
    getInteriorCenter: () => iceKingFeature?.sanctum.isActive() ? iceKingFeature.sanctum.center : ECHO_OBSERVATORY_AREA.interior,
    getInteriorCameraOffset: () => iceKingFeature?.sanctum.isActive() ? [13, 22, 17] : null,
    getInteriorFollowsTarget: () => Boolean(iceKingFeature?.sanctum.isActive()),
    cameraOffset: CAMERA_OFFSET,
  });
  camera = view.createCamera();
  view.applyInitialView();
  proceduralTextures.initialize();
  scene = createCityScene(isNight, proceduralTextures.backgrounds, P);
  installDebugApi({
    getScene: () => scene,
    getCamera: () => camera,
    getRenderer: () => renderer,
    getCameraZoom: () => view.getZoom(),
    getThree: () => THREE,
    getNpcList: () => npcList,
    getCursorChar: () => cursorChar,
    getNavigation: () => roadNavigation,
    getPlayerPath: () => view.getPlayerPath(),
    getBuildings: () => buildings,
    getResidences: () => residences,
    openNpcDialog,
    navigateTo: (building) => buildingInteraction.navigateTo(building),
    isBuildingUnavailable: availability.isBuildingUnavailable,
    destroyBuilding,
    destroyResidence,
    destroyAll,
    restoreBuilding,
    restoreResidence,
    restoreAll,
    openModal: (building) => buildingInteraction.openModal(building),
    interactWithSceneInterestPoint: (id) => interactionPointer.interactWithSceneInterestPoint(id),
    getSceneInterestPoints: () => sceneInterestPoints,
    burnCity: () => burnCityEffect.trigger(),
    burnCityActive: () => burnCityEffect.isActive(),
    burnCityProgress: () => burnCityEffect.getProgress(),
    playInvasionCG: startInvasionCG,
    stopInvasionCG,
    getWeather: () => graphics.weather.get(),
    setWeather: (value) => graphics.weather.set(value),
    getIceSanctum: () => iceKingFeature?.sanctum ?? null,
    getTutorial: () => onboardingTutorial,
  });
  addCityLighting(scene, MOBILE, isNight);
  navigationTargetMarker = createNavigationTargetMarker(scene);
  window.addEventListener('minicity:textures-ready', () => graphics.refreshWeatherLooks(), { once: true, signal: lifecycle.signal });
  const world = assembleCityWorld({
    scene,
    resources,
    graphics,
    reduced: REDUCED,
    isMobile: MOBILE,
    isNight,
    getIsNight: () => isNight,
    roadNavigation,
    buildings,
    residences,
    pathMats,
    groundMats,
    lampGlobes,
    buildingPlotTargets,
    npcList,
    actors: {
      get cursorChar() { return cursorChar; },
      set cursorChar(value) { cursorChar = value; },
      get playerMarker() { return playerMarker; },
      set playerMarker(value) { playerMarker = value; },
    },
    raycaster,
    getGameClock: () => gameClock,
    getCurrentFilter: () => districtFilter.get(),
    getCameraZoom: () => view.getZoom(),
    setCameraZoom: (zoom) => view.setZoom(zoom),
    updateCameraProjection: (zoom) => view.updateProjection(zoom),
    getMapMode: () => Boolean(mapController?.isOpen()),
    getDialogOpen: () => Boolean(cityDialogs?.isOpen()),
    getActiveStoryActorIds: () => stories?.getActiveStoryActorIds() ?? new Set(),
    isBuildingUnavailable: availability.isBuildingUnavailable,
    isStoryLocked: availability.isStoryLocked,
    interactOrWalk: (building) => interactionPointer.interactOrWalk(building),
    onModelsLoaded: () => buildingDamageController?.applyPersisted(),
  });
  worldDecorations = world.worldDecorations;
  npcSystem = world.npcSystem;
  sceneInterestPoints = world.sceneInterestPoints;
  raycastBuildingGroups = world.raycastBuildingGroups;
  const hud = createCityHudPanels(document, lifecycle.signal, (open) => multiplayerHousing?.setPhoneOpen(open));
  communityPanels = hud.communityPanels;
  writerCatalogController = hud.writerCatalog;
  newsstandController = hud.newsstand;
  academyController = hud.academy;
  multiplayerHousing = createMultiplayerHousingController({
    scene, signal: lifecycle.signal, residences, getCursorChar: () => cursorChar,
    makeCharacter: (head, body) => npcSystem.makeCharacter(head, body), showLoginEntry: () => loginController?.showLoginEntry(), showLoginOverlay: () => loginController?.showLogin(), showUnlockToast, movePlayerTo: (target) => playerController?.moveTo(target), pointInAnyBuilding: roadNavigation.pointInAnyBuilding,
    fountainClear: roadNavigation.fountainClear, getMapIconsBuilt: () => Boolean(mapController?.areIconsBuilt()),
    mapShotSpan: 48, getMapMode: () => Boolean(mapController?.isOpen()), toggleMapMode: () => mapController?.toggle(), communityPanels,
    isResidenceUnavailable: availability.isResidenceUnavailable,
    getLegacyAchievements: () => getStats().achievements || [],
    setWeather: (value) => graphics.weather.set(value),
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
      clearPlayerPath: () => view.clearPlayerPath(),
      setCameraTarget: (x, z, instant) => view.setTarget(x, z, instant),
      stopCameraTween: () => cameraController?.stop(),
      getCameraZoom: () => view.getZoom(),
      setCameraZoom: (zoom) => view.setZoom(zoom),
      updateCameraProjection: (zoom) => view.updateProjection(zoom),
      isMobile: MOBILE,
      getScene: () => scene,
      sendLocalPosition: (cursor) => multiplayerHousing?.sendLocalPosition({ x: cursor.position.x, y: 0, z: cursor.position.z, rotation: cursor.rotation.y }, performance.now()),
      goToObservatory: () => { cursorChar && view.setTarget(ECHO_OBSERVATORY_AREA.center[0], ECHO_OBSERVATORY_AREA.center[1], false); },
    },
    getQuestContext: () => ({ ...readQuestProgressView(multiplayerHousing), gameDay: townGameDay() }),
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
    setCameraTarget: (x, z, instant) => view.setTarget(x, z, instant),
    movePlayerTo: (target) => playerController?.moveTo(target),
    clearPlayerPath: () => view.clearPlayerPath(),
    renderMapHouseTags: () => multiplayerHousing.renderMapHouseTags(),
    openResidence: () => undefined,
  });
  mapController.setup(lifecycle.signal);
  movementInputController = createMovementInputController({
    document, window, signal: lifecycle.signal,
    onManualStart: () => { view.clearPlayerPath(); interactionPointer.clearPending(); view.clearNavigationTarget(); },
  });
  cameraPanController = createCameraPanController({
    canvas: document.getElementById('c') as HTMLElement, document, window, signal: lifecycle.signal,
    getCamera: () => camera, getCameraTarget: () => view.cameraTarget,
    getPlayerPosition: () => cursorChar?.position ?? null, cityLimit: CITY_LIMIT,
    setCameraTarget: (x, z, instant) => view.setTarget(x, z, instant), stopCameraMotion: () => cameraController?.stop(),
    isBlocked: () => view.isCinematic() || Boolean(mapController?.isOpen())
      || Boolean(cityDialogs?.isOpen()) || Boolean(stories?.echo.isInteriorView()),
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filmCityExperience.isActive()) filmCityExperience.stop();
  }, { signal: lifecycle.signal });
  playerController = createPlayerController({
    getCursor: () => cursorChar,
    getCamera: () => camera,
    getCameraTarget: () => view.cameraTarget,
    setCameraTarget: (x, z, instant) => view.setTarget(x, z, instant),
    getPlayerPath: () => view.getPlayerPath(),
    setPlayerPath: (path) => view.setPlayerPath(path),
    isDialogOpen: () => Boolean(cityDialogs?.isOpen()),
    isMapOpen: () => Boolean(mapController?.isOpen()),
    buildRoadPath: roadNavigation.buildRoadPath,
    clamp: roadNavigation.clamp,
    playerSpeed: CONFIG.playerSpeed,
    getNpcs: () => npcList,
    getEcho: () => stories?.echo,
    getSpecialInterior: () => iceKingFeature?.sanctum.isActive() ? iceKingFeature.sanctum : null,
    echoInterior: ECHO_OBSERVATORY_AREA.interior,
    onIdle: () => interactionPointer.handlePlayerIdle(),
    sendPosition: (cursor) => multiplayerHousing?.sendLocalPosition({ x: cursor.position.x, y: cursor.position.y, z: cursor.position.z, rotation: cursor.rotation.y }, performance.now()),
    addDistance: (amount) => interactionTracker.flushDistance(amount),
    getManualMovement: () => movementInputController?.getMovement() ?? { x: 0, z: 0 },
    resolveMovement: (from, target, result) => roadNavigation.resolveMovement(from, target, result),
    isInputLocked: () => view.isCinematic(),
    isCinematicCameraActive: () => view.isCinematic(),
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
  onboardingTutorial = createOnboardingTutorialController({ document, signal: lifecycle.signal });
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
  cityDialogs = createCityDialogController({
    document,
    buildingContent: BUILDING_CONTENT,
    getQuestAction: (npcId) => questRuntime.getNpcAction(npcId, readQuestProgressView(multiplayerHousing)),
    performQuestAction: (action, at) => questRuntime.performNpcAction(action, at),
    onNpcInteracted: (npcId) => interactionTracker.recordNpcInteraction(npcId),
    onDialogueAction: (action) => {
      if (action.startsWith('teleport:')) mapController?.teleportToBuilding(action.slice(9));
      if (action.startsWith('open-url:')) window.location.href = action.slice(9);
      buildingFeatureRegistry.handleDialogueAction(action, 'city-dialog');
    },
    pauseNpcs: () => npcSystem.pauseNpcs(),
    resumeNpcs: () => npcSystem.resumeNpcs(),
    showToast: showUnlockToast,
    musicHallLyrics: MUSIC_HALL_LYRICS,
    memorialRoster: MEMORIAL_ROSTER,
    signal: lifecycle.signal,
  });
  cityDialogs.setup();
  weatherEffect = createWeatherEffect({
    scene,
    getCursor: () => cursorChar,
    restoreSky: () => themeClock.restoreSky(),
    onWeatherChanged: (next) => {
      if (next) document.body.dataset.cityWeather = next;
      else delete document.body.dataset.cityWeather;
    },
  });
  graphics.setWeatherVisual(weatherEffect);
  weatherEffect.set(graphics.weather.get());
  const iceHooks = createIceKingCityHooks({
    defaultZoom: CONFIG.cameraNearSize,
    wellZoom: 5.2,
    beachZoom: 5.5,
    iceZoom: (mobile) => (mobile ? 9.5 : 13.5),
    isMobile: MOBILE,
    canAdjustCamera: () => Boolean(camera),
    getZoom: () => view.getZoom(),
    setZoom: (zoom) => view.applyZoom(zoom),
    captureIceZoom: () => view.captureIceZoom(),
    restoreIceZoom: () => view.restoreIceZoom(),
    setWellVision: (phase) => {
      if (phase) document.body.dataset.wellVision = phase;
      else delete document.body.dataset.wellVision;
    },
    closeMapIfOpen: () => { if (mapController?.isOpen()) mapController.toggle(); },
    closeHud: () => {
      multiplayerHousing?.setPhoneOpen(false);
      statsPanelController?.close();
      eventBindings.closeRenderSettings();
    },
    clearTravel: () => { view.clearPlayerPath(); interactionPointer.clearPending(); },
    setWeather: (weather) => graphics.weather.set(weather),
    invalidateMap: () => mapController?.invalidateShot(),
    setCameraTarget: (x, z, instant) => view.setTarget(x, z, instant),
    focusCamera: (x, z) => cameraController?.focus(x, z),
    sendLocalPosition: (x, z, rotation) => multiplayerHousing?.sendLocalPosition({ x, y: 0, z, rotation }, performance.now()),
    getCursor: () => cursorChar,
    setWellPhaseVisual: (phase) => sceneInterestPoints?.setWellPhase(phase),
    setBeachEncounterPhase: (phase) => sceneInterestPoints?.setBeachEncounterPhase(phase),
  });
  iceKingFeature = createIceKingFeatureExperience({
    scene, makeCharacter: (head, body) => npcSystem.makeCharacter(head, body),
    makeMaterial: (parameters) => resources.material({ kind: 'ice-sanctum', ...parameters }, () => stdMat(parameters)),
    getCursor: () => cursorChar, dialogs: () => cityDialogs,
    progression: multiplayerHousing.progression,
    awardAchievement: awardDirectAchievement,
    showToast: showUnlockToast,
    onEnter: () => iceHooks.onEnter(),
    onReturn: (weather) => iceHooks.onReturn(weather),
    setCameraTarget: (x, z, instant) => cameraController?.setTarget(x, z, instant),
    focusCamera: (x, z, focusOptions) => cameraController?.focus(x, z, focusOptions),
    stopCameraFocus: () => cameraController?.stop(),
  });
  sceneInterestPointController = createSceneInterestPointController({
    dialogs: cityDialogs,
    inventory: {
      isOnline: () => multiplayerHousing.progression.isOnline(),
      hasItem: (itemId, count = 1) => multiplayerHousing.progression.isOnline()
        && (multiplayerHousing.progression.getProgress().inventory[itemId] ?? 0) >= count,
      consumeItem: (itemId, count) => multiplayerHousing.progression.consumeItem(itemId, count),
      claimReward: (rewardId) => multiplayerHousing.progression.claimReward(rewardId),
      hasAchievement: (achievementId) => multiplayerHousing.progression.getProgress().achievements.includes(achievementId),
    },
    awardAchievement: awardDirectAchievement,
    showToast: showUnlockToast,
    interactWithStory: (id) => cityDialogs ? stories.echo.interactInterestPoint(id, cityDialogs) : false,
    interactWithFeature: (id) => iceKingFeature?.iceWall.interact(id) ?? false,
    setWellPhase: (phase) => iceHooks.setWellPhase(phase),
    setBeachEncounterPhase: (phase) => iceHooks.setBeachEncounterPhase(phase),
    focusBeachEncounter: () => iceHooks.focusBeachEncounter(),
  });
  eventBindings.setupEvents();
  districtFilter.setup((button, onClick) => {
    (button as HTMLElement).addEventListener('click', onClick, { signal: lifecycle.signal });
  });
  themeSync.applyTheme(isNight, true);
  sceneAnimations.initAnimations();
  clockInterval = window.setInterval(themeSync.syncTimeAndTheme, 1000);
  themeSync.syncTimeAndTheme();
  document.getElementById('labelsWrap')?.classList.add('hidden');
  frameLoop.start();
  loginController.checkLogin();
  multiplayerHousing.setupUI();
}

function proceedToCity(nickname = localStorage.getItem('minicityUser') || 'visitor', password?: string) {
  sceneAnimations.entranceAnimation();
  if (cursorChar) cursorChar.visible = true;
  trackingInterval = startTimeTracking();
  localStorage.removeItem('minicityPassword');
  multiplayerHousing.connect(nickname, password);
  checkAchievements();
}

function disposeSession() {
  filmCityExperience.dispose();
  frameLoop.stop();
  clearInterval(clockInterval);
  clearInterval(trackingInterval);
  multiplayerHousing?.destroy();
  iceKingFeature?.dispose();
  weatherEffect?.dispose();
  iceKingFeature = null;
  weatherEffect = null;
  graphics.setWeatherVisual(null);
  npcList.forEach((npc) => npc.tween?.kill());
  npcSystem?.destroy();
  mapController?.destroy();
  navigationTargetMarker?.dispose();
  navigationTargetMarker = null;
  renderer?.dispose();
  renderer?.forceContextLoss();
  sceneInterestPoints?.dispose();
  scene?.clear();
  resources.dispose();
  buildingPlotTargets.length = 0;
  sceneInterestPoints = null;
  sceneInterestPointController = null;
  stories?.dispose();
}

const lifecycle = createCityRuntimeLifecycle({
  reduced: REDUCED,
  isNight: () => isNight,
  initCity: init,
  startTutorial: () => onboardingTutorial?.start(),
  proceedToCity,
  showLogin: () => loginController?.showLogin(),
  disposeSession,
});

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
export function startMiniCity() { lifecycle.start(); }
export function destroyMiniCity() { lifecycle.destroy(); }
