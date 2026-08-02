/* MiniCity — main.js · 物实小城改造版 */
'use strict';

const MOBILE  = () => window.innerWidth <= 680;
const REDUCED = false;

// ── Palette ───────────────────────────────────────────────────────────────────
const P = {
  DAY_BG:         0xF9F8F6,  NIGHT_BG:       0xD4D3CE,
  DAY_GROUND:     0xF2F1EE,  NIGHT_GROUND:   0xC4C3BE,
  DAY_PATH:       0xE8E7E4,  NIGHT_PATH:     0xBCBBB6,
  BUILDING_WHITE: 0xFFFFFF,  BUILDING_BASE:  0xEAE9E6,
  ROOF_RIM:       0xF8F7F5,  BLUE:           0x3B6FE0,
  FOUNTAIN_RIM:   0xECEBE8,  FOUNTAIN_WATER: 0xC8DAFC,
  GOLD:           0xE8A838,  PARCHMENT:      0xE8D5A8,
  DARK_TOWER:     0x4A4A52,  RUIN_GREY:      0xB5B2AC,
};

// ── Globals ───────────────────────────────────────────────────────────────────
let renderer, scene, camera, groundMat;
const pathMats = [], lampGlobes = [], buildings = [], npcList = [];
let cursorChar = null;
let isNight    = localStorage.getItem('minicityTheme') === 'night';
let hoveredB   = null, mouseOnScene = false;
let currentFilter = 'bots';
let statsMode = 'clean';
let cgTimeline = null, cgAutoEnterTimer = null, cgScene5Shown = false;

const mouse2D     = new THREE.Vector2(-9999, -9999);
const raycaster   = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const cursorWorld = new THREE.Vector3();

// ── Building config ───────────────────────────────────────────────────────────
const PLH = 0.3;

const I = (svg) => `<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;

const BUILDING_DEFS = [
  { id:'activity',   num:'01', label:'活动区',     x: 4,  z:-9, shape:'bank',
    icon:I(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>`) },
  { id:'bulletin',   num:'02', label:'公告板',     x:-4,  z:-9, shape:'board',
    icon:I(`<rect x="4" y="5" width="16" height="14" rx="1"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>`) },
  { id:'techhalf',   num:'03', label:'技术半城',   x: 9,  z:-3, shape:'tower',
    icon:I(`<polyline points="8 6 4 12 8 18"/><polyline points="16 6 20 12 16 18"/>`) },
  { id:'blackhole',  num:'04', label:'黑洞半城',   x:-9,  z:-3, shape:'darktower',
    icon:I(`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2" fill="#3B6FE0"/>`) },
  { id:'laws',       num:'05', label:'城的法则',   x: 4,  z: 3, shape:'pavilion',
    icon:I(`<path d="M12 3v18"/><path d="M6 8h12"/><path d="M6 8l-2 6h4z"/><path d="M18 8l-2 6h4z"/>`) },
  { id:'library',    num:'06', label:'图书馆',     x:-4,  z: 3, shape:'library',
    icon:I(`<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/>`) },
  { id:'litreview',  num:'07', label:'文学审核部', x:-9,  z: 3, shape:'ruins',
    icon:I(`<path d="M4 20V8l5-4 5 4v8"/><path d="M14 20V12l6-3v11"/><line x1="4" y1="20" x2="20" y2="20"/>`) },
  { id:'catcafe',    num:'08', label:'猫咖馆',     x: 9,  z: 3, shape:'skyscraper',
    icon:I(`<path d="M6 8V5l3 2"/><path d="M18 8V5l-3 2"/><path d="M5 10c0-2 2-3 7-3s7 1 7 3v5c0 3-3 5-7 5s-7-2-7-5z"/>`) },
  { id:'academy',    num:'09', label:'物实学院',   x: 4,  z: 9, shape:'campus',
    icon:I(`<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1 2.5 3 6 3s6-2 6-3v-5"/>`) },
  { id:'news',       num:'10', label:'星尘报社',   x:-4,  z: 9, shape:'kiosk',
    icon:I(`<rect x="3" y="5" width="18" height="14" rx="1"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/><line x1="7" y1="17" x2="13" y2="17"/>`) },
  { id:'mutualaid',  num:'11', label:'互助团',     x:-9,  z: 9, shape:'kiosk',
    icon:I(`<path d="M12 21s-7-5-7-11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-7 11-7 11z"/>`) },
  { id:'screen',     num:'12', label:'大屏幕',     x: 9,  z: 9, shape:'screen',
    icon:I(`<rect x="3" y="4" width="18" height="13" rx="1"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>`) },
  { id:'elevator',   num:'13', label:'电梯',       x: 9,  z:-9, shape:'shaft',
    icon:I(`<rect x="6" y="3" width="12" height="18" rx="1"/><line x1="10" y1="8" x2="12" y2="6"/><line x1="12" y1="6" x2="14" y2="8"/><line x1="10" y1="16" x2="12" y2="18"/><line x1="12" y1="18" x2="14" y2="16"/>`) },
  { id:'residentid', num:'14', label:'居民证',     x:-9,  z:-9, shape:'altar',
    icon:I(`<rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="8" cy="12" r="2"/><line x1="13" y1="11" x2="18" y2="11"/><line x1="13" y1="14" x2="16" y2="14"/>`) },
  { id:'stats',      num:'15', label:'STATS',      x:-5.5,z:-5.5,shape:'observatory', isStats:true,
    icon:I(`<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`) },
];

