/* MiniCity — main.js */
'use strict';

const MOBILE  = () => window.innerWidth <= 680;
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ── Palette ───────────────────────────────────────────────────────────────────
const P = {
  DAY_BG:         0xF9F8F6,  NIGHT_BG:       0xD4D3CE,
  DAY_GROUND:     0xF2F1EE,  NIGHT_GROUND:   0xC4C3BE,
  DAY_PATH:       0xE8E7E4,  NIGHT_PATH:     0xBCBBB6,
  BUILDING_WHITE: 0xFFFFFF,  BUILDING_BASE:  0xEAE9E6,
  ROOF_RIM:       0xF8F7F5,  BLUE:           0x3B6FE0,
  FOUNTAIN_RIM:   0xECEBE8,  FOUNTAIN_WATER: 0xC8DAFC,
};

// ── Globals ───────────────────────────────────────────────────────────────────
let renderer, scene, camera, groundMat;
const pathMats = [], lampGlobes = [], buildings = [], npcList = [];
let cursorChar = null;
let isNight    = localStorage.getItem('minicityTheme') === 'night';
let hoveredB   = null, mouseOnScene = false;
let currentFilter = 'bots';
let statsMode = 'clean';

const mouse2D     = new THREE.Vector2(-9999, -9999);
const raycaster   = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorWorld = new THREE.Vector3();

// ── Building config ───────────────────────────────────────────────────────────
const PLH = 0.3;

const BUILDING_DEFS = [
  { id:'about',       num:'01', label:'ABOUT',       url:'/about',       x: 0,    z:-7.5, shape:'tower',
    icon:`<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7"/></svg>` },
  { id:'projects',    num:'02', label:'PROJECTS',    url:'/projects',    x:-7.5,  z: 0,   shape:'campus',
    icon:`<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>` },
  { id:'experiments', num:'03', label:'EXPERIMENTS', url:'/experiments', x: 7.5,  z: 0,   shape:'lab',
    icon:`<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>` },
  { id:'contact',     num:'04', label:'CONTACT',     url:'/contact',     x: 0,    z: 7.5, shape:'pavilion',
    icon:`<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3,5 12,13 21,5"/></svg>` },
  { id:'stats', num:'05', label:'STATS', url:null, isStats:true, x:-5.5, z:-5.5, shape:'observatory',
    icon:`<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>` },
];

const WAYPOINTS = [
  new THREE.Vector3( 0,   0,-6), new THREE.Vector3( 0,   0,-4), new THREE.Vector3( 0,   0,-2),
  new THREE.Vector3( 0,   0, 0), new THREE.Vector3( 0,   0, 2), new THREE.Vector3( 0,   0, 4),
  new THREE.Vector3( 0,   0, 6), new THREE.Vector3(-6,   0, 0), new THREE.Vector3(-3.5, 0, 0),
  new THREE.Vector3(-1.5, 0, 0), new THREE.Vector3( 1.5, 0, 0), new THREE.Vector3( 3.5, 0, 0),
  new THREE.Vector3( 6,   0, 0), new THREE.Vector3(-1.2, 0,-1.2), new THREE.Vector3(1.2, 0,-1.2),
  new THREE.Vector3(-1.2, 0, 1.2), new THREE.Vector3(1.2, 0, 1.2),
];

// Progression unlock tiers — each spawns a new decoration when threshold is crossed
const UNLOCK_TIERS = [
  { threshold:2,  label:'a lamp post appeared',  fn: () => addLamps([[4.5,0,-6.8]]) },
  { threshold:5,  label:'a new tree sprouted',   fn: () => addTrees([[7.2,0,7.0]]) },
  { threshold:9,  label:'a stone arch revealed', fn: () => addArch(-5.5,0,5.8,-Math.PI/6) },
  { threshold:14, label:'a bench was placed',    fn: () => addBench(6.8,0,-1.5,Math.PI/3) },
];

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  setupRenderer(); setupCamera(); setupScene(); setupLighting();
  addGround(); addPaths(); addFountain();
  addBuildings(); addDecorations(); addCharacters();
  addLabels(); applyRenames();
  setupEvents(); setupFilter();
  applyTheme(isNight, true);
  initAnimations();
  entranceAnimation();
  startTimeTracking();
  checkLogin();
  requestAnimationFrame(loop);
}

