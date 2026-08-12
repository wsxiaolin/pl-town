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
import { BUILDING_PLATFORM_HEIGHT, CAMERA_OFFSET, CITY_CONFIG, CITY_LIMIT, ECHO_OBSERVATORY_AREA, PALETTE, ROAD_COORDS, SATELLITE_CITY } from './data/cityConfig';
import { BUILDING_DEFS, BUILDING_API_QUERIES, BUILDING_CONTENT } from './data/buildings';
import { NPC_PROFILES } from './data/npcs';
import { createCitySurfaces } from '../rendering/createCitySurfaces';
import { addRealBuildingModels } from '../rendering/realBuildingModels';
import { destroyCG, initCG, shouldShowCG, startCG } from './cg';
import { SIDE_QUESTS } from '../gameplay/content/quests/sideQuests';
import { ECHO_STORY } from '../gameplay/content/stories/echoStory';
import { LocalStorageQuestJournalRepository } from '../adapters/storage/LocalStorageQuestJournalRepository';
import { LocalStorageStoryRepository } from '../adapters/storage/LocalStorageStoryRepository';
import { QuestRuntime } from '../gameplay/quests/QuestRuntime';
import { createCityDialogController, type CityDialogController, type NpcEntityLike } from '../adapters/ui/cityDialogController';
import { createStoryDialogFlow } from '../adapters/ui/storyDialogFlow';
import { createCommunityPanelController } from '../adapters/ui/communityPanelController';
import { createMultiplayerHousingController } from '../adapters/ui/multiplayerHousingController';
import { setupRenderSettingsController } from '../adapters/ui/renderSettingsController';
import { createEchoObservatoryGuide } from '../adapters/ui/echoObservatoryGuide';
import { calcLevel, formatDate, formatTime, getStats, getUserId, saveStats, startTimeTracking } from './progression/legacyStats';
import { createRoadNavigationSystem } from './navigation/roadNavigation';
import { createEchoCabinNavigation } from './navigation/echoCabinNavigation';
import { createNpcSystem } from './npcSystem';
import { createSceneInterestPoints } from '../rendering/sceneInterestPoints';
import { addEchoObservatoryArea } from '../rendering/echoObservatoryArea';
import { createSceneInterestPointController } from './sceneInterestPointController';
import type { SceneInterestPointId } from '../gameplay/world/sceneInteractions';
import { townGameDay, townGameHour } from '../gameplay/time/townClock';
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

// ── Procedural Textures ──────────────────────────────────────────────────────
const proceduralTextures = createProceduralTextureLibrary(
  resources,
  () => renderer,
  () => readRenderSettings().anisotropy,
);
const TEX = proceduralTextures.backgrounds;
const _tex = proceduralTextures.repeat;
const addFacade = proceduralTextures.addFacade;

// ── Globals ───────────────────────────────────────────────────────────────────
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
const ECHO_CABIN_NODES = new Set(['fifth-hub', 'photo-wall-investigation', 'diary-investigation', 'diary-page-89', 'diary-page-67', 'diary-page-30', 'diary-page-1', 'fifth-act-complete']);
let currentFilter = 'all';
let statsMode = 'clean';
let mapMode = false; // 全景地图弹层是否打开
let mapShotData = null;    // 启动时俯视截取的全城图（dataURL）
let mapShotRenderer = null, mapShotCam = null;
const MAP_SHOT = 1024;     // 截图像素边长
const MAP_SHOT_SPAN = 64;
const MAP_SHOT_CENTER_X = 16;
let mapIconsBuilt = false, mapTipB = null;
const cameraTarget = new THREE.Vector3(0,0,0);
// The interior camera is kept above the roof line and inside the floor footprint.
// The roof is hidden while inside, so this avoids a near-wall/roof clip while
// still letting the camera look down into the complete room.
const ECHO_INTERIOR_CAMERA_ANCHOR = new THREE.Vector3(8.2,15.5,-8.2);
const ECHO_EXTERIOR_CAMERA_OFFSET = new THREE.Vector3(-20,32,-20);
const echoCameraOffset = new THREE.Vector3();
const echoInteriorLookAt = new THREE.Vector3();
let echoCabinNavigation = null;
let echoExteriorCameraZoom = 7;
let echoInteriorView = false;
let cityDialogs: CityDialogController | null = null;
let echoObservatoryGuide = null;
let communityPanels;
let multiplayerHousing;
let worldDecorations;
let npcSystem;
let sceneInterestPoints;
let sceneInterestPointController;
let pendingSceneInterestPoint = null;
let pendingDistance = 0;
let questEventSequence = 0, activeStoryActorIds = new Set<string>();
const questRuntime = new QuestRuntime(SIDE_QUESTS, new LocalStorageQuestJournalRepository());
const echoStory = createStoryDialogFlow(ECHO_STORY, new LocalStorageStoryRepository(ECHO_STORY), { getContext: () => ({ ...getQuestProgressView(), gameDay: townGameDay() }), onEvent: handleEchoStoryEvent, onEffects: (effects) => effects.forEach((effect) => { if (effect.type === 'inventory.remove') void multiplayerHousing?.progression.consumeItem(effect.itemId, effect.quantity); }), onWorldInteractionsChanged: (ids) => sceneInterestPoints?.setActiveStoryPoints(ids as readonly SceneInterestPointId[]), onActiveActorsChanged: (ids) => { activeStoryActorIds = new Set(ids); npcSystem?.updateNpcSchedules(); } });

const ECHO_STORY_ACHIEVEMENTS = {
  'echo.achievement.unnoticed': { id: 'echo_unnoticed', name: '无人问津' },
  'echo.achievement.eternal-lie': { id: 'echo_eternal_lie', name: '永恒的谎言' },
  'echo.achievement.real-echo': { id: 'echo_real_echo', name: '真正的回声' },
  'echo.achievement.true-dawn': { id: 'echo_true_dawn', name: '真正的黎明' },
};

function handleEchoStoryEvent(event) {
  echoObservatoryGuide?.applyEvent(event);
  const achievement = ECHO_STORY_ACHIEVEMENTS[event.type];
  if (achievement) awardDirectAchievement(achievement.id, achievement.name);
  if (!cursorChar) return;
  if (event.type === 'echo.cabin.exited') {
    teleportFromEchoCabin();
    return;
  }
  if (event.type !== 'echo.cabin.entered') return;
  teleportToEchoCabin();
}

function teleportToEchoCabin() {
  if (!cursorChar) return;
  setEchoInteriorView(true);
  playerPath = [];
  cursorChar.position.set(ECHO_OBSERVATORY_AREA.interior[0], 0, ECHO_OBSERVATORY_AREA.interior[1] - 8.2);
  const spawn = echoCabinNavigation?.clampToWalkable(cursorChar.position);
  if (spawn) cursorChar.position.copy(spawn);
  setCameraTarget(cursorChar.position.x, cursorChar.position.z, true);
}