// ── Building dialog content (from copywriting) ────────────────────────────────
const BUILDING_CONTENT = {
  activity: {
    name:'活动区', slogan:'在这里领取你的货币吧。',
    dialog:[
      '钱袋落在柜台上，发出一声闷响。',
      '"在这里想要生存，没钱可不行。"柜台后面的人头也没抬，"必要的时候买些东西，以及……贿赂。"',
      '你会有越来越多的追随者，没钱给他们可不行。',
      '「马内的力量，还是大的。」'
    ]
  },
  bulletin: {
    name:'公告板', slogan:'一块镶了铁框、加了雨棚的木板。',
    dialog:[
      '一块普通的大木板，用铁镶了框，还安了雨棚。很明显，这里最近有人来修过。',
      '纸页都有些发黄了，不过还牢牢粘在上面，不掉下来。凑近一点好好看看——并非传单或小报，而是一堆公告。写这些公告的人做事一定特别有条理，句句分明，就是潦草了些。',
      '你正看着，一个空旷的声音忽然响起：',
      '「一座城市，怎么会没有管理人员呢？」',
      '——哦？难道这里还有"管理人员"？'
    ]
  },
  techhalf: {
    name:'技术半城', slogan:'你完全可以相信这里。',
    dialog:[
      '这里的所有居民都是知识居民，都是很友善的。',
      '但它对你没有那么友好——在你真正成为居民之前，也就是当你不再需要这本手册时，你才会体会到这里的乐趣。',
      '也就是说，在别的地方，可能会有危险。',
      '也有一些新居民偏偏喜欢这里，我们称他们为"新知者"。总有一些另一个半城的居民混进来，管理人员的部分工作，就是把他们请回去。他们居住的房子，我们叫"水实验"。',
      '「建议：熟悉这里之前，少接触这个区。」'
    ]
  },
  blackhole: {
    name:'黑洞半城', slogan:'这里包容一切。',
    dialog:[
      '正如名字所说的，这里包容一切。你会找到朋友，也会发现……黑暗。',
      '这里的人鱼龙混杂，尽量避免和坏人接触。什么是坏人？那些被"封禁"的人，他们的"居民权限"失效了——有些只是暂时的，有些是永远的。',
      '不过，我们允许你展示自己的存在，你可以在半城发布你的作品。在这个半城，你可以做作家、数学家、历史学家……某些方面，它比技术半城更多元。',
      '「无论在哪一个半城，那些发布\'水作品\'极多的人，都被称为\'伪用户\'。」'
    ]
  },
  laws: {
    name:'城的法则', slogan:'你违反的每一条法则，都会化作你不甘的泪水。',
    dialog:[
      '一卷羊皮纸摊在石台上，字迹工整得近乎冰冷。',
      '谨记，认真思考管理人员的每一次警告，他们对你的生活有很大影响。',
      '你要做一个好公民。',
      '「法则不是束缚，是这座城还在运转的理由。」'
    ]
  },
  library: {
    name:'图书馆', slogan:'这里是珍藏知识的地方。',
    dialog:[
      '推门进去，空气里是旧纸和木头的味道。',
      '技术半城的人们绞尽脑汁，为大家做出了一些优质作品，他们为了让更多人居住在技术半城而努力贡献。如果你选择住在技术半城，一些基本的知识你要明白——《实验记录》会给予你很大帮助。',
      '黑洞半城的人们也不落后，有些大佬就出现在这个半城。《这都是知识》里收录了他们的智慧。',
      '想当管理人员？翻开《志愿者要求一览》——志愿者是管理人员的基础。怀念外部世界吗？了解一下法律吧，这对你回去有很大帮助。',
      '角落里，一本厚厚的《物实百科全书》静静躺着，记载着这座城的历史与文化。旁边的小说合集，则承诺"文学可以带给你乐趣"。',
      '「招募图书管理员、收集员，欢迎大家。」',
      '待收集：杂文　未完整：小说'
    ]
  },
  litreview: {
    name:'文学审核部', slogan:'「已废弃」',
    dialog:[
      '你看到一行脚印，顺着它走了过去。脚印越来越杂乱。',
      '一栋古里古气的大房子，门前脚印十分杂乱，管理者似乎匆匆忙忙地离开的。门前挂着褪色的牌匾：文学审核部。',
      '原来所有书进图书馆之前都要经过他们的审核。权力还是蛮大的，或许他们有一部分人员就是管理人员。',
      '真令人痛心，这么气宇轩昂的组织……',
      '「已废弃。」',
      '告示板上的字迹还没干透。'
    ]
  },
  catcafe: {
    name:'物实猫咖馆', slogan:'闲暇时光来撸猫也不错。',
    dialog:[
      '一栋高得看不到顶的楼，门牌上画着一只打哈欠的猫。',
      '趁着三月的暖阳，和着微风听听风铃吧。',
      '不过，这可是高达 15000 多层的楼哦。',
      '还有——小心军火！',
      '「猫在窗台上眯着眼，像是已经在这里等了你很久。」'
    ]
  },
  academy: {
    name:'物实学院', slogan:'文化一条街。',
    dialog:[
      '现代化的大楼立在老街尽头，玻璃幕墙反着光。',
      '这貌似是一个学校，不知道里面是什么样子。咦，这里面的课程好像对我们的生存很有帮助。',
      '面前出现了一个五角星。这里可以收藏吗？拿着这些课，以后或许有用。',
      '「知识不是必需品，是奢侈品——但在物实，它两者都是。」'
    ]
  },
  news: {
    name:'星尘报社', slogan:'隶属于 SNO.星尘报社总部。',
    dialog:[
      '"拿着这份报纸吧！"',
      '你抬起头，想问他是哪个报社的。可那个人已经消失了。',
      '你看了看手中的报纸。报纸上写着：',
      '「隶属于 SNO.星尘报社总部」',
      '真有意思，连这都有。看起来，要在这里待一段时间了。',
      '「新闻是这座城里唯一比法则跑得更快的东西。」'
    ]
  },
  mutualaid: {
    name:'互助团', slogan:'你有什么需要吗？',
    dialog:[
      '一张广告贴在墙上，边角被风掀起。',
      '互助团成立了！你有什么需要吗？快来这里投稿吧，我们会尽所可能的帮助你！',
      '你对着空气说："我怎么能离开这里？"',
      '「抱歉，我们属于这里，无法帮你离开。」',
      '不要灰心。这个组织还是很有用的。',
      '「能帮的，他们都会帮。不能帮的，只有你自己。」'
    ]
  },
  screen: {
    name:'大屏幕', slogan:'闪着荧荧的光。',
    dialog:[
      '这条街竟然有尽头。尽头的墙上夹着一块大屏幕，闪着荧荧的光。',
      '屏幕亮起：',
      '你好，欢迎来到物实！',
      '有几点你需要注意：',
      '1. 一定要尊敬管理员们，尤其是紫兰斋。',
      '2. 不要理会那些骂人、刷屏的居民。',
      '3. 如果你是管理人员，记住，你的责任就是"移水"和"处理事件"，不要借着管理人员的名义去……（模糊）',
      '4. 尽量发布一些有意义的作品，否则你会失去一些货币。',
      '5. 请一定把这个大屏幕拆下来揣在兜里。不要担心它会消失——下一个来这里的人，同样也会看到它。',
      '「屏幕可以带走，规则要留下。」'
    ]
  },
  elevator: {
    name:'电梯', slogan:'我们会尽快修复其他按钮。',
    dialog:[
      '你拆下了大屏幕，却发现它后面藏着一架电梯。',
      '门缓缓打开，内部的按钮泛着幽光：',
      '⑤　④　③　②　①　-①',
      '「我们会尽快修复其他按钮。」',
      '一张便签贴在按钮旁，字迹潦草：每一层都是一座城的一部分，但不是每一层都还在。',
      '「选择你的楼层。」'
    ]
  },
  residentid: {
    name:'居民证', slogan:'请撕下这张纸，作为你的居民证。',
    dialog:[
      '一张纸静静躺在石台上，边角整齐。',
      '——————————————————',
      '{Visitor}',
      '我会遵守《这个城的法则》，我已阅读《居民生存指南》。',
      '——————————————————',
      '如你遇到 Bug 类困难，请联系 turtlesim。',
      '你要参与这个故事的话，就请签上你的名字。',
      '「签名之后，你就是这座城的人了。」'
    ]
  },
};