// ── Renderer / Camera / Scene / Lighting (unchanged) ─────────────────────────
function setupRenderer() {
  const canvas = document.getElementById('c');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
}
function setupCamera() {
  const a = window.innerWidth/window.innerHeight, vs = 13;
  camera = new THREE.OrthographicCamera(-vs*a,vs*a,vs,-vs,0.1,200);
  camera.position.set(10,18,10); camera.lookAt(0,0,0);
}
function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(isNight ? P.NIGHT_BG : P.DAY_BG);
}
function setupLighting() {
  const amb = new THREE.AmbientLight(0xFAF8F4, isNight ? 0.60 : 1.05);
  amb.name = 'amb'; scene.add(amb);
  const dir = new THREE.DirectionalLight(0xFFFFFF, isNight ? 0.30 : 0.55);
  dir.name = 'dir'; dir.position.set(14,22,8); dir.castShadow = true;
  dir.shadow.mapSize.set(2048,2048);
  dir.shadow.camera.left=-22; dir.shadow.camera.right=22;
  dir.shadow.camera.top=22;   dir.shadow.camera.bottom=-22;
  dir.shadow.camera.near=0.5; dir.shadow.camera.far=70;
  dir.shadow.bias=-0.0006; dir.shadow.normalBias=0.02;
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xD8E8FF, 0.18);
  fill.position.set(-6,8,-6); scene.add(fill);
}
function addGround() {
  groundMat = stdMat({ color: isNight?P.NIGHT_GROUND:P.DAY_GROUND, roughness:1, metalness:0 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(70,70), groundMat);
  m.rotation.x = -Math.PI/2; m.receiveShadow = true; scene.add(m);
}

// ── Paths (+ diagonal to Stats building) ─────────────────────────────────────
function addPaths() {
  const col = isNight ? P.NIGHT_PATH : P.DAY_PATH;

  // Main cross roads
  [[1.7,0.03,20,0,0.015,0],[20,0.03,1.7,0,0.015,0]].forEach(([w,h,d,x,y,z]) => {
    const mat = stdMat({ color:col, roughness:1 });
    pathMats.push(mat);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,y,z); m.receiveShadow = true; scene.add(m);
  });

  // Diagonal branch to Stats building at (-5.5, 0, -5.5)
  // Runs from (-1.5,0,-1.5) to (-5.5,0,-5.5), length ≈ 5.66, rotated 45°
  const diagMat = stdMat({ color:col, roughness:1 });
  pathMats.push(diagMat);
  const diag = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.03,5.66), diagMat);
  diag.position.set(-3.5, 0.015, -3.5);
  diag.rotation.y = Math.PI/4;
  diag.receiveShadow = true;
  scene.add(diag);
}

// ── Fountain ──────────────────────────────────────────────────────────────────
function addFountain() {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(1.35,1.35,0.22,40), {color:P.FOUNTAIN_RIM,roughness:0.75}, [0,0,0], true);
  part(g, new THREE.CylinderGeometry(1.0,1.0,0.06,40), {color:P.FOUNTAIN_WATER,roughness:0.05,metalness:0.15}, [0,0.1,0], false);
  part(g, new THREE.CylinderGeometry(0.07,0.07,0.45,12), {color:0xD4D3D0,roughness:0.55}, [0,0.13,0], true);
  part(g, new THREE.SphereGeometry(0.11,16,16), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.25,roughness:0.2}, [0,0.69,0], false);
  scene.add(g);
}

// ── Building shapes ───────────────────────────────────────────────────────────
function tagMeshes(g, id) {
  g.traverse(c => { if (c.isMesh) c.userData.buildingId = id; });
}

// 01 ABOUT — tall elegant tower
function buildTower(cfg) {
  const g = new THREE.Group();
  const bw=1.85, bh=4.6;
  part(g, new THREE.BoxGeometry(2.55,PLH,2.55), {color:P.BUILDING_BASE,roughness:0.8}, [0,PLH/2,0]);
  const bodyMat = stdMat({color:P.BUILDING_WHITE,roughness:0.08});
  bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = PLH+bh;
  part(g, new THREE.BoxGeometry(bw+0.2,0.12,bw+0.2), {color:P.ROOF_RIM,roughness:0.4}, [0,top+0.06,0]);
  part(g, new THREE.BoxGeometry(1.1,0.72,1.1), {color:0xF9F8F6,roughness:0.06}, [0,top+0.12+0.36,0]);
  part(g, new THREE.BoxGeometry(1.22,0.08,1.22), {color:P.ROOF_RIM,roughness:0.4}, [0,top+0.12+0.72+0.04,0]);
  part(g, new THREE.CylinderGeometry(0.022,0.022,0.7,8), {color:0xD0CFCC,roughness:0.5}, [0,top+0.12+0.72+0.08+0.35,0]);
  const tipY = top+0.12+0.72+0.08+0.7+0.07;
  part(g, new THREE.SphereGeometry(0.07,12,12), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.4}, [0,tipY,0], false);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:tipY+0.5};
}

