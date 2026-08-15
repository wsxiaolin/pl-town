// @ts-nocheck
import * as THREE from 'three';
import { gsap } from 'gsap';
import { ResourcePool } from '../core/ResourcePool';
import { InstancedBatch } from '../core/InstancedBatch';
import { createRenderer, readRenderSettings } from '../rendering/createRenderer';
import { createProceduralTextureLibrary } from '../rendering/proceduralTextureLibrary';
import { createBuildingMeshFactory } from '../rendering/buildingMeshFactory';
import { createWorldDecorations } from '../rendering/worldDecorations';
import { RENDER_ORDER, SURFACE_Y } from '../rendering/layers';
import { BUILDING_PLATFORM_HEIGHT, CAMERA_OFFSET, CITY_CONFIG, CITY_LIMIT, ECHO_OBSERVATORY_AREA, PALETTE, ROAD_COORDS } from './data/cityConfig';
import { BUILDING_DEFS, BUILDING_API_QUERIES, BUILDING_CONTENT } from './data/buildings';
import { NPC_PROFILES } from './data/npcs';
import { createCitySurfaces } from '../rendering/createCitySurfaces';
import { addRealBuildingModels } from '../rendering/realBuildingModels';
import { destroyCG, initCG, shouldShowCG, startCG } from './cg';
import { SIDE_QUESTS } from '../gameplay/content/quests/sideQuests';
import { LocalStorageQuestJournalRepository } from '../adapters/storage/LocalStorageQuestJournalRepository';
import { QuestRuntime } from '../gameplay/quests/QuestRuntime';
import { createCityDialogController, type CityDialogController, type NpcEntityLike } from '../adapters/ui/cityDialogController';
import { createCommunityPanelController } from '../adapters/ui/communityPanelController';
import { attachNpcChangePanel } from '../adapters/ui/npcChangePanelController';
import { createMultiplayerHousingController } from '../adapters/ui/multiplayerHousingController';
import { setupRenderSettingsController } from '../adapters/ui/renderSettingsController';
import { calcLevel, formatDate, formatTime, getStats, getUserId, saveStats, startTimeTracking } from './progression/legacyStats';
import { createRoadNavigationSystem } from './navigation/roadNavigation';
import { createNpcSystem } from './npcSystem';
import { createSceneInterestPoints } from '../rendering/sceneInterestPoints';
import { addEchoObservatoryArea } from '../rendering/echoObservatoryArea';
import { createSceneInterestPointController } from './sceneInterestPointController';
import { createEchoStoryController } from './echo/echoStoryController';
import { createMapController } from './mapController';
import { createPlayerController } from './navigation/playerController';
import { createMovementInputController } from './navigation/movementInputController';
import { createCameraController } from './navigation/cameraController';
import { createProgressionController } from './progression/progressionController';
import { updateCityLabels } from './labelController';
import { createBuildingSceneController } from './buildingSceneController';
import { findBuildingFromRaycastHits } from './buildingRaycast';
import { addCityFountain, addCityLighting } from './scenePresentationController';
import { bindCityUiEvents } from '../adapters/ui/cityEventBindings';
import { createBuildingLabelController } from '../adapters/ui/buildingLabelController';
import { applyStoryLockedBuildingPresentation } from './storyLockedBuildingPresentation';
import { createLoginController } from '../adapters/ui/loginController';
import { createStatsPanelController } from '../adapters/ui/statsPanelController';
import { townGameHour } from '../gameplay/time/townClock';
const resources = new ResourcePool();
let animationFrame = 0;
let clockInterval = 0;
let trackingInterval = 0;
let started = false;
let eventController = new AbortController();
let raycastBuildingGroups = [];
const buildingPlotTargets = [];
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

let renderer, scene, camera;
const pathMats = [], groundMats = [], lampGlobes = [], buildings = [], npcList = [];
let cursorChar = null;
let playerPath = [];
let pendingBuilding = null;
let playerMarker = null; // 玩家头顶的三角标记，用于高亮
let cameraZoom; // 当前视野宽度，由滚轮/双指缩放调整
let lastFrameTime = performance.now();
let isNight    = false; // 由社区时间自动决定
let hoveredB   = null, mouseOnScene = false;
const STORY_LOCKED_BUILDINGS = new Set(BUILDING_DEFS.filter((building) => building.storyLocked).map((building) => building.id));
let currentFilter = 'all';
const cameraTarget = new THREE.Vector3(0,0,0);
// The interior camera is kept above the roof line and inside the floor footprint.
// The roof is hidden while inside, so this avoids a near-wall/roof clip while
// still letting the camera look down into the complete room.
let cityDialogs: CityDialogController | null = null;
let echoStoryController;
let mapController;
let loginController;
let statsPanelController;
let playerController, movementInputController;
let cameraController;
let progressionController;
let buildingSceneController;
let buildingLabelController;
let communityPanels;
let multiplayerHousing;
let worldDecorations;
let npcSystem;
let sceneInterestPoints;
let sceneInterestPointController;
let pendingSceneInterestPoint = null;
let questEventSequence = 0, activeStoryActorIds = new Set<string>();
const questRuntime = new QuestRuntime(SIDE_QUESTS, new LocalStorageQuestJournalRepository());
let gameClock = townGameHour();
const residences = [];