const WAYPOINTS = [
  new THREE.Vector3( 0,   0,-6), new THREE.Vector3( 0,   0,-4), new THREE.Vector3( 0,   0,-2),
  new THREE.Vector3( 0,   0, 0), new THREE.Vector3( 0,   0, 2), new THREE.Vector3( 0,   0, 4),
  new THREE.Vector3( 0,   0, 6), new THREE.Vector3(-6,   0, 0), new THREE.Vector3(-3.5, 0, 0),
  new THREE.Vector3(-1.5, 0, 0), new THREE.Vector3( 1.5, 0, 0), new THREE.Vector3( 3.5, 0, 0),
  new THREE.Vector3( 6,   0, 0), new THREE.Vector3(-1.2, 0,-1.2), new THREE.Vector3(1.2, 0,-1.2),
  new THREE.Vector3(-1.2, 0, 1.2), new THREE.Vector3(1.2, 0, 1.2),
];

// Progression unlock tiers
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
  setupModal();
  applyTheme(isNight, true);
  initAnimations();
  document.getElementById('labelsWrap').classList.add('hidden');
  requestAnimationFrame(loop);

  checkLogin();
  if (localStorage.getItem('minicityUser')) afterLogin();
  // If no user, afterLogin is called from doLogin
}

// ── Renderer / Camera / Scene / Lighting ──────────────────────────────────────
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

// ── Paths (grid layout for expanded city) ─────────────────────────────────────
function addPaths() {
  const col = isNight ? P.NIGHT_PATH : P.DAY_PATH;

  // Main cross roads (wider: 1.7, length 24)
  [[1.7,0.03,24,0,0.015,0],[24,0.03,1.7,0,0.015,0]].forEach(([w,h,d,x,y,z]) => {
    const mat = stdMat({ color:col, roughness:1 });
    pathMats.push(mat);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
    m.position.set(x,y,z); m.receiveShadow = true; scene.add(m);
  });

  // Secondary roads (narrower: 1.1) at ±3 and ±9
  [-9,-3,3,9].forEach(pos => {
    // Horizontal (along z=pos)
    const hMat = stdMat({ color:col, roughness:1 });
    pathMats.push(hMat);
    const h = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.025,24), hMat);
    h.position.set(0,0.012,pos); h.receiveShadow = true; scene.add(h);
    // Vertical (along x=pos)
    const vMat = stdMat({ color:col, roughness:1 });
    pathMats.push(vMat);
    const v = new THREE.Mesh(new THREE.BoxGeometry(24,0.025,1.1), vMat);
    v.position.set(pos,0.012,0); v.receiveShadow = true; scene.add(v);
  });

  // Diagonal branch to Stats building at (-5.5, 0, -5.5)
  const diagMat = stdMat({ color:col, roughness:1 });
  pathMats.push(diagMat);
  const diag = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.03,5.66), diagMat);
  diag.position.set(-3.5, 0.015, -3.5);
  diag.rotation.y = Math.PI/4;
  diag.receiveShadow = true; scene.add(diag);
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
function mkBodyMat() {
  const m = stdMat({color:P.BUILDING_WHITE,roughness:0.08});
  m.emissive = new THREE.Color(P.BLUE); m.emissiveIntensity = 0;
  return m;
}