function teleportFromEchoCabin() {
  if (!cursorChar) return;
  setEchoInteriorView(false);
  playerPath = [];
  cursorChar.position.set(ECHO_OBSERVATORY_AREA.linche[0] - 1.5, 0, ECHO_OBSERVATORY_AREA.linche[1]);
  setCameraTarget(ECHO_OBSERVATORY_AREA.linche[0], ECHO_OBSERVATORY_AREA.linche[1], true);
  multiplayerHousing?.sendLocalPosition({ x: cursorChar.position.x, y: 0, z: cursorChar.position.z, rotation: cursorChar.rotation.y }, performance.now());
}

function setEchoInteriorView(active) {
  const changed = active !== echoInteriorView;
  if (active && changed) echoExteriorCameraZoom = cameraZoom || 7;
  if (changed) gsap.killTweensOf(cameraTarget);
  echoInteriorView = active;
  scene?.traverse((object) => {
    if (object.userData.echoInteriorRoof || object.userData.echoInteriorCeiling || object.userData.echoCabinCameraOccluder) {
      object.visible = !active;
    }
  });
  if (camera && changed) {
    cameraZoom = active ? (MOBILE() ? 6.4 : 8.8) : Math.max(2, Math.min(15, echoExteriorCameraZoom || 7));
    updateCameraProjection(cameraZoom);
  }
}
let gameClock = townGameHour();
const residences = [];

const mouse2D     = new THREE.Vector2(-9999, -9999);
const raycaster   = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorWorld = new THREE.Vector3();
const CONFIG = CITY_CONFIG;

// ── Building config ───────────────────────────────────────────────────────────
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

function awardDirectAchievement(achievementId, achievementName) {
  const stats=getStats();
  stats.achievements=stats.achievements||[];
  if(stats.achievements.includes(achievementId))return;
  stats.achievements.push(achievementId);
  saveStats(stats);
  multiplayerHousing?.progression.unlockAchievement(achievementId);
  showUnlockToast(`成就解锁 · ${achievementName}`);
}

function restoreEchoStoryAchievements() {
  const nodeId=echoStory.state().nodeId;
  if(nodeId==='forgotten-complete') awardDirectAchievement('echo_unnoticed','无人问津');
  if(nodeId==='loop-complete') awardDirectAchievement('echo_eternal_lie','永恒的谎言');
  if(nodeId==='truth-complete'||nodeId.startsWith('visit-')||nodeId==='epilogue-complete') awardDirectAchievement('echo_real_echo','真正的回声');
  if(nodeId==='epilogue-complete') awardDirectAchievement('echo_true_dawn','真正的黎明');
}

function checkAchievements() {
  const s=getStats();
  s.achievements=s.achievements||[];
  let gained=false;
  ACHIEVEMENTS.forEach(a=>{
    if(s.achievements.includes(a.id))return;
    if(a.check(s)){ s.achievements.push(a.id); gained=true; multiplayerHousing?.progression.unlockAchievement(a.id); showUnlockToast('成就解锁 · '+a.name); }
  });
  if(gained) saveStats(s);
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  setupRenderer(); setupCamera(); proceduralTextures.initialize(); setupScene(); setupLighting();
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
      get mapMode() { return mapMode; },
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
  addFountain(); addBuildings();
  addEchoObservatoryArea({
    scene,
    makeMaterial: (parameters) => resources.material({ kind: 'echo-observatory', ...parameters }, () => stdMat(parameters)),
  }).forEach(group => roadNavigation.registerObstacleGroup(group));
  echoCabinNavigation = createEchoCabinNavigation({
    getInterior: () => scene?.getObjectByName('linche-home-interior'),
    fallbackBounds: {
      minX: ECHO_OBSERVATORY_AREA.interior[0] - 14.4,
      maxX: ECHO_OBSERVATORY_AREA.interior[0] + 14.4,
      minZ: ECHO_OBSERVATORY_AREA.interior[1] - 10.0,
      maxZ: ECHO_OBSERVATORY_AREA.interior[1] + 10.0,
    },
  });
  echoCabinNavigation.refresh();
  // Re-apply the current state after a fresh scene/HMR rebuild. This prevents
  // an interior session restored into a new scene from briefly showing the roof.
  setEchoInteriorView(echoInteriorView);
  cacheBuildingBoxes(); addDecorations(); addCharacters();
  sceneInterestPoints = createSceneInterestPoints({ scene, makeMaterial: stdMat, makeMesh: mk });
  addRealBuildingModels(scene, buildings)
    .then(() => { mapShotData = null; })
    .catch(error => console.error('3D model loading failed', error));
  addLabels(); addEchoObservatoryLabel(); applyRenames(); applyStoryLockedBuildings();
  communityPanels = createCommunityPanelController({ setPhoneOpen, showUnlockToast });
  multiplayerHousing = createMultiplayerHousingController({
    scene, signal: eventController.signal, residences, getCursorChar: () => cursorChar,
    makeCharacter, showLoginEntry, showUnlockToast, movePlayerTo, pointInAnyBuilding,
    fountainClear: FOUNTAIN_CLEAR, getMapIconsBuilt: () => mapIconsBuilt,
    mapShotSpan: MAP_SHOT_SPAN, getMapMode: () => mapMode, toggleMapMode, communityPanels,
    getLegacyAchievements: () => getStats().achievements || [],
  });
  restoreEchoStoryAchievements();
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
    interactWithStory: (id) => cityDialogs ? echoStory.interactInterestPoint(id, cityDialogs) : false,
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

  checkLogin();
  setupMultiplayerUI();
}