const mouse2D     = new THREE.Vector2(-9999, -9999);
const raycaster   = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorWorld = new THREE.Vector3();
const CONFIG = CITY_CONFIG;

const PLH = BUILDING_PLATFORM_HEIGHT;

// Progression unlock tiers
const UNLOCK_TIERS = [
  { threshold:2,  label:'a lamp post appeared',  fn: () => addLamps([[4.5,0,-6.8]]) },
  { threshold:5,  label:'a new tree sprouted',   fn: () => addTrees([[7.2,0,7.0]]) },
  { threshold:9,  label:'a stone arch revealed', fn: () => addArch(-5.5,0,5.8,-Math.PI/6) },
  { threshold:14, label:'a bench was placed',    fn: () => addBench(6.8,0,-1.5,Math.PI/3) },
];

// ── 成就系统 ─────────────────────────────────────────────────────────────────
const ACHIEVEMENTS = [
  { id:'citizen',       name:'居民落籍',      desc:'签下名字，成为这座城的居民',            check:s=>!!localStorage.getItem('minicityUser') },
  { id:'first_building',name:'第一次叩门',    desc:'进入任意一座建筑',                      check:s=>(s.buildingsVisited||[]).length>=1 },
  { id:'explorer_5',    name:'街区漫游者',    desc:'参观 5 座建筑',                         check:s=>(s.buildingsVisited||[]).length>=5 },
  { id:'explorer_10',   name:'城市测绘员',    desc:'参观 10 座建筑',                        check:s=>(s.buildingsVisited||[]).length>=10 },
  { id:'walker_100',    name:'长街行者',      desc:'累计步行 100 米',                       check:s=>(s.distance||0)>=100 },
  { id:'walker_500',    name:'环城暴走',      desc:'累计步行 500 米',                       check:s=>(s.distance||0)>=500 },
  { id:'chat_1',        name:'初次交谈',      desc:'和一位居民交谈',                        check:s=>(s.npcsTalked||0)>=1 },
  { id:'chat_all',      name:'城中人脉',      desc:'和每一位核心居民都交谈过',             check:s=>{
    const core=NPC_PROFILES.filter(p=>p.core).map(p=>p.id);
    return (s.npcsMet||[]).filter(id=>core.includes(id)).length>=core.length;
  } },
  { id:'night_owl',     name:'守夜人',        desc:'第一次在夜里看这座城市',                check:s=>(s.nightToggles||0)>=1 },
  { id:'unlock_3',      name:'城市生长',      desc:'解锁 3 次城市变化',                     check:s=>(s.unlockLevel||0)>=3 },
  { id:'cat_cafe_note', name:'猫咖拾遗',      desc:'发现猫咖馆旁掉落的纸张',                  check:()=>false, directOnly:true },
  { id:'minicity_origin',name:'物实城缘起',    desc:'触碰城中守望已久的沃柑树',                check:()=>false, directOnly:true },
  { id:'dragonwell_assimilation',name:'被龙井同化',desc:'向爬满绿色植物的石井献上龙井茶',          check:()=>false, directOnly:true },
  { id:'echo_unnoticed',name:'无人问津',desc:'在回声中选择离开',check:()=>false,directOnly:true },
  { id:'echo_eternal_lie',name:'永恒的谎言',desc:'让故事继续循环',check:()=>false,directOnly:true },
  { id:'echo_real_echo',name:'真正的回声',desc:'以真实回应林澈',check:()=>false,directOnly:true },
  { id:'echo_true_dawn',name:'真正的黎明',desc:'完成回声的全部后日谈',check:()=>false,directOnly:true },
];