// 01 ACTIVITY — treasury / bank with columns and gold dome
function buildBank(cfg) {
  const g = new THREE.Group();
  const bw=2.2, bh=1.8;
  part(g, new THREE.BoxGeometry(2.8,PLH,2.4), {color:P.BUILDING_BASE,roughness:0.8}, [0,PLH/2,0]);
  const bodyMat = mkBodyMat();
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = PLH+bh;
  // Pediment
  part(g, new THREE.BoxGeometry(bw+0.2,0.1,bw+0.2), {color:P.ROOF_RIM,roughness:0.5}, [0,top+0.05,0]);
  // Columns at front
  [-0.7,-0.23,0.23,0.7].forEach(cx =>
    part(g, new THREE.CylinderGeometry(0.07,0.08,bh*0.85,10), {color:0xF8F7F5,roughness:0.3}, [cx,PLH+bh*0.425,bw/2+0.12]));
  // Gold dome
  part(g, new THREE.SphereGeometry(0.42,16,8,0,Math.PI*2,0,Math.PI/2), {color:0xF0EFEC,roughness:0.12}, [0,top+0.1,0]);
  part(g, new THREE.SphereGeometry(0.07,10,10), {color:P.GOLD,emissive:P.GOLD,emissiveIntensity:0.35}, [0,top+0.1+0.42+0.07,0], false);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.1+0.42+0.5};
}

// 02 BULLETIN — board with two posts and small roof
function buildBoard(cfg) {
  const g = new THREE.Group();
  part(g, new THREE.BoxGeometry(2.0,0.15,0.7), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.075,0]);
  const boardMat = stdMat({color:P.PARCHMENT,roughness:0.85});
  boardMat.emissive = new THREE.Color(P.BLUE); boardMat.emissiveIntensity = 0;
  [-0.6,0.6].forEach(cx =>
    part(g, new THREE.BoxGeometry(0.1,1.6,0.1), {color:0xC4A86D,roughness:0.7}, [cx,0.15+0.8,0]));
  const board = mk(new THREE.BoxGeometry(1.5,1.0,0.08), boardMat);
  board.position.y = 0.15+1.1; board.castShadow = true; g.add(board);
  // Roof slats
  part(g, new THREE.BoxGeometry(1.75,0.06,0.55), {color:0xB8956B,roughness:0.6}, [0,0.15+1.64,0]);
  part(g, new THREE.BoxGeometry(1.75,0.04,0.1), {color:0xA8855B,roughness:0.6}, [0,0.15+1.67,0.22]);
  // Posted papers
  part(g, new THREE.BoxGeometry(0.4,0.3,0.02), {color:0xF8F4E8,roughness:0.9}, [-0.3,0.15+1.15,0.05]);
  part(g, new THREE.BoxGeometry(0.35,0.25,0.02), {color:0xF5F0E0,roughness:0.9}, [0.25,0.15+1.05,0.05]);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.15+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body:board, bodyMat:boardMat, labelEl:null, labelY:0.15+1.64+0.5};
}

// 03 TECHHALF — tall elegant tower (reuse existing tower design)
function buildTower(cfg) {
  const g = new THREE.Group();
  const bw=1.85, bh=4.6;
  part(g, new THREE.BoxGeometry(2.55,PLH,2.55), {color:P.BUILDING_BASE,roughness:0.8}, [0,PLH/2,0]);
  const bodyMat = mkBodyMat();
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

// 04 BLACKHOLE — dark tower with swirling aura
function buildDarkTower(cfg) {
  const g = new THREE.Group();
  const bw=1.7, bh=4.0;
  part(g, new THREE.BoxGeometry(2.4,PLH,2.4), {color:0x3A3A3E,roughness:0.8}, [0,PLH/2,0]);
  const bodyMat = stdMat({color:P.DARK_TOWER,roughness:0.15,metalness:0.3});
  bodyMat.emissive = new THREE.Color(0x1a1a2e); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = PLH+bh;
  // Dark cone roof
  part(g, new THREE.ConeGeometry(1.0,1.4,6), {color:0x2A2A30,roughness:0.2}, [0,top+0.7,0]);
  // Purple aura ring
  part(g, new THREE.TorusGeometry(0.9,0.04,8,24), {color:0x6B4FE8,emissive:0x6B4FE8,emissiveIntensity:0.3}, [0,PLH+bh*0.35,0], false).rotation.x = Math.PI/2;
  // Dark orb on top
  part(g, new THREE.SphereGeometry(0.15,12,12), {color:0x1a1a2e,emissive:0x4B3FE8,emissiveIntensity:0.15}, [0,top+1.4+0.15,0], false);
  // Blue entrance disc
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+1.4+0.5};
}

// 05 LAWS — pavilion with cone roof (reuse existing pavilion)
function buildPavilion(cfg) {
  const g = new THREE.Group();
  const bw=2.4, bh=2.3;
  part(g, new THREE.BoxGeometry(3.1,0.25,3.1), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.125,0]);
  const bodyMat = mkBodyMat();
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

// 06 LIBRARY — wide classical building with pediment and columns
function buildLibrary(cfg) {
  const g = new THREE.Group();
  const bw=3.0, bh=2.0;
  part(g, new THREE.BoxGeometry(3.6,0.25,2.8), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.125,0]);
  const bodyMat = mkBodyMat();
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = 0.25+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = 0.25+bh;
  // Cornice
  part(g, new THREE.BoxGeometry(bw+0.2,0.1,bw+0.2), {color:P.ROOF_RIM,roughness:0.4}, [0,top+0.05,0]);
  // Triangular pediment
  part(g, new THREE.CylinderGeometry(0.01,1.5,0.5,3), {color:0xF5F4F1,roughness:0.2}, [0,top+0.1+0.25,0]).rotation.z = 0;
  const ped = mk(new THREE.ConeGeometry(1.55, 0.55, 3), stdMat({color:0xF5F4F1,roughness:0.2}));
  ped.rotation.y = Math.PI/6; ped.position.y = top+0.1+0.275; g.add(ped);
  // Columns at front (4)
  [-0.9,-0.3,0.3,0.9].forEach(cx =>
    part(g, new THREE.CylinderGeometry(0.08,0.09,bh*0.9,10), {color:0xF8F7F5,roughness:0.3}, [cx,0.25+bh*0.45,bw/2+0.15]));
  // Book silo (round reading room on roof)
  part(g, new THREE.CylinderGeometry(0.5,0.5,0.7,16), {color:0xF0EFEC,roughness:0.15}, [0,top+0.1+0.35,0]);
  part(g, new THREE.SphereGeometry(0.5,16,8,0,Math.PI*2,0,Math.PI/2), {color:0xEEEDEA,roughness:0.1}, [0,top+0.1+0.7,0]);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.1+0.7+0.5+0.4};
}