// 02 PROJECTS — wide campus with annex
function buildCampus(cfg) {
  const g = new THREE.Group();
  const mw=2.9, mh=2.1, md=2.1;
  part(g, new THREE.BoxGeometry(3.6,0.25,2.8), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.125,0]);
  const bodyMat = stdMat({color:P.BUILDING_WHITE,roughness:0.09});
  bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(mw,mh,md), bodyMat);
  body.position.y = 0.25+mh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const mainTop = 0.25+mh;
  part(g, new THREE.BoxGeometry(mw+0.18,0.1,md+0.18), {color:P.ROOF_RIM,roughness:0.5}, [0,mainTop+0.05,0]);
  const aw=1.05, ah=1.5, ad=1.85;
  const aX = -(mw/2-aw/2), aZ = md/2+ad/2;
  part(g, new THREE.BoxGeometry(aw,ah,ad), {color:0xFDFCFA,roughness:0.1}, [aX,0.25+ah/2,aZ]);
  part(g, new THREE.BoxGeometry(aw+0.14,0.08,ad+0.14), {color:P.ROOF_RIM,roughness:0.5}, [aX,0.25+ah+0.04,aZ]);
  [[-0.7,0.22],[0,0.18],[0.75,0.26]].forEach(([rx,rh]) => {
    part(g, new THREE.BoxGeometry(0.32,rh,0.32), {color:0xF0EFEC,roughness:0.3}, [rx,mainTop+0.1+rh/2,-0.5]);
  });
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:mainTop+0.7};
}

// 03 EXPERIMENTS — block + cylinder silo + stepped top
function buildLab(cfg) {
  const g = new THREE.Group();
  const bw=2.0, bh=2.8;
  part(g, new THREE.BoxGeometry(2.85,PLH,2.85), {color:P.BUILDING_BASE,roughness:0.8}, [0,PLH/2,0]);
  const bodyMat = stdMat({color:P.BUILDING_WHITE,roughness:0.08});
  bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const bodyTop = PLH+bh;
  part(g, new THREE.BoxGeometry(bw+0.18,0.1,bw+0.18), {color:P.ROOF_RIM,roughness:0.4}, [0,bodyTop+0.05,0]);
  part(g, new THREE.BoxGeometry(1.3,0.42,1.3), {color:0xF6F5F2,roughness:0.08}, [0,bodyTop+0.1+0.21,0]);
  part(g, new THREE.BoxGeometry(0.72,0.32,0.72), {color:0xFAF9F7,roughness:0.06}, [0,bodyTop+0.1+0.42+0.16,0]);
  const cylR=0.52, cylH=3.3;
  part(g, new THREE.CylinderGeometry(cylR,cylR,cylH,20), {color:0xF5F4F1,roughness:0.1}, [0.72,PLH+cylH/2,0.72]);
  part(g, new THREE.SphereGeometry(cylR,18,9,0,Math.PI*2,0,Math.PI/2), {color:0xEEEDEA,roughness:0.25}, [0.72,PLH+cylH,0.72], false);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:PLH+cylH+cylR+0.45};
}

// 04 CONTACT — wide block with cone roof
function buildPavilion(cfg) {
  const g = new THREE.Group();
  const bw=2.4, bh=2.3;
  part(g, new THREE.BoxGeometry(3.1,0.25,3.1), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.125,0]);
  const bodyMat = stdMat({color:P.BUILDING_WHITE,roughness:0.09});
  bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = 0.25+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const bodyTop = 0.25+bh;
  part(g, new THREE.BoxGeometry(bw+0.2,0.1,bw+0.2), {color:P.ROOF_RIM,roughness:0.5}, [0,bodyTop+0.05,0]);
  const coneH=1.05;
  part(g, new THREE.CylinderGeometry(0.08,1.38,coneH,24), {color:0xF0EFEC,roughness:0.35}, [0,bodyTop+0.1+coneH/2,0]);
  part(g, new THREE.SphereGeometry(0.1,12,12), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.3}, [0,bodyTop+0.1+coneH+0.1,0], false);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:bodyTop+0.1+coneH+0.6};
}

// 05 STATS — octagonal observatory with pulsing glow ring
function buildObservatory(cfg) {
  const g = new THREE.Group();
  // Octagonal plinth
  part(g, new THREE.CylinderGeometry(1.65,1.65,0.22,8), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.11,0]);
  // Octagonal body
  const bodyMat = stdMat({color:P.BUILDING_WHITE,roughness:0.08});
  bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.CylinderGeometry(1.1,1.22,2.1,8), bodyMat);
  body.position.y = 0.22+1.05; body.castShadow = body.receiveShadow = true; g.add(body);
  // Decorative mid band
  part(g, new THREE.CylinderGeometry(1.28,1.28,0.09,24), {color:P.ROOF_RIM,roughness:0.5}, [0,0.22+1.05,0]);
  const bodyTop = 0.22+2.1;
  // Roof rim
  part(g, new THREE.CylinderGeometry(1.3,1.3,0.1,24), {color:P.ROOF_RIM,roughness:0.4}, [0,bodyTop+0.05,0]);
  // Pulsing blue glow ring
  const glowMat = stdMat({color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.2,roughness:0.2});
  part(g, new THREE.CylinderGeometry(1.12,1.12,0.06,24), glowMat, [0,bodyTop+0.1+0.03,0], false);
  // Dome (upper hemisphere)
  const domeY = bodyTop+0.1+0.06;
  part(g, new THREE.SphereGeometry(1.1,20,10,0,Math.PI*2,0,Math.PI/2), {color:0xF8F7F5,roughness:0.06,metalness:0.05}, [0,domeY,0]);
  // Entrance disc
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.22+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  const labelY = domeY+1.1+0.5;
  return {...cfg, group:g, body, bodyMat, glowMat, labelEl:null, labelY};
}