function awardDirectAchievement(id, name) { progressionController?.awardDirectAchievement(id, name); }
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
    .then(() => { cacheBuildingBoxes(); mapController?.invalidateShot(); })
    .catch(error => console.error('3D model loading failed', error));
  buildingLabelController = createBuildingLabelController({ getBuildings: () => buildings, isStoryLocked: isStoryLockedBuilding, interact: interactOrWalk });
  buildingLabelController.addLabels(); buildingLabelController.applyRenames(); applyStoryLockedBuildings();
  communityPanels = createCommunityPanelController({ setPhoneOpen, showUnlockToast });
  attachNpcChangePanel();
  multiplayerHousing = createMultiplayerHousingController({
    scene, signal: eventController.signal, residences, getCursorChar: () => cursorChar,
    makeCharacter, showLoginEntry, showUnlockToast, movePlayerTo, pointInAnyBuilding,
    fountainClear: FOUNTAIN_CLEAR, getMapIconsBuilt: () => Boolean(mapController?.areIconsBuilt()),
    mapShotSpan: 48, getMapMode: () => Boolean(mapController?.isOpen()), toggleMapMode, communityPanels,
    getLegacyAchievements: () => getStats().achievements || [],
  });
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
    getQuestContext: () => ({ ...getQuestProgressView(), gameDay: gameClock }),
    consumeItem: (itemId, quantity) => { void multiplayerHousing?.progression.consumeItem(itemId, quantity); },
    setStoryPoints: (ids) => sceneInterestPoints?.setActiveStoryPoints(ids),
    setActiveActors: (ids) => { activeStoryActorIds = new Set(ids); },
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
  mapController = createMapController({
    document,
    getScene: () => scene,
    getBuildings: () => buildings,
    getCursor: () => cursorChar,
    getStats,
    getCamera: () => camera,
    getBuildingContent: (buildingId) => BUILDING_CONTENT[buildingId],
    isStoryLocked: isStoryLockedBuilding,
    getBuildingRoadEntry: (position) => roadNavigation.buildingRoadEntry(position),
    setCameraTarget,
    movePlayerTo,
    clearPlayerPath: () => { playerPath = []; },
    renderMapHouseTags,
    openResidence: () => undefined,
  });
  mapController.setup(eventController.signal);
  movementInputController=createMovementInputController({document,window,signal:eventController.signal,onManualStart:()=>{playerPath=[];pendingBuilding=null;pendingSceneInterestPoint=null;}});
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
    resolveMovement: (from, target) => roadNavigation.resolveMovement(from, target),
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
    pauseNpcs,
    resumeNpcs,
    showToast: showUnlockToast,
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
      claimDailyReward: (rewardId) => multiplayerHousing.progression.claimDailyReward(rewardId),
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
  });
  setupEvents(); setupFilter();
  applyTheme(isNight, true);
  initAnimations();
  clockInterval = window.setInterval(syncTimeAndTheme, 1000);
  syncTimeAndTheme();
  document.getElementById('labelsWrap').classList.add('hidden');
  animationFrame = requestAnimationFrame(loop);
  updateWelcome();

  loginController.checkLogin();
  setupMultiplayerUI();
}