// ── Renderer / Camera / Scene / Lighting ──────────────────────────────────────
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
function setupLighting() {
  const amb = new THREE.AmbientLight(0xFAF8F4, isNight ? 0.60 : 1.05);
  amb.name = 'amb'; scene.add(amb);
  const dir = new THREE.DirectionalLight(0xFFFFFF, isNight ? 0.30 : 0.55);
  dir.name = 'dir'; dir.position.set(18,28,12); dir.castShadow = true;
  const shadowSize = MOBILE() ? 512 : 1024;
  dir.shadow.mapSize.set(shadowSize,shadowSize);
  dir.shadow.camera.left=-45; dir.shadow.camera.right=45;
  dir.shadow.camera.top=45;   dir.shadow.camera.bottom=-45;
  dir.shadow.camera.near=0.5; dir.shadow.camera.far=120;
  dir.shadow.bias=-0.0006; dir.shadow.normalBias=0.02;
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xD8E8FF, 0.18);
  fill.position.set(-6,8,-6); scene.add(fill);
}
// ── Fountain (city-center landmark, made prominent) ──────────────────────────
function addFountain() {
  const g = new THREE.Group();
  // Outer stone rim — raised above ground so it's clearly visible
  const rimY = 0.18;  // rim center, half-height 0.18 → bottom at y=0, top at y=0.36
  part(g, new THREE.CylinderGeometry(1.8, 1.9, 0.36, 48), {color:P.FOUNTAIN_RIM, roughness:0.75, tex:'stone', rx:6, ry:1}, [0, rimY, 0], true);
  // Inner water surface — bright blue, slightly below rim top
  // Keep water below the basin lip; coplanar top faces caused blue z-fighting.
  part(g, new THREE.CylinderGeometry(1.55, 1.55, 0.03, 48), {color:P.FOUNTAIN_WATER, roughness:0.05, metalness:0.2, transparent:true, opacity:0.85}, [0, 0.335, 0], false);
  // Tier 2 — smaller upper basin
  part(g, new THREE.CylinderGeometry(0.85, 0.95, 0.18, 32), {color:P.FOUNTAIN_RIM, roughness:0.75, tex:'stone', rx:3, ry:1}, [0, 0.45, 0], true);
  part(g, new THREE.CylinderGeometry(0.7, 0.7, 0.03, 32), {color:P.FOUNTAIN_WATER, roughness:0.05, metalness:0.2, transparent:true, opacity:0.85}, [0, 0.54, 0], false);
  // Central spout column
  part(g, new THREE.CylinderGeometry(0.12, 0.15, 0.7, 16), {color:0xD4D3D0, roughness:0.55, tex:'stone', rx:1, ry:1}, [0, 0.65, 0], true);
  // Water jet — glowing blue sphere on top
  part(g, new THREE.SphereGeometry(0.18, 16, 16), {color:P.BLUE, emissive:P.BLUE, emissiveIntensity:0.45, roughness:0.2, metalness:0.3}, [0, 1.1, 0], false);
  // Surrounding spray droplets — small spheres scattered
  for (let i = 0; i < 8; i++) {
    const a = (i/8)*Math.PI*2;
    const d = 0.25 + Math.random()*0.15;
    part(g, new THREE.SphereGeometry(0.04 + Math.random()*0.03, 8, 8), {color:0xA8C8F8, emissive:0x6A8FE0, emissiveIntensity:0.2, transparent:true, opacity:0.7, roughness:0.3}, [Math.cos(a)*d, 1.0 + Math.random()*0.2, Math.sin(a)*d], false);
  }
  // Stone bench ring around the fountain (for citizens to sit)
  for (let i = 0; i < 8; i++) {
    const a = (i/8)*Math.PI*2;
    const bx = Math.cos(a)*2.5, bz = Math.sin(a)*2.5;
    part(g, new THREE.BoxGeometry(0.6, 0.12, 0.25), {color:0xC4A86D, roughness:0.7, tex:'stone', rx:1, ry:1}, [bx, 0.06, bz]).rotation.y = -a + Math.PI/2;
  }
  scene.add(g);
}

// ── Building shapes ───────────────────────────────────────────────────────────
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
function addBuildingPlot(x, z, shape, buildingId) {
  const p = PLOT_MAP[shape] || {tex:'ground5', size:3.5, color:0xE4E3E0};
  const mat = stdMat({color: isNight ? Math.floor(p.color*0.7) : p.color, roughness:0.9, tex:p.tex, rx:Math.max(1,p.size/2), ry:Math.max(1,p.size/2)});
  mat.depthWrite = false;
  const plot = new THREE.Mesh(new THREE.PlaneGeometry(p.size, p.size), mat);
  plot.userData.buildingId = buildingId;
  const plotJitter = (Math.abs(Math.round(x*7 + z*13)) % 8) * 0.0015;
  plot.rotation.x = -Math.PI/2; plot.position.set(x, SURFACE_Y.buildingPlot + plotJitter, z); plot.receiveShadow = true;
  plot.renderOrder = RENDER_ORDER.buildingPlot; scene.add(plot);
  buildingPlotTargets.push(plot);
}

const SHAPE_FNS = buildingMeshFactory.builders;

function addBuildings() {
  const FACADE_MAP = {
    bank:'facade_bank',board:'facade_board',tower:'facade_tower',darktower:'facade_darktower',
    pavilion:'facade_temple',library:'facade_library',ruins:'facade_library',
    skyscraper:'facade_skyscraper',campus:'facade_campus',kiosk:'facade_kiosk',
    screen:'facade_screen',shaft:'facade_shaft',altar:'facade_altar',
    observatory:'facade_observatory',market:'facade_market',
    greenhouse:'facade_greenhouse',clocktower:'facade_clocktower',temple:'facade_temple',
    factory:'facade_factory',mall:'facade_mall',school:'facade_school',
    banana:'facade_banana',qipai:'facade_qipai'
  };
  BUILDING_DEFS.filter(cfg => !cfg.disabled).forEach(cfg => {
    const b = SHAPE_FNS[cfg.shape](cfg);
    // Facade planes are only valid for rectangular bodies. Curved buildings
    // carry their facade texture directly on the mesh so their outline stays
    // circular and the texture closes around the circumference.
    if (b.body && b.body.geometry && b.body.geometry.parameters) {
      const p = b.body.geometry.parameters;
      const isBoxBody = p.width !== undefined && p.height !== undefined && p.depth !== undefined;
      const bw = p.width, bh = p.height, bd = p.depth;
      const fk = cfg.facade || FACADE_MAP[cfg.shape];
      if (isBoxBody && fk && bw > 0.3 && bh > 0.3) {
        // A physical gap is more stable than polygon offset alone at low render
        // resolution and prevents distant wall facades from z-fighting.
        const facadeOffset = 0.024;
        addFacade(b.group, fk, bw, bh, b.body.position.y, bd/2 + facadeOffset);
        const f2 = addFacade(b.group, fk, bw, bh, b.body.position.y, -(bd/2 + facadeOffset));
        if (f2) f2.rotation.y = Math.PI;
        if (bd > 0.3) {
          const f3 = addFacade(b.group, fk, bd, bh, b.body.position.y, 0, 0);
          if (f3) { f3.position.x = -(bw/2 + facadeOffset); f3.rotation.y = -Math.PI/2; }
          const f4 = addFacade(b.group, fk, bd, bh, b.body.position.y, 0, 0);
          if (f4) { f4.position.x = bw/2 + facadeOffset; f4.rotation.y = Math.PI/2; }
        }
      }
    }
    b.group.position.y = -3; // Start hidden below ground for entrance animation
    scene.add(b.group); buildings.push(b);
    // Add ground plot under the building
    addBuildingPlot(cfg.x, cfg.z, cfg.shape, cfg.id);
  });
  raycastBuildingGroups = [...buildings.map(b => b.group), ...buildingPlotTargets];
}

// ── Decorations ───────────────────────────────────────────────────────────────
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