const SHAPE_FNS = { tower:buildTower, campus:buildCampus, lab:buildLab, pavilion:buildPavilion, observatory:buildObservatory };

function addBuildings() {
  BUILDING_DEFS.forEach(cfg => {
    const b = SHAPE_FNS[cfg.shape](cfg);
    scene.add(b.group); buildings.push(b);
  });
}

// ── Decorations ───────────────────────────────────────────────────────────────
function addDecorations() {
  addTrees([[-4.2,0,-3.8],[3.6,0,-5.2],[4.2,0,3.4]]);
  addLamps([[-2.2,0,-3.0],[2.4,0,2.8]]);
  addBench(-3.9,0,2.4,0); addObelisk(3.3,0,-3.6); addSignpost(-4.0,0,-5.0);
  addTrees([[-6.2,0,-4.2],[6.5,0,-4.0],[-6.5,0,5.2],[6.0,0,5.8],[-3.0,0,6.5],[5.5,0,-7.0]]);
  addLamps([[-3.2,0,-1.8],[3.5,0,1.5],[-1.8,0,4.5]]);
  addArch(-5.5,0,-6.2,Math.PI/5);
  addSphereStack(5.2,0,5.0); addStoneRing(5.8,0,-5.5); addGazebo(5.8,0,5.9);
  addMonolith(-5.8,0,5.8,0.4); addSteppingStones(-4.5,0,3.5); addHedgeRow(4.5,0,-2.0);
  addPlanter(-2.8,0,-5.3); addPlanter(-2.0,0,-5.8);
  addBollards(2.0,0,-2.8); addBench(5.1,0,-1.8,Math.PI/2);
  addStackedColumn(-5.5,0,2.0); addWallSection(5.5,0,-2.0,0);
  addBushCluster(-4.8,0,-0.5); addPavers();
}