function setupRenderer() {
  const canvas = document.getElementById('c');
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
  (window as any).__mini = () => ({
    scene, camera, renderer, cameraZoom, THREE, npcs: npcList, player: cursorChar,
    navigation: roadNavigation,
    getPlayerPath: () => playerPath.map(point => point.clone()),
    interactNpc: (npcId: string) => {
      const npc=npcList.find(item=>item.profile.id===npcId);
      if(!npc)return false;
      openNpcDialog(npc);
      return true;
    },
    interactBuilding: (buildingId: string) => {
      const building=buildings.find(item=>item.id===buildingId);
      if(!building||isStoryLockedBuilding(building))return false;
      navigateTo(building);
      return true;
    },
    interactInterestPoint: (id: SceneInterestPointId) => {
      const entity=sceneInterestPoints?.entities.get(id);
      if(!entity||!cursorChar)return false;
      cursorChar.position.set(entity.interactionPosition.x+0.5,0,entity.interactionPosition.z);
      interactWithSceneInterestPoint(id);
      return true;
    },
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

const PLOT_MAP = {
  bank:{tex:'ground5',size:4.5,color:0xE8E7E4}, board:{tex:'ground5',size:3.0,color:0xE4E3E0},
  tower:{tex:'ground5',size:4.0,color:0xD8D7D2}, darktower:{tex:'ground6',size:4.0,color:0x9A988E},
  pavilion:{tex:'ground4',size:4.5,color:0xC0D0A0}, library:{tex:'ground5',size:4.0,color:0xE8E7E4},
  ruins:{tex:'ground2',size:3.5,color:0xE0D8CC}, skyscraper:{tex:'ground5',size:3.5,color:0xD8D7D2},
  campus:{tex:'ground5',size:4.5,color:0xE8E7E4}, kiosk:{tex:'ground5',size:3.0,color:0xE4E3E0},
  screen:{tex:'ground5',size:4.0,color:0xD8D7D2}, shaft:{tex:'ground5',size:3.0,color:0xD8D7D2},
  altar:{tex:'ground5',size:3.5,color:0xE4E3E0}, observatory:{tex:'ground5',size:4.0,color:0xE8E7E4},
  pagoda:{tex:'ground4',size:4.0,color:0xC0D0A0}, market:{tex:'ground5',size:4.5,color:0xE4E3E0},
  greenhouse:{tex:'ground4',size:4.0,color:0xB8C888}, clocktower:{tex:'ground5',size:4.0,color:0xE4E3E0},
  temple:{tex:'ground5',size:4.5,color:0xF0EFEC}, factory:{tex:'ground2',size:5.0,color:0xC8C4B8},
  mall:{tex:'ground5',size:5.5,color:0xD8D7D2}, school:{tex:'ground4',size:4.5,color:0xB8C888},
  crown:{tex:'ground5',size:4.5,color:0xF0EFEC}, banana:{tex:'ground2',size:6.0,color:0xE0D8A0},
  qipai:{tex:'ground5',size:8.0,color:0xE4E3E0},
};
const SHAPE_FNS = buildingMeshFactory.builders;

function addDecorations() { worldDecorations.addDecorations(); }
function addTrees(positions) { worldDecorations.addTrees(positions); }
function addLamps(positions) { worldDecorations.addLamps(positions); }
function addArch(x, y, z, rotY) { worldDecorations.addArch(x, y, z, rotY); }
function addBench(x, y, z, rotY) { worldDecorations.addBench(x, y, z, rotY); }

function makeCharacter(headHex, bodyHex) { return npcSystem.makeCharacter(headHex, bodyHex); }
function addCharacters() { npcSystem.addCharacters(); }
function onYouClick() { npcSystem.onYouClick(); }
function updateNpcSchedules() { npcSystem.updateNpcSchedules(); }
function npcYieldToPlayer(npc) { npcSystem.npcYieldToPlayer(npc); }
function pauseNpcs() { npcSystem.pauseNpcs(); }
function resumeNpcs() { npcSystem.resumeNpcs(); }
function nearestNpcTo(position, radius) { return npcSystem.nearestNpcTo(position, radius); }
function npcForRaycast() { return npcSystem.npcForRaycast(); }

function setupEvents() {
  const canvas=document.getElementById('c');
  const signal=eventController.signal;
  canvas.addEventListener('mousemove',onMouseMove,{signal});
  canvas.addEventListener('click',onCanvasClick,{signal});
  canvas.addEventListener('mouseenter',()=>{mouseOnScene=true;},{signal});
  canvas.addEventListener('mouseleave',()=>{mouseOnScene=false;},{signal});

  // PC：滚轮缩放
  canvas.addEventListener('wheel',e=>{
    e.preventDefault();
    const factor=e.deltaY>0?1.12:1/1.12;
    cameraZoom=clamp(cameraZoom*factor,CONFIG.cameraZoomMin,CONFIG.cameraZoomMax);
    updateCameraProjection(cameraZoom);
  },{passive:false,signal});

  // 移动端：双指缩放
  let pinchDist=0;
  canvas.addEventListener('touchstart',e=>{
    if(e.touches.length===2){
      pinchDist=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
    }
  },{passive:true,signal});
  canvas.addEventListener('touchmove',e=>{
    if(e.touches.length===2){
      e.preventDefault();
      const d=Math.hypot(
        e.touches[0].clientX-e.touches[1].clientX,
        e.touches[0].clientY-e.touches[1].clientY
      );
      if(pinchDist>0){
        cameraZoom=clamp(cameraZoom*pinchDist/d,CONFIG.cameraZoomMin,CONFIG.cameraZoomMax);
        updateCameraProjection(cameraZoom);
      }
      pinchDist=d;
    }
  },{passive:false,signal});

  setupRenderSettings(signal);
  bindCityUiEvents({
    signal, closeRenderSettings, onYouClick,
    closeStats: () => statsPanelController?.close(),
    setStatsMode: (mode) => statsPanelController?.setMode(mode),
    closeWorks: closeWorksPanel, closeWorkDetail, toggleWorkStar, loadWorkComments,
    loadWorkDerivatives, loadWorkSupporters, toggleWorkSupport, postWorkComment,
    isMapOpen: () => Boolean(mapController?.isOpen()), toggleMap: toggleMapMode,
    closeModal, closeNpcDialog, login: () => loginController?.login(),
    showLogin: () => loginController?.showLogin(),
    resize: () => { renderer.setSize(window.innerWidth, window.innerHeight); updateCameraProjection(cameraZoom); if (mapController?.isOpen()) mapController.updateImage(); },
  });
}

function isStoryLockedBuilding(building) { return STORY_LOCKED_BUILDINGS.has(building.id); }

function applyStoryLockedBuildings() { applyStoryLockedBuildingPresentation(buildings.filter(isStoryLockedBuilding)); }

function setupRenderSettings(signal: AbortSignal) {
  setupRenderSettingsController({
    signal,
    maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
    maxTextureSize: renderer.capabilities.maxTextureSize,
    close: closeRenderSettings,
  });
}

function closeRenderSettings() {
  const panel = document.getElementById('renderSettings');
  const toggle = document.getElementById('renderSettingsToggle');
  panel?.classList.remove('open');
  toggle?.setAttribute('aria-expanded','false');
}

function onMouseMove(e) {
  mouse2D.x=(e.clientX/window.innerWidth)*2-1;
  mouse2D.y=-(e.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse2D,camera);
  raycaster.ray.intersectPlane(groundPlane,cursorWorld);
  raycaster.setFromCamera(mouse2D,camera);
  const hits=raycaster.intersectObjects(raycastBuildingGroups,true);
  if(hits.length){
    const b=findRaycastBuilding(hits);
    if(b&&b!==hoveredB){if(hoveredB)unhover(hoveredB);hover(b);}
    if(!b&&hoveredB){unhover(hoveredB);hoveredB=null;}
  } else{if(hoveredB)unhover(hoveredB);hoveredB=null;}
}

function setupMultiplayerUI() { multiplayerHousing.setupUI(); }
function setupMultiplayer(nickname, password) { multiplayerHousing.connect(nickname, password); }
function showLoginEntry() { loginController?.showLoginEntry(); }
function updateRemotePlayers(delta) { multiplayerHousing.updateRemotePlayers(delta); }
function setPhoneOpen(open) { multiplayerHousing?.setPhoneOpen(open); }
function renderMapHouseTags() { multiplayerHousing.renderMapHouseTags(); }
function openResidence(residenceId) { multiplayerHousing.openResidence(residenceId); }
function closeResidencePanel() { multiplayerHousing.closeResidencePanel(); }
function navigateToResidence(residenceId) { multiplayerHousing.navigateToResidence(residenceId); }
function raycastUserData(object, key) { return multiplayerHousing.raycastUserData(object, key); }
function findRaycastBuilding(hits) { return findBuildingFromRaycastHits({ hits, buildings, readUserData: raycastUserData, isUnavailable: isStoryLockedBuilding }); }

function onCanvasClick(event) {
  if (cityDialogs?.isOpen()) return;
  mouse2D.x=(event.clientX/window.innerWidth)*2-1;
  mouse2D.y=-(event.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse2D,camera);
  raycaster.ray.intersectPlane(groundPlane,cursorWorld);
  raycaster.setFromCamera(mouse2D,camera);
  const cabinDoor=sceneInterestPoints?.entities.get('echo-cabin-door');
  if(cabinDoor&&echoStoryController?.tryExitCabinFromClick(raycaster,cabinDoor.object)){pendingSceneInterestPoint=null;return;}
  if(cursorChar&&cursorChar.visible){
    const phits=raycaster.intersectObject(cursorChar,true);
    if(phits.length){ onYouClick(); return; }
  }
  const npcHit=npcForRaycast();
  if(npcHit){ talkToOrWalk(npcHit); return; }
  const interestHits=sceneInterestPoints
    ? raycaster.intersectObjects(sceneInterestPoints.raycastTargets,true)
    : [];
  if(interestHits.length){
    const id=raycastUserData(interestHits[0].object,'sceneInterestPointId') as SceneInterestPointId | undefined;
    if(id){ interactWithSceneInterestPoint(id); return; }
  }
  const hits=raycaster.intersectObjects(raycastBuildingGroups,true);
  if(hits.length){
    const residenceId=raycastUserData(hits[0].object,'residenceId');
    if(residenceId){ openResidence(residenceId); return; }
    const b=findRaycastBuilding(hits);
    if(b){ interactOrWalk(b); return; }
  }
  const near=nearestNpcTo(cursorWorld,CONFIG.npcTalkRadius);
  if(near){ talkToOrWalk(near); return; }
  movePlayerTo(cursorWorld);
}

function talkToOrWalk(npc) {
  if(cursorChar && cursorChar.position.distanceTo(npc.mesh.position)<=CONFIG.npcTalkRadius){
    openNpcDialog(npc);
  } else {
    const p=cursorChar?cursorChar.position:new THREE.Vector3(0,0,0);
    const n=npc.mesh.position;
    const dx=p.x-n.x, dz=p.z-n.z, d=Math.hypot(dx,dz)||1;
    const stopDist=CONFIG.npcTalkRadius-0.35;
    movePlayerTo(new THREE.Vector3(n.x+dx/d*stopDist,0,n.z+dz/d*stopDist));
  }
}

function interactOrWalk(b) {
  if (isStoryLockedBuilding(b)) return;
  const buildingDistance = cursorChar ? Math.hypot(
    cursorChar.position.x - b.group.position.x,
    cursorChar.position.z - b.group.position.z
  ) : Infinity;
  if(cursorChar && buildingDistance<=CONFIG.buildingInteractRadius){
    pendingBuilding=null;
    navigateTo(b);
  } else {
    pendingBuilding=b;
    movePlayerTo(b.group.position);
  }
}

function hover(b) {
  hoveredB=b;
  gsap.to(b.group.position,{y:0.22,duration:0.28,ease:'power2.out'});
  gsap.to(b.bodyMat,{emissiveIntensity:0.08,duration:0.28});
  b.labelEl&&b.labelEl.classList.add('hovered');
}
function unhover(b) {
  gsap.to(b.group.position,{y:0,duration:0.38,ease:'power2.out'});
  gsap.to(b.bodyMat,{emissiveIntensity:0,duration:0.38});
  b.labelEl&&b.labelEl.classList.remove('hovered');
}
function navigateTo(b) {
  if (isStoryLockedBuilding(b)) return;
  multiplayerHousing?.progression.interactBuilding(b.id,()=>navigateUnlocked(b));
}
function navigateUnlocked(b) {
  if (isStoryLockedBuilding(b)) return;
  if (cityDialogs && echoStoryController?.interactBuilding(b.id, cityDialogs)) { trackInteraction(b.id); return; }
  if (b.isStats) { statsPanelController?.open(); trackInteraction('stats'); return; }
  if (b.id === 'mall_south' || b.id === 'mall_west') { multiplayerHousing.progression.openShop(); trackInteraction(b.id); return; }
  const phoneBuildings={bulletin:['inventory'],news:['inventory'],newsstand:['inventory'],community:['social','profile'],records:['social','mine'],tradingpost:['social','favorites'],guildhall:['social','volunteers'],mutualaid:['social','following']};
  if(phoneBuildings[b.id]){openPhoneApp(...phoneBuildings[b.id]);trackInteraction(b.id);return;}
  const configuredQuery=BUILDING_API_QUERIES[b.id];
  if(configuredQuery){openWorksPanel(b.id,configuredQuery);trackInteraction(b.id);return;}
  trackInteraction(b.id);
  openModal(b);
}

function interactWithSceneInterestPoint(id: SceneInterestPointId) {
  const entity=sceneInterestPoints?.entities.get(id);
  if(!entity||!cursorChar)return;
  const distance=Math.hypot(
    cursorChar.position.x-entity.interactionPosition.x,
    cursorChar.position.z-entity.interactionPosition.z,
  );
  if(distance<=3.5){
    pendingSceneInterestPoint=null;
    void sceneInterestPointController?.interact(id);
    return;
  }
  pendingSceneInterestPoint=id;
  movePlayerTo(entity.interactionPosition);
}

function openPhoneApp(tab, kind) { communityPanels.openPhoneApp(tab, kind); }
function updatePhoneBindingState() { communityPanels.updatePhoneBindingState(); }
function openPhoneBinding() { communityPanels.openPhoneBinding(); }
function bindPhysicsLabAccount(event) { return communityPanels.bindPhysicsLabAccount(event); }
function loadPhoneMessages(append = false) { return communityPanels.loadPhoneMessages(append); }
function loadPhoneSocial(kind) { return communityPanels.loadPhoneSocial(kind); }
function closeWorkDetail() { communityPanels.closeWorkDetail(); }
function loadWorkComments() { return communityPanels.loadWorkComments(); }
function postWorkComment(event) { return communityPanels.postWorkComment(event); }
function loadWorkDerivatives() { return communityPanels.loadWorkDerivatives(); }
function loadWorkSupporters() { return communityPanels.loadWorkSupporters(); }
function toggleWorkSupport() { return communityPanels.toggleWorkSupport(); }
function toggleWorkStar() { return communityPanels.toggleWorkStar(); }
function openWorksPanel(context, queryOverride = null) { communityPanels.openWorksPanel(context, queryOverride); }
function closeWorksPanel() { communityPanels.closeWorksPanel(); }

function applyTheme(night,instant) {
  const d=instant?0:0.72;
  // Swap sky texture
  if (TEX.skyDay && TEX.skyNight) {
    scene.background = night ? TEX.skyNight : TEX.skyDay;
  } else {
    tweenColor(scene.background,night?P.NIGHT_BG:P.DAY_BG,d);
  }
  pathMats.forEach(m=>tweenColor(m.color,night?P.NIGHT_PATH:P.DAY_PATH,d));
  groundMats.forEach(g=>tweenColor(g.mat.color,night?g.night:g.day,d));
  const amb=scene.getObjectByName('amb'),dir=scene.getObjectByName('dir');
  if(amb)gsap.to(amb,{intensity:night?0.60:1.05,duration:d});
  if(dir)gsap.to(dir,{intensity:night?0.30:0.55,duration:d});
  lampGlobes.forEach(m=>gsap.to(m,{emissiveIntensity:night?0.60:0.05,duration:d}));
}
function tweenColor(c,hex,dur) {
  const t=new THREE.Color(hex);
  if(dur===0){c.copy(t);return;}
  gsap.to(c,{r:t.r,g:t.g,b:t.b,duration:dur,ease:'power2.inOut'});
}

function syncTimeAndTheme() {
  gameClock = townGameHour();
  echoStoryController?.announceGuide();
  const night = gameClock>=19 || gameClock<6;
  if (night!==isNight) {
    isNight=night;
    document.body.classList.toggle('night',isNight);
    document.body.classList.toggle('day',!isNight);
    applyTheme(isNight,false);
    setTimeout(() => mapController?.invalidateShot(), 1000);
    if(isNight){
      const s=getStats();
      s.nightToggles=(s.nightToggles||0)+1;
      saveStats(s);
      checkAchievements();
    }
  }
  const el=document.getElementById('communityTime');
  if(el){
    const h=Math.floor(gameClock), m=Math.floor((gameClock-h)*60);
    el.textContent=(h<10?'0':'')+h+':'+(m<10?'0':'')+m;
  }
  updateNpcSchedules();
}

// ── Entrance + loop animations ────────────────────────────────────────────────
function entranceAnimation() {
  buildings.forEach((b,i)=>{
    gsap.to(b.group.position,{y:0,duration:0.85,delay:0.1+i*0.06,ease:'back.out(1.6)'});
  });
  gsap.from('.welcome-block',{opacity:0,y:8,duration:0.9,delay:0.2,ease:'power2.out'});
  gsap.from('.ui-header',{opacity:0,y:-6,duration:0.7,delay:0.1,ease:'power2.out'});
  gsap.from('.you-block',{opacity:0,y:8,duration:0.9,delay:0.4,ease:'power2.out'});
  document.getElementById('labelsWrap').classList.remove('hidden');
}
function initAnimations() {
  if (REDUCED) return;
  const sb=buildings.find(b=>b.isStats);
  if(sb&&sb.glowMat)
    gsap.to(sb.glowMat,{emissiveIntensity:0.55,duration:1.6,ease:'sine.inOut',repeat:-1,yoyo:true});
}

// ── Label projection ──────────────────────────────────────────────────────────
function updateLabels() {
  updateCityLabels({ camera, buildings, residences, isStoryLocked: isStoryLockedBuilding, worldPosition: labelWorldPosition });
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop() {
  animationFrame = requestAnimationFrame(loop);
  const now=performance.now();
  const delta=Math.min((now-lastFrameTime)/1000,0.05);
  lastFrameTime=now;
  playerController?.updateMovement(delta);
  updateRemotePlayers(delta);
  npcList.forEach(npc=>{
    if(!npc.mesh.visible||npc.walking===false) return;
    npcYieldToPlayer(npc);
  });
  playerController?.updateCamera();
  sceneInterestPoints?.update(now/1000);
  updateLabels();
  renderer.render(scene,camera);
  if(mapController?.isOpen()) mapController.updateMarker();
}

function toggleMapMode() {
  mapController?.toggle();
}

function updateCameraProjection(vs) {
  cameraController?.updateProjection(vs);
}

function setCameraTarget(x,z,instant) { cameraController?.setTarget(x,z,instant); }

function movePlayerTo(target) { playerController?.moveTo(target); }

function handlePlayerIdle() {
  if(pendingBuilding && cursorChar){
    const b=pendingBuilding;
    const distance=Math.hypot(cursorChar.position.x-b.group.position.x,cursorChar.position.z-b.group.position.z);
    if(distance<=CONFIG.buildingInteractRadius){ pendingBuilding=null; navigateTo(b); }
  }
  if(pendingSceneInterestPoint && cursorChar){
    const id=pendingSceneInterestPoint;
    const entity=sceneInterestPoints?.entities.get(id);
    if(entity){
      const distance=Math.hypot(cursorChar.position.x-entity.interactionPosition.x,cursorChar.position.z-entity.interactionPosition.z);
      if(distance<=3.5){ pendingSceneInterestPoint=null; void sceneInterestPointController?.interact(id); }
    }
  }
}

function flushDistance(amount) {
  if(!cursorChar||amount<=0)return;
  const s=getStats();
  s.distance=(s.distance||0)+amount;
  saveStats(s);
  checkAchievements();
}

const roadNavigation = createRoadNavigationSystem({
  roadCoords: ROAD_COORDS,
  echoObservatoryArea: ECHO_OBSERVATORY_AREA,
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

// ══════════════════════════════════════════════════════════════════════════════
// STATS / PROGRESSION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

function trackInteraction(buildingId) {
  const s=getStats();
  s.interactions++;
  if(buildingId&&!s.buildingsVisited.includes(buildingId)) s.buildingsVisited.push(buildingId);
  saveStats(s);
  updateWelcome();
  progressionController?.checkUnlocks(s);
  checkAchievements();
  const transition=questRuntime.dispatch({
    id:`building:${buildingId}:${Date.now()}:${questEventSequence++}`,
    type:'building.visited',
    buildingId,
    at:Date.now(),
  });
  echoStoryController?.updateGuide(camera);
  const ready=transition.changes.find(change=>change.type==='quest.ready');
  if(ready){
    const quest=SIDE_QUESTS.find(item=>item.id===ready.questId);
    if(quest)showUnlockToast(`任务可交付 · ${quest.title}`);
  }
}

function updateWelcome() {
  // Cloud progression owns the unique-building threshold and inventory entry.
}

function showUnlockToast(msg) {
  const toast=document.getElementById('unlockToast');
  document.getElementById('utText').textContent=msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),3400);
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
    btn.addEventListener('click',()=>setFilter(btn.dataset.filter));
  });
}

function setFilter(filter) {
  currentFilter=filter;
  document.querySelectorAll('.pf-btn').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
  if(filter==='friends'){
    npcList.forEach(npc=>{ if(npc.mesh.visible){ npc.mesh.visible=false; if(npc.tween){ npc.tween.kill(); npc.tween=null; } } });
    showUnlockToast('no friends online yet — invite someone!');
  } else {
    updateNpcSchedules();
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

function openModal(building) { cityDialogs?.openBuilding(building); }
function closeModal() { cityDialogs?.closeBuilding(); }

function recordNpcInteraction(npcId) {
  const stats=getStats();
  stats.npcsTalked=(stats.npcsTalked||0)+1;
  if(!stats.npcsMet)stats.npcsMet=[];
  if(!stats.npcsMet.includes(npcId))stats.npcsMet.push(npcId);
  saveStats(stats);
  checkAchievements();
  const at=Date.now();
  questRuntime.dispatch({
    id:`npc:${npcId}:${at}:${questEventSequence++}`,
    type:'npc.interacted',
    npcId,
    at,
  });
}

function openNpcDialog(npc) {
  if (cityDialogs && echoStoryController?.interactNpc(npc.profile.id, cityDialogs)) {
    recordNpcInteraction(npc.profile.id);
    return;
  }
  cityDialogs?.openNpc(npc as NpcEntityLike, cursorChar ? { x: cursorChar.position.x, z: cursorChar.position.z } : undefined);
}
function closeNpcDialog() { cityDialogs?.closeNpc(); }

// ── Helpers ───────────────────────────────────────────────────────────────────
function stdMat(p){
  if(!p) return new THREE.MeshStandardMaterial();
  const texKey = p.tex, rx = p.rx || 1, ry = p.ry || 1;
  const o = {};
  Object.keys(p).forEach(k => { if(k!=='tex' && k!=='rx' && k!=='ry') o[k]=p[k]; });
  if(texKey) {
    const t = _tex(texKey, rx, ry);
    if(t) o.map = t;
  }
  if(o.transparent) o.depthWrite=false;
  return new THREE.MeshStandardMaterial(o);
}
function mk(geo,mat){return new THREE.Mesh(resources.geometry(geo),mat);}
function part(group,geo,matOrParams,pos,shadow=true){
  const mat=matOrParams instanceof THREE.Material
    ? matOrParams
    : resources.material({kind:'part',...matOrParams},()=>stdMat(matOrParams));
  const m=new THREE.Mesh(resources.geometry(geo),mat);
  if(pos)m.position.set(pos[0],pos[1],pos[2]);
  m.castShadow=shadow; m.receiveShadow=true;
  if(mat.transparent){m.renderOrder=RENDER_ORDER.transparentSurface;}
  if(group)group.add(m);
  return m;
}

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
  cancelAnimationFrame(animationFrame);
  clearInterval(clockInterval);
  clearInterval(trackingInterval);
  multiplayerHousing?.destroy();
  destroyCG();
  eventController.abort();
  npcList.forEach(npc=>npc.tween?.kill());
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
  pendingSceneInterestPoint=null;
  document.getElementById('labelsWrap')?.replaceChildren();
  document.getElementById('mapIcons')?.replaceChildren();
  echoStoryController?.dispose();
}