// 07 LITREVIEW — abandoned ruins with broken top
function buildRuins(cfg) {
  const g = new THREE.Group();
  const bw=2.2, bh=1.6;
  part(g, new THREE.BoxGeometry(2.7,0.22,2.3), {color:0x9A988E,roughness:0.9}, [0,0.11,0]);
  const bodyMat = stdMat({color:P.RUIN_GREY,roughness:0.85});
  bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = 0.22+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = 0.22+bh;
  // Broken/jagged top — several uneven blocks
  part(g, new THREE.BoxGeometry(0.6,0.4,0.6), {color:P.RUIN_GREY,roughness:0.85}, [-0.6,top+0.2,0]);
  part(g, new THREE.BoxGeometry(0.4,0.25,0.4), {color:0xA5A29A,roughness:0.85}, [0.1,top+0.12,0.3]);
  part(g, new THREE.BoxGeometry(0.35,0.15,0.35), {color:0x9A988E,roughness:0.85}, [0.7,top+0.07,-0.2]);
  // Faded sign (desaturated board)
  part(g, new THREE.BoxGeometry(0.8,0.4,0.04), {color:0xC8C2B0,roughness:0.9}, [0,0.22+bh*0.6,bw/2+0.03]);
  // Overgrown vine
  part(g, new THREE.SphereGeometry(0.18,8,8), {color:0x8A8870,roughness:0.95}, [-0.8,0.22+0.3,0.8]);
  part(g, new THREE.SphereGeometry(0.15,8,8), {color:0x7A7860,roughness:0.95}, [0.9,0.22+0.2,-0.6]);
  // Faded entrance disc
  part(g, new THREE.CylinderGeometry(0.12,0.12,0.04,16), {color:0x7A7A82,emissive:0x4A4A52,emissiveIntensity:0.1}, [0,0.22+0.022,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.6};
}

// 08 CATCAFE — very tall thin skyscraper with banded floors
function buildSkyscraper(cfg) {
  const g = new THREE.Group();
  const bw=1.3, bh=6.5;
  part(g, new THREE.BoxGeometry(2.0,PLH,2.0), {color:P.BUILDING_BASE,roughness:0.8}, [0,PLH/2,0]);
  const bodyMat = stdMat({color:0xFDFCFA,roughness:0.06});
  bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = PLH+bh;
  // Floor banding (horizontal lines every ~1 unit)
  for (let i = 1; i < 7; i++) {
    part(g, new THREE.BoxGeometry(bw+0.04,0.06,bw+0.04), {color:0xE8E7E4,roughness:0.4}, [0,PLH+i*0.95,0]);
  }
  // Rooftop
  part(g, new THREE.BoxGeometry(bw+0.1,0.1,bw+0.1), {color:P.ROOF_RIM,roughness:0.4}, [0,top+0.05,0]);
  // Cat silhouette on roof (small sphere + cones for ears)
  part(g, new THREE.SphereGeometry(0.15,10,10), {color:0xE8A838,emissive:0xE8A838,emissiveIntensity:0.12}, [0,top+0.1+0.15,0]);
  part(g, new THREE.ConeGeometry(0.06,0.12,4), {color:0xE8A838,emissive:0xE8A838,emissiveIntensity:0.12}, [-0.07,top+0.1+0.3,0]);
  part(g, new THREE.ConeGeometry(0.06,0.12,4), {color:0xE8A838,emissive:0xE8A838,emissiveIntensity:0.12}, [0.07,top+0.1+0.3,0]);
  // Wind chimes
  part(g, new THREE.CylinderGeometry(0.02,0.02,0.3,6), {color:0xD4D3D0,roughness:0.5}, [-0.5,top+0.1+0.15,0]);
  part(g, new THREE.CylinderGeometry(0.02,0.02,0.25,6), {color:0xD4D3D0,roughness:0.5}, [0.5,top+0.1+0.12,0]);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5};
}

// 09 ACADEMY — wide campus with annex (reuse existing campus)
function buildCampus(cfg) {
  const g = new THREE.Group();
  const mw=2.9, mh=2.1, md=2.1;
  part(g, new THREE.BoxGeometry(3.6,0.25,2.8), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.125,0]);
  const bodyMat = mkBodyMat();
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

// 10/11 KIOSK — small square structure with awning (for news & mutualaid)
function buildKiosk(cfg) {
  const g = new THREE.Group();
  const bw=1.6, bh=1.5;
  const accentColor = cfg.id === 'news' ? 0xD4A838 : 0x6B8FE8;
  part(g, new THREE.BoxGeometry(2.1,0.2,1.8), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.1,0]);
  const bodyMat = mkBodyMat();
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = 0.2+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = 0.2+bh;
  // Flat roof
  part(g, new THREE.BoxGeometry(bw+0.4,0.08,bw+0.4), {color:P.ROOF_RIM,roughness:0.4}, [0,top+0.04,0]);
  // Striped awning (alternating color bands)
  for (let i = 0; i < 5; i++) {
    const x = -bw/2 - 0.1 + i * (bw+0.2)/5;
    part(g, new THREE.BoxGeometry((bw+0.2)/5-0.02, 0.06, 0.4), {color: i%2===0 ? accentColor : 0xF5F4F1, roughness:0.5}, [x+0.1, top+0.02, bw/2+0.2]);
  }
  // Window cutout (simulated with darker box)
  part(g, new THREE.BoxGeometry(bw*0.7,bh*0.5,0.04), {color:0x4A6FA8,roughness:0.1,metalness:0.3}, [0,0.2+bh*0.5,bw/2+0.02]);
  // Sign on top
  part(g, new THREE.BoxGeometry(bw*0.6,0.3,0.05), {color:accentColor,roughness:0.4}, [0,top+0.08+0.15,0]);
  // Blue accent disc
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5};
}