function addLabels() {
  const wrap=document.getElementById('labelsWrap');
  buildings.filter((building) => !isStoryLockedBuilding(building)).forEach(b=>{
    const el=document.createElement('a');
    el.className='b-label-item'; el.href='#'; el.tabIndex=0;
    el.dataset.buildingId=b.id;
    el.setAttribute('aria-label',`${b.label}${b.isStats?' — open stats panel':' — 查看详情'}`);
    el.innerHTML=`<span class="bl-icon">${b.icon}</span><span class="bl-name">${b.label}</span>`;
    el.addEventListener('click',e=>{e.preventDefault();interactOrWalk(b);});
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();interactOrWalk(b);}});
    if (!b.isStats) {
      el.querySelector('.bl-name').addEventListener('dblclick',e=>{
        e.preventDefault(); e.stopPropagation(); startRename(b, el.querySelector('.bl-name'));
      });
    }
    wrap.appendChild(el); b.labelEl=el;
  });
}

function applyRenames() {
  const saved=JSON.parse(localStorage.getItem('minicityRenames')||'{}');
  buildings.forEach(b=>{
    if(saved[b.id]&&b.labelEl) b.labelEl.querySelector('.bl-name').textContent=saved[b.id];
  });
}

function startRename(b, nameEl) {
  const current=nameEl.textContent;
  const input=document.createElement('input');
  input.className='bl-rename-input'; input.value=current; input.maxLength=16;
  nameEl.replaceWith(input); input.focus(); input.select();
  const finish=()=>{
    const val=input.value.trim()||current;
    const span=document.createElement('span');
    span.className='bl-name'; span.textContent=val;
    span.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation();startRename(b,span);});
    input.replaceWith(span);
    const saved=JSON.parse(localStorage.getItem('minicityRenames')||'{}');
    saved[b.id]=val; localStorage.setItem('minicityRenames',JSON.stringify(saved));
  };
  input.addEventListener('blur',finish);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter') input.blur();
    if(e.key==='Escape'){input.value=current; input.blur();}
  });
}

// ── Events ────────────────────────────────────────────────────────────────────
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

  document.getElementById('mapToggle').addEventListener('click',toggleMapMode,{signal});
  setupRenderSettings(signal);
  document.getElementById('renderSettingsClose').addEventListener('click',closeRenderSettings,{signal});
  document.getElementById('mapClose').addEventListener('click',()=>mapMode&&toggleMapMode(),{signal});
  document.querySelector('.you-block').addEventListener('click',onYouClick,{signal});
  document.getElementById('fsToggle').addEventListener('click',()=>{
    if(document.fullscreenElement){
      document.exitFullscreen().catch(()=>{});
    }else{
      document.documentElement.requestFullscreen().catch(()=>{});
    }
  },{signal});
  document.getElementById('mapOverlay').addEventListener('click',e=>{
    if(e.target.id==='mapOverlay'&&mapMode)toggleMapMode();
  },{signal});
  document.getElementById('mapTipClose').addEventListener('click',closeMapTip,{signal});
  document.getElementById('mapTipTele').addEventListener('click',()=>{
    if(!mapTipB||!teleportUnlocked())return;
    const b=mapTipB;
    closeMapTip();
    toggleMapMode();
    mapTeleport(b);
  },{signal});

  document.getElementById('spClose').addEventListener('click',closeStatsPanel,{signal});
  document.getElementById('spModeClean').addEventListener('click',()=>setStatsMode('clean'),{signal});
  document.getElementById('spModeRaw').addEventListener('click',()=>setStatsMode('raw'),{signal});
  document.getElementById('worksClose').addEventListener('click',closeWorksPanel,{signal});
  // 作品详细内容板块暂时注释；保留可选绑定，恢复 HTML 后即可继续工作。
  document.getElementById('workDetailClose')?.addEventListener('click',closeWorkDetail,{signal});
  document.getElementById('workStar')?.addEventListener('click',toggleWorkStar,{signal});
  document.getElementById('workCommentsTab')?.addEventListener('click',loadWorkComments,{signal});
  document.getElementById('workDerivatives')?.addEventListener('click',loadWorkDerivatives,{signal});
  document.getElementById('workSupport')?.addEventListener('click',toggleWorkSupport,{signal});
  document.getElementById('workSupporters')?.addEventListener('click',loadWorkSupporters,{signal});
  document.getElementById('workCommentForm')?.addEventListener('submit',postWorkComment,{signal});
  document.addEventListener('keydown',e=>{
      if(e.key==='Escape'){
        if(mapMode){toggleMapMode();return;}
       closeRenderSettings();closeStatsPanel();closeWorksPanel();closeModal();closeNpcDialog();
    }
  },{signal});

  document.getElementById('loginBtn').addEventListener('click',doLogin,{signal});
  document.getElementById('loginInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();},{signal});
  document.getElementById('loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();},{signal});
  document.getElementById('logoUser').addEventListener('click',e=>{
    if((e.currentTarget as HTMLElement).classList.contains('login-required')) showLogin();
  },{signal});

  window.addEventListener('resize',()=>{
    renderer.setSize(window.innerWidth,window.innerHeight);
    updateCameraProjection(cameraZoom);
    if(mapMode) updateMapImage();
  },{signal});
}

function isStoryLockedBuilding(building) { return STORY_LOCKED_BUILDINGS.has(building.id); }

function applyStoryLockedBuildings() {
  buildings.filter(isStoryLockedBuilding).forEach((building) => {
    building.group.userData.storyLocked = true;
    if (building.labelEl) { building.labelEl.hidden = true; building.labelEl.tabIndex = -1; }
    // Keep the locked landmark in the city, but make its material read as
    // abandoned without mutating materials shared by other buildings.
    building.group.traverse((object) => {
      if (!object.isMesh) return;
      const hasMaterialArray = Array.isArray(object.material);
      const materials = hasMaterialArray ? object.material : [object.material];
      const lockedMaterials = materials.map((material) => {
        const lockedMaterial = material.clone();
        lockedMaterial.color?.multiplyScalar(0.48);
        if ('roughness' in lockedMaterial) lockedMaterial.roughness = Math.max(lockedMaterial.roughness, 0.9);
        if ('metalness' in lockedMaterial) lockedMaterial.metalness = Math.min(lockedMaterial.metalness, 0.05);
        if (lockedMaterial.emissive) lockedMaterial.emissive.setHex(0x000000);
        lockedMaterial.emissiveIntensity = 0;
        return lockedMaterial;
      });
      object.material = hasMaterialArray ? lockedMaterials : lockedMaterials[0];
    });
  });
}

function addEchoObservatoryLabel() { echoObservatoryGuide = createEchoObservatoryGuide(document, () => { if (echoStory.state().nodeId === 'confrontation-active') { teleportFromEchoCabin(); return; } movePlayerTo(new THREE.Vector3(ECHO_OBSERVATORY_AREA.linche[0], 0, ECHO_OBSERVATORY_AREA.linche[1])); }); echoStory.announceGuide(); echoStory.syncWorldInteractions(); echoStory.syncActiveActors(); }
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
    const id=raycastUserData(hits[0].object,'buildingId');
    const b=buildings.find(x=>x.id===id && !isStoryLockedBuilding(x));
    if(b&&b!==hoveredB){if(hoveredB)unhover(hoveredB);hover(b);}
    if(!b&&hoveredB){unhover(hoveredB);hoveredB=null;}
  } else{if(hoveredB)unhover(hoveredB);hoveredB=null;}
}