function addTrees(positions) {
  positions.forEach(([x,,z]) => {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.06,0.09,0.38,8), {color:0xE0DFDC,roughness:0.9}, [0,0.19,0]);
    part(g, new THREE.SphereGeometry(0.30,12,12), {color:0xF5F4F2,roughness:0.85}, [0,0.66,0]);
    g.position.set(x,0,z); scene.add(g);
  });
}
function addLamps(positions) {
  positions.forEach(([x,,z]) => {
    const g = new THREE.Group();
    part(g, new THREE.CylinderGeometry(0.04,0.04,1.15,8), {color:0xCDCCCA,roughness:0.7}, [0,0.575,0]);
    const gm = stdMat({color:0xF8F7F5,roughness:0.15,emissive:0xEEF0FF,emissiveIntensity:isNight?0.6:0.05});
    const globe = mk(new THREE.SphereGeometry(0.13,14,14),gm);
    globe.position.y=1.28; g.add(globe); lampGlobes.push(gm);
    g.position.set(x,0,z); scene.add(g);
  });
}
function addBench(x,y,z,rotY) {
  const g=new THREE.Group();
  part(g,new THREE.BoxGeometry(0.68,0.07,0.26),{color:0xEEEDEA,roughness:0.75},[0,0.17,0]);
  part(g,new THREE.BoxGeometry(0.68,0.20,0.05),{color:0xE2E1DE,roughness:0.8},[0,0.30,-0.105]);
  g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
}
function addObelisk(x,y,z) {
  const g=new THREE.Group();
  part(g,new THREE.BoxGeometry(0.42,0.13,0.42),{color:0xEAE9E6,roughness:0.75},[0,0.065,0]);
  part(g,new THREE.BoxGeometry(0.17,1.35,0.17),{color:0xF8F7F5,roughness:0.4},[0,0.13+0.675,0]);
  const tip=part(g,new THREE.ConeGeometry(0.13,0.28,4),{color:0xE6E5E2,roughness:0.5},[0,0.13+1.35+0.14,0]);
  tip.rotation.y=Math.PI/4; g.position.set(x,y,z); scene.add(g);
}
function addSignpost(x,y,z) {
  const g=new THREE.Group();
  part(g,new THREE.CylinderGeometry(0.03,0.03,0.9,8),{color:0xD0CFCC,roughness:0.8},[0,0.45,0]);
  part(g,new THREE.BoxGeometry(0.36,0.18,0.04),{color:0xF0EFEC,roughness:0.5},[0.18,0.72,0]);
  g.position.set(x,y,z); scene.add(g);
}
function addArch(x,y,z,rotY) {
  const g=new THREE.Group(), m={color:0xECEBE8,roughness:0.7};
  part(g,new THREE.BoxGeometry(0.4,0.10,1.9),m,[0,0.05,0],false);
  [-0.78,0.78].forEach(pz=>part(g,new THREE.BoxGeometry(0.22,1.55,0.22),m,[0,0.1+0.775,pz]));
  part(g,new THREE.BoxGeometry(0.22,0.24,1.78),m,[0,0.1+1.55+0.12,0]);
  g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
}
function addSphereStack(x,y,z) {
  const g=new THREE.Group(), m={color:0xF0EFEC,roughness:0.3};
  part(g,new THREE.BoxGeometry(0.52,0.14,0.52),{color:0xE0DFDC,roughness:0.75},[0,0.07,0]);
  let cy=0.14; [0.30,0.21,0.14].forEach(r=>{cy+=r;part(g,new THREE.SphereGeometry(r,14,14),m,[0,cy,0]);cy+=r;});
  g.position.set(x,y,z); scene.add(g);
}
function addStoneRing(x,y,z) {
  const m={color:0xE4E3E0,roughness:0.85};
  for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2;const s=part(null,new THREE.CylinderGeometry(0.10,0.13,0.48,8),m);s.position.set(x+Math.cos(a)*0.95,0.24,z+Math.sin(a)*0.95);s.castShadow=true;scene.add(s);}
}
function addGazebo(x,y,z) {
  const g=new THREE.Group();
  [[0.85,0.85],[-0.85,0.85],[0.85,-0.85],[-0.85,-0.85]].forEach(([cx,cz])=>part(g,new THREE.CylinderGeometry(0.08,0.08,1.4,10),{color:0xEDECE9,roughness:0.6},[cx,0.7,cz]));
  part(g,new THREE.BoxGeometry(2.1,0.1,2.1),{color:0xF0EFEC,roughness:0.5},[0,1.45,0]);
  const tip=part(g,new THREE.ConeGeometry(0.82,0.65,4),{color:0xE8E7E4,roughness:0.6},[0,1.5+0.325,0]);
  tip.rotation.y=Math.PI/4; g.position.set(x,y,z); scene.add(g);
}
function addMonolith(x,y,z,rotY) {
  const g=new THREE.Group();
  part(g,new THREE.BoxGeometry(0.65,0.12,0.65),{color:0xDFDEDB,roughness:0.8},[0,0.06,0]);
  part(g,new THREE.BoxGeometry(0.13,2.1,0.72),{color:0xF4F3F0,roughness:0.25},[0,0.12+1.05,0]);
  g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
}
function addSteppingStones(x,y,z) {
  [[0,0],[0.72,0.25],[1.42,0.42],[2.1,0.25],[2.78,-0.08]].forEach(([dx,dz])=>{
    const s=part(null,new THREE.CylinderGeometry(0.20,0.23,0.06,10),{color:0xE2E1DE,roughness:0.9});
    s.position.set(x+dx,0.03,z+dz); s.receiveShadow=true; scene.add(s);
  });
}
function addHedgeRow(x,y,z) {
  const g=new THREE.Group();
  [0,0.62,1.22].forEach((dx,i)=>{
    const r=0.30+i*0.02, h=0.55+i*0.08;
    const b=mk(new THREE.SphereGeometry(r,10,10),stdMat({color:0xECEBE8,roughness:0.9}));
    b.position.set(dx,h*0.55+0.05,0); b.scale.y=h; b.castShadow=true; g.add(b);
  });
  g.position.set(x,y,z); scene.add(g);
}
function addPlanter(x,y,z) {
  const g=new THREE.Group();
  part(g,new THREE.CylinderGeometry(0.20,0.15,0.30,12),{color:0xE4E3E0,roughness:0.8},[0,0.15,0]);
  part(g,new THREE.SphereGeometry(0.22,10,10),{color:0xEEEDEA,roughness:0.85},[0,0.48,0]);
  g.position.set(x,y,z); scene.add(g);
}
function addBollards(x,y,z) {
  [0,0.48,0.96,1.44].forEach(dx=>{
    const b=part(null,new THREE.CylinderGeometry(0.07,0.07,0.48,8),{color:0xD8D7D4,roughness:0.6});
    b.position.set(x+dx,0.24,z); b.castShadow=true; scene.add(b);
  });
}
function addStackedColumn(x,y,z) {
  const g=new THREE.Group();
  part(g,new THREE.CylinderGeometry(0.38,0.38,0.10,16),{color:0xE0DFDC,roughness:0.75},[0,0.05,0]);
  part(g,new THREE.CylinderGeometry(0.22,0.28,0.55,12),{color:0xEEEDEA,roughness:0.4},[0,0.10+0.275,0]);
  const mid=part(g,new THREE.CylinderGeometry(0.16,0.20,0.42,10),{color:0xF2F1EE,roughness:0.35},[0,0.65+0.21,0]);
  mid.rotation.y=0.4;
  part(g,new THREE.SphereGeometry(0.15,12,12),{color:0xF8F7F5,roughness:0.2},[0,0.65+0.42+0.15,0]);
  g.position.set(x,y,z); scene.add(g);
}
function addWallSection(x,y,z,rotY) {
  const g=new THREE.Group();
  part(g,new THREE.BoxGeometry(2.2,0.42,0.22),{color:0xE8E7E4,roughness:0.85},[0,0.21,0]);
  part(g,new THREE.BoxGeometry(2.2,0.1,0.28),{color:0xEEEDEB,roughness:0.7},[0,0.42+0.05,0]);
  g.position.set(x,y,z); g.rotation.y=rotY; scene.add(g);
}
function addBushCluster(x,y,z) {
  [[0,0,0.28],[0.5,0,0.24],[0.25,0,0.32]].forEach(([dx,,r])=>{
    const b=mk(new THREE.SphereGeometry(r,10,10),stdMat({color:0xEAE9E6,roughness:0.9}));
    b.position.set(x+dx,r*0.7,z); b.castShadow=true; scene.add(b);
  });
}
function addPavers() {
  [[-1.9,0,-1.9],[1.9,0,-1.9],[-1.9,0,1.9],[1.9,0,1.9]].forEach(([x,,z])=>{
    const p=mk(new THREE.BoxGeometry(0.6,0.04,0.6),stdMat({color:0xE4E3E0,roughness:0.9}));
    p.position.set(x,0.02,z); p.receiveShadow=true; scene.add(p);
  });
}