// 12 SCREEN — wall structure with glowing blue screen
function buildScreen(cfg) {
  const g = new THREE.Group();
  const bw=2.8, bh=3.2;
  part(g, new THREE.BoxGeometry(3.4,0.25,1.0), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.125,0]);
  const bodyMat = mkBodyMat();
  const body = mk(new THREE.BoxGeometry(bw,bh,0.6), bodyMat);
  body.position.y = 0.25+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = 0.25+bh;
  // Roof slab
  part(g, new THREE.BoxGeometry(bw+0.3,0.12,1.0), {color:P.ROOF_RIM,roughness:0.4}, [0,top+0.06,0]);
  // Glowing screen on front face
  const screenMat = stdMat({color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.25,roughness:0.1});
  part(g, new THREE.BoxGeometry(bw*0.8,bh*0.7,0.04), screenMat, [0,0.25+bh*0.5,0.32], false);
  // Screen frame
  part(g, new THREE.BoxGeometry(bw*0.85,bh*0.75,0.06), {color:0x2A2A30,roughness:0.3}, [0,0.25+bh*0.5,0.30], false);
  // Screen glow lines
  for (let i = 0; i < 4; i++) {
    part(g, new THREE.BoxGeometry(bw*0.6,0.03,0.02), {color:0xA8C8F8,emissive:0xA8C8F8,emissiveIntensity:0.2}, [0,0.25+bh*0.3+i*0.4,0.34], false);
  }
  // Antenna on top
  part(g, new THREE.CylinderGeometry(0.03,0.03,0.5,6), {color:0xD0CFCC,roughness:0.5}, [0,top+0.12+0.25,0]);
  part(g, new THREE.SphereGeometry(0.06,8,8), {color:P.GOLD,emissive:P.GOLD,emissiveIntensity:0.3}, [0,top+0.12+0.5,0], false);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.25+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.12+0.5+0.5};
}

// 13 ELEVATOR — tall narrow shaft with door and button panel
function buildShaft(cfg) {
  const g = new THREE.Group();
  const bw=1.3, bh=3.8;
  part(g, new THREE.BoxGeometry(2.0,PLH,1.8), {color:P.BUILDING_BASE,roughness:0.8}, [0,PLH/2,0]);
  const bodyMat = stdMat({color:0xE8E7E4,roughness:0.2,metalness:0.4});
  bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = PLH+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = PLH+bh;
  // Roof
  part(g, new THREE.BoxGeometry(bw+0.15,0.1,bw+0.15), {color:P.ROOF_RIM,roughness:0.3}, [0,top+0.05,0]);
  // Elevator door (split design)
  part(g, new THREE.BoxGeometry(bw*0.7,1.6,0.04), {color:0x4A6FA8,roughness:0.1,metalness:0.6}, [0,PLH+0.8,bw/2+0.02], false);
  part(g, new THREE.BoxGeometry(0.02,1.6,0.04), {color:0x2A2A30,roughness:0.3}, [0,PLH+0.8,bw/2+0.03], false);
  // Button panel
  part(g, new THREE.BoxGeometry(0.15,0.4,0.03), {color:0x2A2A30,roughness:0.3}, [bw/2-0.1,PLH+1.2,bw/2+0.02], false);
  // Floor indicator (glowing)
  part(g, new THREE.BoxGeometry(0.1,0.08,0.02), {color:0xA8C8F8,emissive:0xA8C8F8,emissiveIntensity:0.3}, [0,PLH+bh-0.4,bw/2+0.02], false);
  // Top indicator light
  part(g, new THREE.SphereGeometry(0.06,8,8), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.4}, [0,top+0.1+0.06,0], false);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,PLH+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5};
}

// 14 RESIDENTID — stone altar with paper on top
function buildAltar(cfg) {
  const g = new THREE.Group();
  const bw=2.0, bh=1.2;
  part(g, new THREE.BoxGeometry(2.6,0.2,1.8), {color:0xD4D3D0,roughness:0.85}, [0,0.1,0]);
  const bodyMat = stdMat({color:0xE8E7E4,roughness:0.6});
  bodyMat.emissive = new THREE.Color(P.BLUE); bodyMat.emissiveIntensity = 0;
  const body = mk(new THREE.BoxGeometry(bw,bh,bw), bodyMat);
  body.position.y = 0.2+bh/2; body.castShadow = body.receiveShadow = true; g.add(body);
  const top = 0.2+bh;
  // Stone table top (wider slab)
  part(g, new THREE.BoxGeometry(bw+0.4,0.12,bw+0.4), {color:0xF0EFEC,roughness:0.5}, [0,top+0.06,0]);
  // Paper/certificate on top
  part(g, new THREE.BoxGeometry(1.2,0.04,0.8), {color:0xF8F4E8,roughness:0.9}, [0,top+0.12+0.02,0]);
  // Wax seal (gold dot)
  part(g, new THREE.CylinderGeometry(0.08,0.08,0.03,12), {color:P.GOLD,emissive:P.GOLD,emissiveIntensity:0.2}, [0,top+0.12+0.04,0], false);
  // Pillars at corners
  [[-0.8,-0.8],[-0.8,0.8],[0.8,-0.8],[0.8,0.8]].forEach(([cx,cz]) =>
    part(g, new THREE.CylinderGeometry(0.07,0.08,bh,8), {color:0xDEDDE0,roughness:0.5}, [cx,0.2+bh/2,cz]));
  // Decorative arch
  part(g, new THREE.BoxGeometry(1.6,0.08,0.1), {color:0xE8E7E4,roughness:0.5}, [0,top+0.5,0]);
  part(g, new THREE.CylinderGeometry(0.04,0.04,0.5,6), {color:0xD0CFCC,roughness:0.5}, [-0.7,top+0.3,0]);
  part(g, new THREE.CylinderGeometry(0.04,0.04,0.5,6), {color:0xD0CFCC,roughness:0.5}, [0.7,top+0.3,0]);
  // Quill pen
  part(g, new THREE.CylinderGeometry(0.02,0.02,0.4,6), {color:0xE8E7E4,roughness:0.5}, [0.3,top+0.12+0.2,0.2]);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.2+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  return {...cfg, group:g, body, bodyMat, labelEl:null, labelY:top+0.5+0.3};
}