// ── Multiplayer ────────────────────────────────────────────────────────────────
function setupMultiplayerUI() { multiplayerHousing.setupUI(); }
function setupMultiplayer(nickname, password) { multiplayerHousing.connect(nickname, password); }
function updateRemotePlayers(delta) { multiplayerHousing.updateRemotePlayers(delta); }
function setPhoneOpen(open) { multiplayerHousing?.setPhoneOpen(open); }
function renderMapHouseTags() { multiplayerHousing.renderMapHouseTags(); }
function openResidence(residenceId) { multiplayerHousing.openResidence(residenceId); }
function closeResidencePanel() { multiplayerHousing.closeResidencePanel(); }
function navigateToResidence(residenceId) { multiplayerHousing.navigateToResidence(residenceId); }
function raycastUserData(object, key) { return multiplayerHousing.raycastUserData(object, key); }

function onCanvasClick() {
  if (cityDialogs?.isOpen()) return;
  raycaster.setFromCamera(mouse2D,camera);
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
    const b=buildings.find(x=>x.id===raycastUserData(hits[0].object,'buildingId') && !isStoryLockedBuilding(x));
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

// ── Hover / Navigate ──────────────────────────────────────────────────────────
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
  if (cityDialogs && echoStory.interactBuilding(b.id, cityDialogs)) { trackInteraction(b.id); return; }
  if (b.isStats) { openStatsPanel(); trackInteraction('stats'); return; }
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
  echoStory.announceGuide();
  const night = gameClock>=19 || gameClock<6;
  if (night!==isNight) {
    isNight=night;
    document.body.classList.toggle('night',isNight);
    document.body.classList.toggle('day',!isNight);
    applyTheme(isNight,false);
    setTimeout(()=>{ mapShotData=null; captureMapShot(); if(mapMode)updateMapImage(); },1000); // 昼夜切换后重拍全景
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
  buildings.filter((building) => !isStoryLockedBuilding(building)).forEach(b=>{
    if(!b.labelEl)return;
    labelWorldPosition.copy(b.group.position);
    labelWorldPosition.y=b.group.position.y+b.labelY;
    labelWorldPosition.project(camera);
    b.labelEl.style.transform=`translate3d(${(labelWorldPosition.x*0.5+0.5)*window.innerWidth}px,${((-labelWorldPosition.y)*0.5+0.5)*window.innerHeight}px,0) translate(-50%,-50%)`;
  });
  residences.forEach(residence=>{
    if(!residence.labelEl)return;
    labelWorldPosition.copy(residence.group.position);
    labelWorldPosition.y=residence.group.position.y+2.45;
    labelWorldPosition.project(camera);
    residence.labelEl.style.transform=`translate3d(${(labelWorldPosition.x*0.5+0.5)*window.innerWidth}px,${((-labelWorldPosition.y)*0.5+0.5)*window.innerHeight}px,0) translate(-50%,-50%)`;
  });
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop() {
  animationFrame = requestAnimationFrame(loop);
  const now=performance.now();
  const delta=Math.min((now-lastFrameTime)/1000,0.05);
  lastFrameTime=now;
  updatePlayerMovement(delta);
  updateRemotePlayers(delta);
  npcList.forEach(npc=>{
    if(!npc.mesh.visible||npc.walking===false) return;
    npcYieldToPlayer(npc);
  });
  updateCameraFollow(delta);
  sceneInterestPoints?.update(now/1000);
  updateLabels();
  renderer.render(scene,camera);
  if(mapMode) updateMapMarker(); // 玩家走动时同步地图上的位置标记
}

function toggleMapMode() {
  mapMode=!mapMode;
  const btn=document.getElementById('mapToggle');
  btn&&btn.classList.toggle('active',mapMode);
  const overlay=document.getElementById('mapOverlay');
  if(mapMode){
    overlay.classList.add('show');
    updateMapImage();
  }else{
    overlay.classList.remove('show');
    closeMapTip();
  }
}

// ── 全景地图：启动时俯视渲染一张真实截图，纸上只标注玩家位置 ──────────────────
function captureMapShot() {
  if(!scene)return;
  if(!mapShotCam){
    mapShotCam=new THREE.OrthographicCamera(
      -MAP_SHOT_SPAN,MAP_SHOT_SPAN,MAP_SHOT_SPAN,-MAP_SHOT_SPAN,0.1,130);
    mapShotCam.position.set(MAP_SHOT_CENTER_X,90,0);
    mapShotCam.up.set(0,0,1); // 图像顶端=北
    mapShotCam.lookAt(MAP_SHOT_CENTER_X,0,0);
    mapShotCam.updateProjectionMatrix();
  }
  if(!mapShotRenderer){
    const cv=document.createElement('canvas');
    cv.width=MAP_SHOT; cv.height=MAP_SHOT;
    mapShotRenderer=new THREE.WebGLRenderer({canvas:cv,antialias:true,preserveDrawingBuffer:true});
    mapShotRenderer.setSize(MAP_SHOT,MAP_SHOT,false);
    mapShotRenderer.setPixelRatio(1);
    mapShotRenderer.toneMapping=THREE.ACESFilmicToneMapping;
    mapShotRenderer.toneMappingExposure=1.0;
    if(THREE.SRGBColorSpace) mapShotRenderer.outputColorSpace=THREE.SRGBColorSpace;
  }
  // The satellite town lives south of the main city (z>=44). Keep it off the
  // overview map so the paper only shows the main city.
  const hiddenSatellite=[];
  scene.traverse(obj=>{
    const p=new THREE.Vector3();
    obj.getWorldPosition(p);
    if(p.z>=44&&obj.isMesh&&obj.visible){
      hiddenSatellite.push(obj);
      obj.visible=false;
    }
  });
  mapShotRenderer.render(scene,mapShotCam);
  hiddenSatellite.forEach(obj=>{ obj.visible=true; });
  mapShotData=mapShotRenderer.domElement.toDataURL('image/png');
  mapShotRenderer.dispose();
  mapShotRenderer.forceContextLoss();
  mapShotRenderer=null;
}

function updateMapImage() {
  const image=document.getElementById('mapImage');
  if(!image)return;
  renderMapIcons();
  if(!mapShotData)captureMapShot();
  if(mapShotData&&image.src!==mapShotData)image.src=mapShotData;
  updateMapMarker();
}

function updateMapMarker() {
  const marker=document.getElementById('mapMarker');
  if(!marker||!cursorChar)return;
  const left=((cursorChar.position.x-MAP_SHOT_CENTER_X+MAP_SHOT_SPAN)/(2*MAP_SHOT_SPAN))*100;
   const top=((MAP_SHOT_SPAN-cursorChar.position.z)/(2*MAP_SHOT_SPAN))*100;
  marker.style.left=clamp(left,0,100)+'%';
  marker.style.top=clamp(top,0,100)+'%';
}

// ── 地图图标：建筑只标小图标，点击弹小介绍 ────────────────────────────────────
function renderMapIcons() {
  const wrap=document.getElementById('mapIcons');
  if(!wrap||mapIconsBuilt)return;
  mapIconsBuilt=true;
  buildings.filter((building) => !isStoryLockedBuilding(building)).forEach(b=>{
    const el=document.createElement('button');
    el.type='button';
    el.className='map-icon';
    el.dataset.buildingId=b.id;
    el.title=b.label;
    el.innerHTML=b.icon;
    el.style.left=((b.group.position.x-MAP_SHOT_CENTER_X+MAP_SHOT_SPAN)/(2*MAP_SHOT_SPAN)*100)+'%';
     el.style.top=((MAP_SHOT_SPAN-b.group.position.z)/(2*MAP_SHOT_SPAN)*100)+'%';
    el.addEventListener('click',()=>openMapTip(b));
    wrap.appendChild(el);
  });
  renderMapHouseTags();
}

function teleportUnlocked() {
  const s=getStats();
  return (s.achievements||[]).includes('walker_100');
}

function openMapTip(b) {
  mapTipB=b;
  const content=BUILDING_CONTENT[b.id];
  document.getElementById('mapTipTitle').textContent=content?content.name:b.label;
  document.getElementById('mapTipSlogan').textContent=content?content.slogan:'这座小城的一角。';
  const unlocked=teleportUnlocked();
  document.getElementById('mapTipTele').disabled=!unlocked;
  document.getElementById('mapTipLock').classList.toggle('hidden',unlocked);
  document.getElementById('mapTip').classList.add('open');
}

function closeMapTip() {
  mapTipB=null;
  document.getElementById('mapTip').classList.remove('open');
}

function mapTeleport(b) {
  if(!cursorChar)return;
  const q=buildingRoadEntry(b.group.position);
  if(q){
    playerPath=[];
    cursorChar.position.set(q.x,0,q.z);
    setCameraTarget(q.x,q.z,true);
  }else{
    movePlayerTo(b.group.position);
  }
}

function updateCameraFollow(_delta) {
  if(!cursorChar||mapMode)return;
  const insideLegacyEchoCabin = Math.abs(cursorChar.position.x - 110) <= 15
    && Math.abs(cursorChar.position.z) <= 11;
  // Keep compatibility with saves from the old isolated cabin, but do not
  // hijack a normal world position near x=110 when the story is inactive.
  if (insideLegacyEchoCabin && (echoInteriorView || ECHO_CABIN_NODES.has(echoStory.state().nodeId))) {
    if (echoStory.state().nodeId === 'confrontation-active') teleportFromEchoCabin();
    else teleportToEchoCabin();
    return;
  }
  const insideEchoCabin = echoCabinNavigation
    ? echoCabinNavigation.contains(cursorChar.position, 0.8)
    : Math.abs(cursorChar.position.x - ECHO_OBSERVATORY_AREA.interior[0]) <= 14.5
      && Math.abs(cursorChar.position.z - ECHO_OBSERVATORY_AREA.interior[1]) <= 10.2;
  if (insideEchoCabin && echoStory.state().nodeId === 'confrontation-active') {
    teleportFromEchoCabin();
    return;
  }
  if (insideEchoCabin && !echoInteriorView) {
    setEchoInteriorView(true);
  }
  if (!insideEchoCabin && echoInteriorView) {
    setEchoInteriorView(false);
  }
  if (echoInteriorView) {
    // Follow the player as the look-at point. The camera anchor itself remains
    // inside the room, so edge movement cannot push the camera through a wall.
    setCameraTarget(cursorChar.position.x, cursorChar.position.z, true);
    return;
  }
  const p=cursorChar.position;
  // The camera looks directly at the player every frame, keeping the local
  // character projected at the exact viewport center while walking.
  setCameraTarget(p.x,p.z,true);
}

function setCameraTarget(x,z,instant) {
  const nx=x, nz=z;
  const applyCameraPose = () => {
    if (echoInteriorView) {
      const cx = ECHO_OBSERVATORY_AREA.interior[0];
      const cz = ECHO_OBSERVATORY_AREA.interior[1];
      camera.position.set(
        cx + ECHO_INTERIOR_CAMERA_ANCHOR.x,
        ECHO_INTERIOR_CAMERA_ANCHOR.y,
        cz + ECHO_INTERIOR_CAMERA_ANCHOR.z,
      );
      echoInteriorLookAt.set(cameraTarget.x, 0.75, cameraTarget.z);
      camera.lookAt(echoInteriorLookAt);
      return;
    }
    const echoDistance = Math.hypot(
      cameraTarget.x - ECHO_OBSERVATORY_AREA.center[0],
      cameraTarget.z - ECHO_OBSERVATORY_AREA.center[1],
    );
    // Ease into a camera placed on the road-facing (south-west) side of the
    // echo house. The global north-east offset otherwise lands behind its roof
    // and produces the cutaway/occluded view reported in the story area.
    const t = Math.max(0, Math.min(1, (30 - echoDistance) / 12));
    echoCameraOffset.copy(CAMERA_OFFSET).lerp(ECHO_EXTERIOR_CAMERA_OFFSET, t);
    camera.position.copy(cameraTarget).add(echoCameraOffset);
    camera.lookAt(cameraTarget);
  };
  if(instant){
    gsap.killTweensOf(cameraTarget);
    cameraTarget.set(nx,0,nz);
    applyCameraPose();
    return;
  }
  gsap.to(cameraTarget,{x:nx,z:nz,duration:0.55,ease:'power2.out',onUpdate:()=>{
    applyCameraPose();
  }});
}

function updateCameraProjection(vs) {
  const a=window.innerWidth/window.innerHeight;
  camera.left=-vs*a; camera.right=vs*a; camera.top=vs; camera.bottom=-vs;
  camera.updateProjectionMatrix();
}

function movePlayerTo(target) {
  if(!cursorChar||cityDialogs?.isOpen())return;
  cursorChar.visible=true;
  if (echoInteriorView) {
    playerPath = echoCabinNavigation
      ? echoCabinNavigation.buildPath(cursorChar.position, target)
      : [new THREE.Vector3(
        clamp(target.x, ECHO_OBSERVATORY_AREA.interior[0] - 14, ECHO_OBSERVATORY_AREA.interior[0] + 14),
        0,
        clamp(target.z, ECHO_OBSERVATORY_AREA.interior[1] - 9.5, ECHO_OBSERVATORY_AREA.interior[1] + 9.5),
      )];
    return;
  }
  playerPath = buildRoadPath(cursorChar.position, target);
}

function updatePlayerMovement(delta) {
  if(!cursorChar||!playerPath.length){
    if (echoInteriorView && echoCabinNavigation) {
      cursorChar?.position.copy(echoCabinNavigation.clampToWalkable(cursorChar.position));
    }
    if(pendingBuilding && cursorChar){
      const b=pendingBuilding;
      const distance=Math.hypot(cursorChar.position.x-b.group.position.x,cursorChar.position.z-b.group.position.z);
      if(distance<=CONFIG.buildingInteractRadius){ pendingBuilding=null; navigateTo(b); }
    }
    if(pendingSceneInterestPoint && cursorChar){
      const id=pendingSceneInterestPoint;
      const entity=sceneInterestPoints?.entities.get(id);
      if(entity){
        const distance=Math.hypot(
          cursorChar.position.x-entity.interactionPosition.x,
          cursorChar.position.z-entity.interactionPosition.z,
        );
        if(distance<=3.5){ pendingSceneInterestPoint=null; void sceneInterestPointController?.interact(id); }
      }
    }
    return;
  }
  if(cityDialogs?.isOpen()){ playerPath=[]; return; }
  const target=playerPath[0];
  const dx=target.x-cursorChar.position.x, dz=target.z-cursorChar.position.z;
  const dist=Math.hypot(dx,dz);
  const step=CONFIG.playerSpeed*delta;
  if(dist<=step){
    cursorChar.position.set(target.x,0,target.z);
    playerPath.shift();
    return;
  }
  cursorChar.position.x+=dx/dist*step;
  cursorChar.position.z+=dz/dist*step;
  cursorChar.position.y=0;
  // Keep the player and visible NPCs from occupying the same spot.
  npcList.forEach(npc=>{
    if(!npc.mesh.visible) return;
    const ox=cursorChar.position.x-npc.mesh.position.x;
    const oz=cursorChar.position.z-npc.mesh.position.z;
    const d=Math.hypot(ox,oz), minD=0.42;
    if(d>0 && d<minD){
      const push=(minD-d)/d;
      cursorChar.position.x+=ox*push;
      cursorChar.position.z+=oz*push;
    }
  });
  if (echoInteriorView && echoCabinNavigation) {
    // NPC separation can nudge the player off the planned visibility path;
    // project that nudge back into the walkable room/furniture envelope.
    cursorChar.position.copy(echoCabinNavigation.clampToWalkable(cursorChar.position));
  }
  cursorChar.rotation.y=Math.atan2(dx,dz);
  multiplayerHousing?.sendLocalPosition({x:cursorChar.position.x,y:cursorChar.position.y,z:cursorChar.position.z,rotation:cursorChar.rotation.y}, performance.now());
  pendingDistance+=step;
  if(pendingDistance>=10){ const d=Math.floor(pendingDistance); pendingDistance-=d; flushDistance(d); }
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
  satelliteCity: SATELLITE_CITY, echoObservatoryArea: ECHO_OBSERVATORY_AREA,
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
  checkUnlocks(s);
  checkAchievements();
  const transition=questRuntime.dispatch({
    id:`building:${buildingId}:${Date.now()}:${questEventSequence++}`,
    type:'building.visited',
    buildingId,
    at:Date.now(),
  });
  echoObservatoryGuide?.update(camera);
  const ready=transition.changes.find(change=>change.type==='quest.ready');
  if(ready){
    const quest=SIDE_QUESTS.find(item=>item.id===ready.questId);
    if(quest)showUnlockToast(`任务可交付 · ${quest.title}`);
  }
}

function updateWelcome() {
  // Cloud progression owns the unique-building threshold and inventory entry.
}

function checkUnlocks(s) {
  const current=s.unlockLevel||0;
  for(let i=current;i<UNLOCK_TIERS.length;i++){
    if(s.interactions>=UNLOCK_TIERS[i].threshold){
      UNLOCK_TIERS[i].fn();
      s.unlockLevel=i+1; saveStats(s);
      showUnlockToast(UNLOCK_TIERS[i].label);
    } else break;
  }
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

function checkLogin() {
  const overlay=document.getElementById('loginOverlay');
  const name=localStorage.getItem('minicityUser');
  overlay.style.display='none';
  if(name) applyUsername(name);
  else showLoginEntry();
  if(shouldShowCG()) startCG();
  else if(name) proceedToCity();
  else showLogin();
}

function showLogin() {
  const overlay=document.getElementById('loginOverlay');
  overlay.style.display='flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.remove('hidden')));
  setTimeout(()=>document.getElementById('loginInput').focus(),300);
}

async function doLogin() {
  const input=document.getElementById('loginInput');
  const passwordInput=document.getElementById('loginPassword');
  const errorEl=document.getElementById('loginError');
  const name=(input.value||'').trim();
  const password=passwordInput?.value||'';
  const showError=(msg:string)=>{ if(!errorEl)return; errorEl.textContent=msg; errorEl.hidden=!msg; };
  if(!name||name.length<2){ showError('昵称至少需要两个字'); return; }
  if(!/^[\p{L}\p{N}]{2,40}$/u.test(name)){ showError('昵称只能使用中文、英文和数字，不能包含空格或特殊字符'); return; }
  if(!password){ showError('请输入密码'); return; }
  showError('');
  localStorage.setItem('minicityUser',name);
  // Keep the password in memory only; persistent credentials are a security risk.
  const s=getStats();
  if(!s.joinDate){s.joinDate=Date.now();saveStats(s);}
  getUserId();
  applyUsername(name);
  checkAchievements();
  const overlay=document.getElementById('loginOverlay');
  overlay.classList.add('hidden');
  setTimeout(()=>{
    overlay.style.display='none';
    proceedToCity(name, password);
  },550);
}

function applyUsername(name) {
  const el=document.getElementById('logoUser');
  if(!el)return;
  el.textContent='— '+name;
  el.classList.remove('login-required');
  el.setAttribute('aria-label',`${name}，已登录`);
  el.setAttribute('tabindex','-1');
}

function showLoginEntry() {
  const el=document.getElementById('logoUser');
  if(!el)return;
  el.textContent='登录';
  el.classList.add('login-required');
  el.setAttribute('aria-label','登录');
  el.removeAttribute('tabindex');
}

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

function openStatsPanel() {
  renderStats();
  document.getElementById('statsPanel').classList.add('open');
}
function closeStatsPanel() {
  document.getElementById('statsPanel').classList.remove('open');
}
function setStatsMode(mode) {
  statsMode=mode;
  document.getElementById('spModeClean').classList.toggle('active',mode==='clean');
  document.getElementById('spModeRaw').classList.toggle('active',mode==='raw');
  renderStats();
}
function renderStats() {
  statsMode==='clean' ? renderClean() : renderRaw();
}

function renderClean() {
  const s=getStats();
  const level=calcLevel(s.interactions);
  const name=localStorage.getItem('minicityUser')||'visitor';
  const since=s.joinDate?formatDate(s.joinDate):'today';
  const time=parseInt(localStorage.getItem('minicityTime')||'0');
  const visited=(s.buildingsVisited||[]).length;
  const totalBuildings=BUILDING_DEFS.length;

  const nextTier=UNLOCK_TIERS.find(t=>s.interactions<t.threshold);
  const prevThresh=UNLOCK_TIERS.slice().reverse().find(t=>s.interactions>=t.threshold)?.threshold||0;
  const nextThresh=nextTier?.threshold||UNLOCK_TIERS[UNLOCK_TIERS.length-1].threshold;
  const pct=nextTier?Math.min(100,Math.round(((s.interactions-prevThresh)/(nextThresh-prevThresh))*100)):100;

  const unlockRows=UNLOCK_TIERS.map(t=>{
    const done=s.interactions>=t.threshold;
    return `<div class="sp-ul-item${done?' done':''}">
      <span class="sp-ul-dot">${done?'✓':'○'}</span>
      <span class="sp-ul-name">${t.label}</span>
      <span class="sp-ul-thresh">${t.threshold} visits</span>
    </div>`;
  }).join('');

  const achList=s.achievements||[];
  const achRows=ACHIEVEMENTS.map(a=>{
    const done=achList.includes(a.id);
    return `<div class="sp-ul-item${done?' done':''}" title="${a.desc}">
      <span class="sp-ul-dot">${done?'★':'☆'}</span>
      <span class="sp-ul-name">${a.name}</span>
      <span class="sp-ul-thresh">${done?a.desc:'未达成'}</span>
    </div>`;
  }).join('');

  const body = document.getElementById('spBody');
  if (!body) return;
  body.innerHTML=`
    <div class="sp-user-row">
      <div class="sp-username"></div>
      <div class="sp-level">LVL ${level}</div>
    </div>
    <div class="sp-since">citizen since ${since}</div>
    <div class="sp-cards">
      <div class="sp-card"><div class="sc-val">${formatTime(time)}</div><div class="sc-lbl">TIME IN CITY</div></div>
      <div class="sp-card"><div class="sc-val">${s.interactions}</div><div class="sc-lbl">INTERACTIONS</div></div>
      <div class="sp-card"><div class="sc-val">${visited}&thinsp;/&thinsp;${totalBuildings}</div><div class="sc-lbl">BUILDINGS VISITED</div></div>
      <div class="sp-card"><div class="sc-val">${Math.round(s.distance||0)}</div><div class="sc-lbl">DISTANCE WALKED</div></div>
    </div>
    <div class="sp-prog-section">
      ${nextTier
        ?`<div class="sp-prog-label">NEXT UNLOCK <span>${s.interactions}&thinsp;/&thinsp;${nextThresh} visits</span></div>
           <div class="sp-prog-track"><div class="sp-prog-fill" style="width:${pct}%"></div></div>`
        :`<div class="sp-prog-label sp-all-done">✓ all unlocks earned</div>`}
    </div>
    <div class="sp-unlocks">
      <div class="sp-ul-title">UNLOCK HISTORY</div>
      ${unlockRows}
    </div>
    <div class="sp-unlocks">
      <div class="sp-ul-title">ACHIEVEMENTS · ${achList.length}&thinsp;/&thinsp;${ACHIEVEMENTS.length}</div>
      ${achRows}
    </div>`;
  body.querySelector('.sp-username')?.replaceChildren(document.createTextNode(name));
}

function renderRaw() {
  const s=getStats();
  const uid=getUserId();
  const name=localStorage.getItem('minicityUser')||'visitor';
  const time=parseInt(localStorage.getItem('minicityTime')||'0');
  const visited=(s.buildingsVisited||[]).length;
  const joined=s.joinDate?new Date(s.joinDate).toISOString().split('T')[0]:new Date().toISOString().split('T')[0];
  const level=calcLevel(s.interactions);

  const F=20, V=17;
  const sep='+'+'-'.repeat(F+2)+'+'+'-'.repeat(V+2)+'+';
  const hdr='| '+('field').padEnd(F)+' | '+('value').padEnd(V)+' |';
  const row=(f,v)=>'| '+String(f).padEnd(F)+' | '+String(v).padEnd(V)+' |';

  const table=[sep,hdr,sep,
    row('user_id',uid),
    row('username',name),
    row('joined',joined),
    row('time_spent',time+'s'),
    row('interactions',s.interactions),
    row('buildings_visited',visited),
    row('city_level',level),
    row('unlocks_earned',s.unlockLevel||0),
    row('distance_walked',Math.round(s.distance||0)),
    row('achievements',(s.achievements||[]).length+'/'+ACHIEVEMENTS.length),
    row('npcs_met',(s.npcsMet||[]).length+'/'+NPC_PROFILES.length),
  sep].join('\n');

  const content=`> SELECT * FROM city_stats\n  WHERE user_id = '${uid}';\n\n${table}\n\n1 row in set (0.001 sec)\n\n> _`;
  const body = document.getElementById('spBody');
  if (!body) return;
  const pre = document.createElement('pre');
  pre.className = 'sp-raw';
  pre.textContent = content;
  body.replaceChildren(pre);
}

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
  if (npc.profile.id === 'linche' && ECHO_CABIN_NODES.has(echoStory.state().nodeId) && cursorChar) {
    const distanceToInterior = Math.hypot(cursorChar.position.x - ECHO_OBSERVATORY_AREA.interior[0], cursorChar.position.z - ECHO_OBSERVATORY_AREA.interior[1]);
    if (distanceToInterior > 20) teleportToEchoCabin();
  }
  if (cityDialogs && echoStory.interact(npc.profile.id, cityDialogs)) {
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
      else showLogin();
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
  mapShotRenderer?.dispose();
  mapShotRenderer?.forceContextLoss();
  mapShotRenderer=null;
  renderer?.dispose();
  renderer?.forceContextLoss();
  sceneInterestPoints?.dispose();
  scene?.clear();
  resources.dispose();
  buildingPlotTargets.length=0;
  sceneInterestPoints=null;
  sceneInterestPointController=null;
  echoCabinNavigation=null;
  echoInteriorView=false;
  echoExteriorCameraZoom=7;
  pendingSceneInterestPoint=null;
  document.getElementById('labelsWrap')?.replaceChildren();
  document.getElementById('mapIcons')?.replaceChildren();
  echoObservatoryGuide?.dispose();
  echoObservatoryGuide = null;
}