// ── Characters ────────────────────────────────────────────────────────────────
function makeCharacter(headHex, bodyHex) {
  const g=new THREE.Group();
  const shadow=mk(new THREE.CircleGeometry(0.17,16),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.11}));
  shadow.rotation.x=-Math.PI/2; shadow.position.y=0.012; g.add(shadow);
  const body=mk(new THREE.CylinderGeometry(0.10,0.13,0.30,12),stdMat({color:bodyHex,roughness:0.6}));
  body.position.y=0.15; body.castShadow=true; g.add(body);
  const head=mk(new THREE.SphereGeometry(0.135,14,14),stdMat({color:headHex,roughness:0.5}));
  head.position.y=0.43; head.castShadow=true; g.add(head);
  return g;
}
function addCharacters() {
  if (REDUCED) return;
  [{head:0xD4A574,body:0x8B9DBF,s:0},{head:0xC68642,body:0xC4C9D8,s:7},
   {head:0xFDBCB4,body:0x3B6FE0,s:12},{head:0x8D5524,body:0xC8C4BE,s:4}].forEach(d=>{
    const g=makeCharacter(d.head,d.body);
    const wp=WAYPOINTS[d.s]; g.position.set(wp.x,0,wp.z); scene.add(g);
    const npc={mesh:g,wpIdx:d.s}; npcList.push(npc);
    if (!MOBILE()) scheduleWalk(npc);
  });
  cursorChar=makeCharacter(0xA8C8F8,0x3B6FE0);
  cursorChar.visible=false; scene.add(cursorChar);
}
function scheduleWalk(npc) {
  let ni; do{ni=Math.floor(Math.random()*WAYPOINTS.length);}while(ni===npc.wpIdx);
  npc.wpIdx=ni;
  const from=npc.mesh.position.clone(), target=WAYPOINTS[ni];
  const dur=Math.max(1.2,from.distanceTo(target)/1.6)+Math.random()*0.8;
  gsap.to(npc.mesh.rotation,{y:Math.atan2(target.x-from.x,target.z-from.z),duration:0.35,ease:'power1.out'});
  gsap.to(npc.mesh.position,{x:target.x,z:target.z,duration:dur,ease:'power1.inOut',
    onComplete:()=>gsap.delayedCall(0.5+Math.random()*2.2,()=>scheduleWalk(npc))});
}

// ── Labels ────────────────────────────────────────────────────────────────────
function addLabels() {
  const wrap=document.getElementById('labelsWrap');
  buildings.forEach(b=>{
    const el=document.createElement('a');
    el.className='b-label-item'; el.href=b.url||'#'; el.tabIndex=0;
    el.setAttribute('aria-label',`${b.label}${b.isStats?' — open stats panel':' — navigate to '+b.id+' page'}`);
    el.innerHTML=`<span class="bl-num">${b.num}</span><span class="bl-icon">${b.icon}</span><span class="bl-name">${b.label}</span>`;
    el.addEventListener('click',e=>{e.preventDefault();navigateTo(b);});
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigateTo(b);}});
    // Double-click to rename (non-stats buildings)
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
  canvas.addEventListener('mousemove',onMouseMove);
  canvas.addEventListener('click',onCanvasClick);
  canvas.addEventListener('mouseenter',()=>{mouseOnScene=true; if(cursorChar)cursorChar.visible=true;});
  canvas.addEventListener('mouseleave',()=>{mouseOnScene=false; if(cursorChar)cursorChar.visible=false;});

  document.getElementById('themeToggle').addEventListener('click',()=>{
    isNight=!isNight;
    document.body.classList.toggle('night',isNight);
    document.body.classList.toggle('day',!isNight);
    localStorage.setItem('minicityTheme',isNight?'night':'day');
    applyTheme(isNight,false);
  });

  // Stats panel controls
  document.getElementById('spClose').addEventListener('click',closeStatsPanel);
  document.getElementById('spModeClean').addEventListener('click',()=>setStatsMode('clean'));
  document.getElementById('spModeRaw').addEventListener('click',()=>setStatsMode('raw'));
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeStatsPanel();});

  // Login
  document.getElementById('loginBtn').addEventListener('click',doLogin);
  document.getElementById('loginInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

  window.addEventListener('resize',()=>{
    const w=window.innerWidth,h=window.innerHeight,a=w/h,vs=13;
    renderer.setSize(w,h);
    camera.left=-vs*a; camera.right=vs*a; camera.top=vs; camera.bottom=-vs;
    camera.updateProjectionMatrix();
  });
}