// 15 STATS — octagonal observatory with pulsing glow ring
function buildObservatory(cfg) {
  const g = new THREE.Group();
  part(g, new THREE.CylinderGeometry(1.65,1.65,0.22,8), {color:P.BUILDING_BASE,roughness:0.8}, [0,0.11,0]);
  const bodyMat = mkBodyMat();
  const body = mk(new THREE.CylinderGeometry(1.1,1.22,2.1,8), bodyMat);
  body.position.y = 0.22+1.05; body.castShadow = body.receiveShadow = true; g.add(body);
  part(g, new THREE.CylinderGeometry(1.28,1.28,0.09,24), {color:P.ROOF_RIM,roughness:0.5}, [0,0.22+1.05,0]);
  const bodyTop = 0.22+2.1;
  part(g, new THREE.CylinderGeometry(1.3,1.3,0.1,24), {color:P.ROOF_RIM,roughness:0.4}, [0,bodyTop+0.05,0]);
  const glowMat = stdMat({color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.2,roughness:0.2});
  part(g, new THREE.CylinderGeometry(1.12,1.12,0.06,24), glowMat, [0,bodyTop+0.1+0.03,0], false);
  const domeY = bodyTop+0.1+0.06;
  part(g, new THREE.SphereGeometry(1.1,20,10,0,Math.PI*2,0,Math.PI/2), {color:0xF8F7F5,roughness:0.06,metalness:0.05}, [0,domeY,0]);
  part(g, new THREE.CylinderGeometry(0.14,0.14,0.05,20), {color:P.BLUE,emissive:P.BLUE,emissiveIntensity:0.28}, [0,0.22+0.026,0], false);
  g.position.set(cfg.x,0,cfg.z); tagMeshes(g,cfg.id);
  const labelY = domeY+1.1+0.5;
  return {...cfg, group:g, body, bodyMat, glowMat, labelEl:null, labelY};
}

const SHAPE_FNS = {
  bank:buildBank, board:buildBoard, tower:buildTower, darktower:buildDarkTower,
  pavilion:buildPavilion, library:buildLibrary, ruins:buildRuins,
  skyscraper:buildSkyscraper, campus:buildCampus, kiosk:buildKiosk,
  screen:buildScreen, shaft:buildShaft, altar:buildAltar, observatory:buildObservatory
};

function addBuildings() {
  BUILDING_DEFS.forEach(cfg => {
    const b = SHAPE_FNS[cfg.shape](cfg);
    b.group.position.y = -3; // Start hidden below ground for entrance animation
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
    el.className='b-label-item'; el.href='#'; el.tabIndex=0;
    el.setAttribute('aria-label',`${b.label}${b.isStats?' — open stats panel':' — 查看详情'}`);
    el.innerHTML=`<span class="bl-num">${b.num}</span><span class="bl-icon">${b.icon}</span><span class="bl-name">${b.label}</span>`;
    el.addEventListener('click',e=>{e.preventDefault();navigateTo(b);});
    el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();navigateTo(b);}});
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

  document.getElementById('spClose').addEventListener('click',closeStatsPanel);
  document.getElementById('spModeClean').addEventListener('click',()=>setStatsMode('clean'));
  document.getElementById('spModeRaw').addEventListener('click',()=>setStatsMode('raw'));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'){closeStatsPanel();closeModal();}
  });

  document.getElementById('loginBtn').addEventListener('click',doLogin);
  document.getElementById('loginInput').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

  document.getElementById('cgSkip').addEventListener('click',skipCG);

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
  if (b.isStats) { openStatsPanel(); trackInteraction('stats'); return; }
  trackInteraction(b.id);
  if (REDUCED) { openModal(b); return; }
  const overlay=document.getElementById('transitionOverlay');
  const v=b.group.position.clone(); v.y=1.5; v.project(camera);
  const sx=(v.x*0.5+0.5)*window.innerWidth, sy=((-v.y)*0.5+0.5)*window.innerHeight;
  gsap.set(overlay,{left:sx,top:sy,xPercent:-50,yPercent:-50,scale:0.04,opacity:1,borderRadius:'50%',pointerEvents:'all'});
  gsap.to(overlay,{scale:55,borderRadius:'0%',duration:0.62,ease:'power3.in',onComplete:()=>{
    openModal(b);
    gsap.to(overlay,{opacity:0,duration:0.35,delay:0.05,onComplete:()=>{
      gsap.set(overlay,{scale:0.04,pointerEvents:'none'});
    }});
  }});
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
  setTimeout(()=>{
    overlay.style.display='none';
    afterLogin();
  },550);
}

function applyUsername(name) {
  const el=document.getElementById('logoUser');
  if(el) el.textContent='— '+name;
}

// Called after login (or if already logged in) to show CG or enter city
function afterLogin() {
  if (shouldShowCG()) {
    startCG();
  } else {
    proceedToCity();
  }
}