function onMouseMove(e) {
  mouse2D.x=(e.clientX/window.innerWidth)*2-1;
  mouse2D.y=-(e.clientY/window.innerHeight)*2+1;
  raycaster.setFromCamera(mouse2D,camera);
  raycaster.ray.intersectPlane(groundPlane,cursorWorld);
  raycaster.setFromCamera(mouse2D,camera);
  const hits=raycaster.intersectObjects(buildings.map(b=>b.group),true);
  if(hits.length){
    const id=hits[0].object.userData.buildingId;
    const b=buildings.find(x=>x.id===id);
    if(b&&b!==hoveredB){if(hoveredB)unhover(hoveredB);hover(b);}
  } else{if(hoveredB)unhover(hoveredB);hoveredB=null;}
}
function onCanvasClick() {
  raycaster.setFromCamera(mouse2D,camera);
  const hits=raycaster.intersectObjects(buildings.map(b=>b.group),true);
  if(hits.length){const b=buildings.find(x=>x.id===hits[0].object.userData.buildingId);if(b)navigateTo(b);}
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
  // Stats building opens panel instead of navigating
  if (b.isStats) { openStatsPanel(); trackInteraction('stats'); return; }
  trackInteraction(b.id);
  if (REDUCED) { window.location.href=b.url; return; }
  const overlay=document.getElementById('transitionOverlay');
  const v=b.group.position.clone(); v.y=1.5; v.project(camera);
  const sx=(v.x*0.5+0.5)*window.innerWidth, sy=((-v.y)*0.5+0.5)*window.innerHeight;
  gsap.set(overlay,{left:sx,top:sy,xPercent:-50,yPercent:-50,scale:0.04,opacity:1,borderRadius:'50%',pointerEvents:'all'});
  gsap.to(overlay,{scale:55,borderRadius:'0%',duration:0.62,ease:'power3.in',onComplete:()=>{window.location.href=b.url;}});
}

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(night,instant) {
  const d=instant?0:0.72;
  tweenColor(scene.background,night?P.NIGHT_BG:P.DAY_BG,d);
  tweenColor(groundMat.color,night?P.NIGHT_GROUND:P.DAY_GROUND,d);
  pathMats.forEach(m=>tweenColor(m.color,night?P.NIGHT_PATH:P.DAY_PATH,d));
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

// ── Entrance + loop animations ────────────────────────────────────────────────
function entranceAnimation() {
  buildings.forEach((b,i)=>{
    b.group.position.y=-3;
    gsap.to(b.group.position,{y:0,duration:0.85,delay:0.25+i*0.12,ease:'back.out(1.6)'});
  });
  gsap.from('.welcome-block',{opacity:0,y:8,duration:0.9,delay:0.2,ease:'power2.out'});
  gsap.from('.ui-header',{opacity:0,y:-6,duration:0.7,delay:0.1,ease:'power2.out'});
  gsap.from('.you-block',{opacity:0,y:8,duration:0.9,delay:0.4,ease:'power2.out'});
}
function initAnimations() {
  if (REDUCED) return;
  const sb=buildings.find(b=>b.isStats);
  if(sb&&sb.glowMat)
    gsap.to(sb.glowMat,{emissiveIntensity:0.55,duration:1.6,ease:'sine.inOut',repeat:-1,yoyo:true});
}

// ── Label projection ──────────────────────────────────────────────────────────
function updateLabels() {
  buildings.forEach(b=>{
    if(!b.labelEl)return;
    const v=b.group.position.clone();
    v.y=b.group.position.y+b.labelY;
    v.project(camera);
    b.labelEl.style.left=((v.x*0.5+0.5)*window.innerWidth)+'px';
    b.labelEl.style.top=(((-v.y)*0.5+0.5)*window.innerHeight)+'px';
  });
}

// ── Loop ──────────────────────────────────────────────────────────────────────
function loop() {
  requestAnimationFrame(loop);
  if(cursorChar&&mouseOnScene){
    cursorChar.position.x+=(cursorWorld.x-cursorChar.position.x)*0.09;
    cursorChar.position.z+=(cursorWorld.z-cursorChar.position.z)*0.09;
    cursorChar.position.y=0;
  }
  updateLabels();
  renderer.render(scene,camera);
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS / PROGRESSION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

function getUserId() {
  let id=localStorage.getItem('minicityUserId');
  if(!id){id='usr_'+Math.random().toString(36).substr(2,8);localStorage.setItem('minicityUserId',id);}
  return id;
}

function getStats() {
  const raw=localStorage.getItem('minicityStats');
  return raw?JSON.parse(raw):{interactions:0,buildingsVisited:[],joinDate:null,unlockLevel:0};
}
function saveStats(s){localStorage.setItem('minicityStats',JSON.stringify(s));}

function trackInteraction(buildingId) {
  const s=getStats();
  s.interactions++;
  if(buildingId&&!s.buildingsVisited.includes(buildingId)) s.buildingsVisited.push(buildingId);
  saveStats(s);
  checkUnlocks(s);
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

function calcLevel(n) {
  if(n>=20)return 5; if(n>=12)return 4;
  if(n>=7)return 3;  if(n>=3)return 2; return 1;
}

function formatTime(secs) {
  if(secs<60)return secs+'s';
  const m=Math.floor(secs/60),s=secs%60;
  return m+'m '+(s<10?'0'+s:s)+'s';
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}

// ── Time tracking ─────────────────────────────────────────────────────────────
function startTimeTracking() {
  setInterval(()=>{
    const t=parseInt(localStorage.getItem('minicityTime')||'0')+1;
    localStorage.setItem('minicityTime',t);
  },1000);
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════

function checkLogin() {
  const overlay=document.getElementById('loginOverlay');
  const name=localStorage.getItem('minicityUser');
  if(!name){
    overlay.style.display='flex';
    requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.remove('hidden')));
    setTimeout(()=>document.getElementById('loginInput').focus(),300);
  } else {
    overlay.style.display='none';
    applyUsername(name);
  }
}

function doLogin() {
  const input=document.getElementById('loginInput');
  const name=(input.value||'').trim();
  if(!name)return;
  localStorage.setItem('minicityUser',name);
  const s=getStats();
  if(!s.joinDate){s.joinDate=Date.now();saveStats(s);}
  getUserId();
  applyUsername(name);
  const overlay=document.getElementById('loginOverlay');
  overlay.classList.add('hidden');
  setTimeout(()=>{overlay.style.display='none';},550);
}

function applyUsername(name) {
  const el=document.getElementById('logoUser');
  if(el) el.textContent='— '+name;
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
  const earned=s.unlockLevel||0;

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

  document.getElementById('spBody').innerHTML=`
    <div class="sp-user-row">
      <div class="sp-username">${name}</div>
      <div class="sp-level">LVL ${level}</div>
    </div>
    <div class="sp-since">citizen since ${since}</div>
    <div class="sp-cards">
      <div class="sp-card"><div class="sc-val">${formatTime(time)}</div><div class="sc-lbl">TIME IN CITY</div></div>
      <div class="sp-card"><div class="sc-val">${s.interactions}</div><div class="sc-lbl">INTERACTIONS</div></div>
      <div class="sp-card"><div class="sc-val">${visited}&thinsp;/&thinsp;5</div><div class="sc-lbl">BUILDINGS VISITED</div></div>
      <div class="sp-card"><div class="sc-val">${earned}</div><div class="sc-lbl">UNLOCKS EARNED</div></div>
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
    </div>`;
}

function renderRaw() {
  const s=getStats();
  const uid=getUserId();
  const name=localStorage.getItem('minicityUser')||'visitor';
  const time=parseInt(localStorage.getItem('minicityTime')||'0');
  const visited=(s.buildingsVisited||[]).length;
  const joined=s.joinDate?new Date(s.joinDate).toISOString().split('T')[0]:new Date().toISOString().split('T')[0];
  const level=calcLevel(s.interactions);

  const F=20, V=17; // column widths
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
  sep].join('\n');

  const content=`> SELECT * FROM city_stats\n  WHERE user_id = '${uid}';\n\n${table}\n\n1 row in set (0.001 sec)\n\n> _`;
  document.getElementById('spBody').innerHTML=`<pre class="sp-raw">${content}</pre>`;
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
  // Bots / All → show NPCs; Friends → hide (no real friends in MVP)
  const showNPCs=(filter!=='friends');
  npcList.forEach(npc=>{ npc.mesh.visible=showNPCs; });
  if(!showNPCs) showUnlockToast('no friends online yet — invite someone!');
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function stdMat(p){return new THREE.MeshStandardMaterial(p);}
function mk(geo,mat){return new THREE.Mesh(geo,mat);}
function part(group,geo,matOrParams,pos,shadow=true){
  const mat=matOrParams instanceof THREE.Material?matOrParams:stdMat(matOrParams);
  const m=new THREE.Mesh(geo,mat);
  if(pos)m.position.set(pos[0],pos[1],pos[2]);
  m.castShadow=shadow; m.receiveShadow=true;
  if(group)group.add(m);
  return m;
}

// ── Start ─────────────────────────────────────────────────────────────────────
document.body.classList.remove('day','night');
document.body.classList.add(isNight?'night':'day');
init();