function proceedToCity() {
  entranceAnimation();
  startTimeTracking();
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

  document.getElementById('spBody').innerHTML=`
    <div class="sp-user-row">
      <div class="sp-username">${name}</div>
      <div class="sp-level">LVL ${level}</div>
    </div>
    <div class="sp-since">citizen since ${since}</div>
    <div class="sp-cards">
      <div class="sp-card"><div class="sc-val">${formatTime(time)}</div><div class="sc-lbl">TIME IN CITY</div></div>
      <div class="sp-card"><div class="sc-val">${s.interactions}</div><div class="sc-lbl">INTERACTIONS</div></div>
      <div class="sp-card"><div class="sc-val">${visited}&thinsp;/&thinsp;${totalBuildings}</div><div class="sc-lbl">BUILDINGS VISITED</div></div>
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
  const showNPCs=(filter!=='friends');
  npcList.forEach(npc=>{ npc.mesh.visible=showNPCs; });
  if(!showNPCs) showUnlockToast('no friends online yet — invite someone!');
}

// ══════════════════════════════════════════════════════════════════════════════
// CG ANIMATION SYSTEM — 5-scene opening cinematic
// ══════════════════════════════════════════════════════════════════════════════

function shouldShowCG() {
  return !localStorage.getItem('minicityCGSeen');
}

function startCG() {
  const overlay = document.getElementById('cgOverlay');
  const wrap = document.getElementById('cgSceneWrap');
  overlay.style.display = 'flex';
  requestAnimationFrame(() => overlay.classList.add('active'));
  cgScene5Shown = false;

  if (REDUCED) { endCG(); return; }

  const visitor = localStorage.getItem('minicityUser') || '旅人';

  cgTimeline = gsap.timeline();

  // Scene 1: Falling (0–4s)
  cgTimeline.call(() => scene1(wrap, visitor), [], 0)
           .to({}, {duration: 4}, 0);

  // Scene 2: Opening eyes (4–8s)
  cgTimeline.call(() => scene2(wrap, visitor), [], 4)
           .to({}, {duration: 4}, 4);

  // Scene 3: Book (8–12s)
  cgTimeline.call(() => scene3(wrap, visitor), [], 8)
           .to({}, {duration: 4}, 8);

  // Scene 4: Self-confirmation (12–15s)
  cgTimeline.call(() => scene4(wrap, visitor), [], 12)
           .to({}, {duration: 3}, 12);

  // Scene 5: Enter city (15s+)
  cgTimeline.call(() => scene5(wrap, visitor), [], 15);
}

function scene1(wrap, visitor) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-falling"></div>
    <div class="cg-text-block">
      <p class="cg-line">坠落……坠落……</p>
      <p class="cg-line" style="animation-delay:1.5s">没有撞到地面。</p>
    </div>`;
}

function scene2(wrap, visitor) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-eyes"></div>
    <div class="cg-text-block">
      <p class="cg-line">你睁开眼睛，发现自己来到了一个陌生的地方。</p>
      <p class="cg-line cg-highlight" style="animation-delay:2s">「你好，${visitor}，欢迎来到物实」</p>
    </div>`;
}

function scene3(wrap, visitor) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-book"></div>
    <div class="cg-book">
      <div class="cg-book-cover">居民生存指南</div>
    </div>
    <div class="cg-text-block">
      <p class="cg-line">你的手中多出了一本书。</p>
      <p class="cg-line cg-book-title" style="animation-delay:1.8s">《居民生存指南》</p>
    </div>`;
}

function scene4(wrap, visitor) {
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-dark"></div>
    <div class="cg-text-block">
      <p class="cg-line cg-quote">"这么说，我现在就是居民了？"</p>
      <p class="cg-line" style="animation-delay:1.5s">生存？这个地方有点诡异。</p>
    </div>`;
}

function scene5(wrap, visitor) {
  if (cgScene5Shown) return;
  cgScene5Shown = true;
  wrap.innerHTML = `
    <div class="cg-bg cg-bg-gate"></div>
    <div class="cg-text-block">
      <p class="cg-line cg-gate-text">—— 前方，是一座城。</p>
      <button class="cg-enter-btn" id="cgEnterBtn">推开门，走进去</button>
    </div>`;
  const btn = document.getElementById('cgEnterBtn');
  if (btn) btn.addEventListener('click', endCG);
  cgAutoEnterTimer = setTimeout(endCG, 8000);
}

function skipCG() {
  if (cgTimeline) { cgTimeline.kill(); cgTimeline = null; }
  if (cgAutoEnterTimer) { clearTimeout(cgAutoEnterTimer); cgAutoEnterTimer = null; }
  const wrap = document.getElementById('cgSceneWrap');
  const visitor = localStorage.getItem('minicityUser') || '旅人';
  scene5(wrap, visitor);
}

function endCG() {
  if (cgTimeline) { cgTimeline.kill(); cgTimeline = null; }
  if (cgAutoEnterTimer) { clearTimeout(cgAutoEnterTimer); cgAutoEnterTimer = null; }
  localStorage.setItem('minicityCGSeen', 'true');
  const overlay = document.getElementById('cgOverlay');
  overlay.classList.remove('active');
  setTimeout(() => { overlay.style.display = 'none'; }, 600);
  proceedToCity();
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL SYSTEM — ancient paper dialog
// ══════════════════════════════════════════════════════════════════════════════

function setupModal() {
  document.getElementById('modalClose').addEventListener('click', closeModal);
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modalOverlay')) closeModal();
  });
}

function openModal(b) {
  const content = BUILDING_CONTENT[b.id];
  if (!content) return;
  const visitor = localStorage.getItem('minicityUser') || '旅人';

  document.getElementById('modalNum').textContent = b.num;
  document.getElementById('modalTitle').textContent = content.name;
  document.getElementById('modalSlogan').textContent = content.slogan;

  const body = document.getElementById('modalBody');
  body.innerHTML = '';
  content.dialog.forEach((line, i) => {
    const p = document.createElement('p');
    p.className = 'modal-line';
    p.textContent = line.replace(/\{Visitor\}/g, visitor);
    p.style.animationDelay = (0.35 + i * 0.22) + 's';
    body.appendChild(p);
  });

  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
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
