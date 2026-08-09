const I = (svg: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;

export const BUILDING_DEFS = [
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
  { id:'knowledgebaseE', num:'16', label:'实验知识库',   x:-15, z:-15, shape:'library',
    icon:I(`<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 4v16"/><path d="M11 8h5"/><path d="M11 12h4"/>`) },
  { id:'newsstand',     num:'17', label:'报摊',     x:-9,  z:-15, shape:'market',
    icon:I(`<path d="M4 7h16v11H4z"/><path d="M4 7l2-3h12l2 3"/><path d="M8 11h4"/><path d="M8 14h8"/>`) },
  { id:'community',     num:'18', label:'社区中心', x: 15, z:-15, shape:'clocktower',
    icon:I(`<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M7 11h2"/><path d="M15 11h2"/>`) },
  { id:'research',      num:'19', label:'研究院',   x: 15, z:-9,  shape:'factory',
    icon:I(`<path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 3h8"/><path d="M8 15h8"/>`) },
  { id:'commons',       num:'20', label:'众议院',   x:-15, z: 3,  shape:'temple',
    icon:I(`<path d="M3 10l9-6 9 6"/><path d="M5 10h14"/><path d="M7 10v8"/><path d="M12 10v8"/><path d="M17 10v8"/><path d="M4 18h16"/>`) },
  { id:'senate',        num:'21', label:'参议院',   x:-15, z: 9,  shape:'temple',
    icon:I(`<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M4 12h16"/>`) },
  { id:'writingclub',   num:'22', label:'文训社',   x:-15, z: 15, shape:'factory',
    icon:I(`<path d="M4 20l4-1 10-10a3 3 0 0 0-4-4L4 15z"/><path d="M13 6l5 5"/>`) },
  { id:'lab',           num:'23', label:'实验楼',   x: 15, z: 3,  shape:'greenhouse',
    icon:I(`<path d="M9 3h6"/><path d="M10 3v5l-4 9a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-9V3"/><path d="M8 16h8"/>`) },
  { id:'culturehall',   num:'24', label:'文化馆',   x: 15, z: 9,  shape:'screen',
    icon:I(`<path d="M4 5h16v14H4z"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="M6 19l3-4"/><path d="M18 19l-3-4"/>`) },
  { id:'teahouse',      num:'25', label:'茶馆',     x: 15, z: 15, shape:'pagoda',
    icon:I(`<path d="M5 10h12v3a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M17 11h1a2 2 0 0 1 0 4h-1"/><path d="M8 6c0-1 1-1 1-2"/><path d="M12 6c0-1 1-1 1-2"/>`) },
  // ── New city-life buildings (malls & schools) ──
  { id:'mall_south',    num:'26', label:'南门商场', x: 0,  z:-27, shape:'mall',
    icon:I(`<path d="M3 9l2-5h14l2 5"/><path d="M3 9v11h18V9"/><path d="M9 20v-5h6v5"/><path d="M3 13h18"/>`) },
  { id:'school_east',   num:'27', label:'东区小学', x: 27, z: 0,  shape:'school',
    icon:I(`<path d="M3 21h18"/><path d="M6 21V10l6-5 6 5v11"/><path d="M9 21v-5h6v5"/><path d="M4 10l8-5 8 5"/>`) },
  { id:'mall_west',     num:'28', label:'西门商场', x:-27, z: 0,  shape:'mall',
    icon:I(`<path d="M3 9l2-5h14l2 5"/><path d="M3 9v11h18V9"/><path d="M9 20v-5h6v5"/><path d="M3 13h18"/>`) },
  { id:'school_north',  num:'29', label:'北区学院', x: 0,  z: 27, shape:'school',
    icon:I(`<path d="M3 21h18"/><path d="M6 21V10l6-5 6 5v11"/><path d="M9 21v-5h6v5"/><path d="M4 10l8-5 8 5"/>`) },
  { id:'kingice',       num:'30', label:'King Ice',  x: 20, z: 20, shape:'crown',
    icon:I(`<path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>`) },
  // ── 外环扩展建筑 ──
  { id:'knowledgebaseD', num:'31', label:'黑洞知识库',   x:-33, z:-33, shape:'library',
    icon:I(`<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 4v16"/>`) },
  { id:'community',     num:'32', label:'社区中心', x: 33, z:-33, shape:'clocktower',
    icon:I(`<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>`) },
  { id:'commons',       num:'33', label:'众议院',   x:-33, z: 0,  shape:'temple',
    icon:I(`<path d="M3 10l9-6 9 6"/><path d="M5 10h14"/><path d="M7 10v8"/>`) },
  { id:'lab',           num:'34', label:'实验楼',   x: 33, z: 0,  shape:'greenhouse',
    icon:I(`<path d="M9 3h6"/><path d="M10 3v5l-4 9a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-9V3"/>`) },
  { id:'teahouse',      num:'35', label:'茶馆',     x: 33, z: 33, shape:'pagoda',
    icon:I(`<path d="M5 10h12v3a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M17 11h1a2 2 0 0 1 0 4h-1"/>`) },
  { id:'writingclub',   num:'36', label:'文训社',   x:-33, z: 33, shape:'factory', facade:'facade_library',
    icon:I(`<path d="M4 20l4-1 10-10a3 3 0 0 0-4-4L4 15z"/><path d="M13 6l5 5"/>`) },
  { id:'archive',       num:'37', label:'档案馆',   x:-21, z:-33, shape:'library', facade:'facade_board',
    icon:I(`<path d="M3 4h18v16H3z"/><path d="M7 4v16"/>`) },
  { id:'tradingpost',   num:'38', label:'交易所',   x: 21, z:-33, shape:'bank', facade:'facade_market',
    icon:I(`<path d="M3 10h18v8H3z"/><path d="M3 10l9-5 9 5"/>`) },
  { id:'records',       num:'39', label:'记录厅',   x:-33, z:-21, shape:'temple', facade:'facade_observatory',
    icon:I(`<path d="M4 4h16v16H4z"/><path d="M8 8h8"/>`) },
  { id:'guildhall',     num:'40', label:'公会堂',   x: 33, z:-21, shape:'clocktower', facade:'facade_tower',
    icon:I(`<path d="M6 20V8h12v12"/><path d="M4 8h16l-2-4H6z"/>`) },
  { id:'musichall',     num:'41', label:'音乐厅',   x:-21, z: 33, shape:'pavilion', facade:'facade_screen',
    icon:I(`<path d="M9 18V5l12-2v13"/><circle cx="6" cy="6" r="3"/>`) },
  { id:'conservatory',  num:'42', label:'温室',     x: 21, z: 33, shape:'greenhouse', facade:'facade_campus',
    icon:I(`<path d="M12 2L2 12h3v8h14v-8h3z"/>`) },
  { id:'arena',         num:'43', label:'竞技场',   x:-33, z: 21, shape:'factory', facade:'facade_clocktower',
    icon:I(`<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/>`) },
  { id:'guesthouse',    num:'44', label:'客栈',     x: 33, z: 21, shape:'pagoda', facade:'facade_kiosk',
    icon:I(`<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>`) },
  { id:'shrine',        num:'45', label:'神社',     x: 0, z:-33, shape:'altar', facade:'facade_temple',
    icon:I(`<path d="M4 20h16"/><path d="M6 20V8h12v12"/>`) },
  { id:'beacon',        num:'46', label:'灯塔',     x: 0, z: 33, shape:'tower', facade:'facade_darktower',
    icon:I(`<path d="M8 21V5l4-3 4 3v16"/><path d="M8 21h8"/>`) },
  // ── 特殊建筑 ──
  { id:'banana_palace',  num:'47', label:'布拿拉宫', x:-30, z: 30, shape:'banana',
    icon:I(`<path d="M6 14c0-4 2-8 6-8s6 4 6 8c0 3-2 6-6 6s-6-3-6-6z"/><path d="M12 6V3"/>`) },
  { id:'qipai_hall',     num:'48', label:'棋气派',   x: 30, z: 30, shape:'qipai',
    icon:I(`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>`) },
];

// Buildings with an entry here become configurable Physics Lab work queries.
// Keep the payload close to the city's fiction so adding a new query is data-only.
export const BUILDING_API_QUERIES = Object.freeze({
  // activity: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:null, ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:30, Sort:1, ShowAnnouncement:false },
  knowledgebaseE: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:['知识库'], ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:0, ShowAnnouncement:false },
  knowledgebaseD: { Category:'Discussion', Languages:[], ExcludeLanguages:null, Tags:['知识库'], ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:0, ShowAnnouncement:false },
  // litreview: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:['精选'], ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:1, ShowAnnouncement:false },
  blackhole: { Category:'Discussion', Languages:[], ExcludeLanguages:['小作品'], Tags:null, ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:1, ShowAnnouncement:true },
  culturehall: { Category:'Discussion', Languages:[], ExcludeLanguages:null, Tags:['文学'], ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:1, ShowAnnouncement:false },
  // lab: { Category:'Experiment', Languages:[], ExcludeLanguages:['小作品'], Tags:null, ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:0, ShowAnnouncement:false },
  // research: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:['大学'], ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:1, ShowAnnouncement:false },
  senate: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:['投票'], ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:1, ShowAnnouncement:false },
  // tradingpost: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:null, ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:'Favorite', Special:null, From:null, Skip:0, Take:24, Days:0, Sort:0, ShowAnnouncement:false },
  // records: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:null, ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:'Mine', Special:null, From:null, Skip:0, Take:24, Days:0, Sort:0, ShowAnnouncement:false },
});

// Materialize the optional query on every matching building definition so the
// renderer can treat this as ordinary building data instead of a hardcoded switch.
BUILDING_DEFS.forEach((building: any) => {
  const query = BUILDING_API_QUERIES[building.id as keyof typeof BUILDING_API_QUERIES];
  if (query) building.contentQuery = query;
});

// ── Building dialog content (from copywriting) ────────────────────────────────
export const BUILDING_CONTENT = {
  activity: {
    name:'活动区', slogan:'在这里领取你的货币吧。',
    dialog:[
      '钱袋落在柜台上，发出一声闷响。',
      '"在这里想要生存，没钱可不行。"柜台后面的人头也没抬，"必要的时候买些东西，以及……贿赂。"',
      '你会有越来越多的追随者，没钱给他们可不行。',
      '「马内的力量，还是大的。」',
      '你不会以为我们真做了这个功能吧'
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
  newsstand: {
    name:'报摊', slogan:'消息比路灯亮得更早。',
    dialog:['报纸叠在木箱上，墨迹还没完全干。','摊主说今天的头条换了三次，因为这座城总有人突然出现，也总有人突然消失。','「拿一份吧。知道发生了什么，至少能少走一点弯路。」']
  },
  research: {
    name:'研究院', slogan:'把未知拆开，再小心地装回去。',
    dialog:['白色塔楼里传来低频的嗡鸣，像某种机器正在思考。','研究员们不急着给答案，他们先把问题写得更清楚。','「别害怕复杂。复杂只是还没有被命名。」']
  },
  senate: {
    name:'参议院', slogan:'慢一点，才能决定更重的事。',
    dialog:['圆顶下的声音被压低，像每句话都要先经过墙壁审查。','这里不处理喧哗，只处理喧哗之后还剩下的问题。','「决定不是结束，是责任开始的地方。」']
  },
  culturehall: {
    name:'文化馆', slogan:'城的记忆在这里被展出。',
    dialog:['展厅里有模型、照片、手稿，还有一些无法归类的小东西。','它们不一定重要，但它们共同证明：这座城曾经被很多人认真使用过。','「文化不是纪念品，是居民留下的痕迹。」']
  },
  // ── New city-life dialogs ──
  mall_south: {
    name:'南门商场', slogan:'霓虹之下，欲望被精心陈列。',
    dialog:['自动门"嗖"地滑开，空调冷风裹住刚进来的你。','橱窗里陈列着进口商品、电子玩具、还有那些说不上有用但就是想买的小东西。','「城市之所以像城市，是因为这里永远有你想买却买不起的东西。」']
  },
  mall_west: {
    name:'西门商场', slogan:'旧街坊与霓虹的交界处。',
    dialog:['这间商场比南门那家旧些，但人却不显得少。','楼下菜场、楼上服饰，再往上是个改造过的电影院，只放老片。','「商业的层次，就是城市的层次。这里能买到全部日常。」']
  },
  school_east: {
    name:'东区小学', slogan:'操场上有种永远不变的笑声。',
    dialog:['铃声刚响过，孩子们从教室里涌出来，像被打翻的彩色弹珠。','旗杆上的旗被风吹得笔直，沙坑里留着上午的脚印。','「教育不是把城填满，是给下一座城留出空地。」']
  },
  school_north: {
    name:'北区学院', slogan:'这里教的不只是答案，更是提问的方法。',
    dialog:['学院的走廊安静得能听见自己的脚步回声。','黑板上还留着没擦干净的式子和一句未完的提问。','「一座城若不再产生提问，便已开始衰老。」']
  },
  kingice: {
    name:'King Ice', slogan:'皇冠落座之处，冰与光交界。',
    dialog:['这段话是ice自己写的，他直接推送到我代码仓库里面了']
  },
  archive: { name:'档案馆', slogan:'过去不会消失，只是被收了起来。', dialog:['厚重的木门后面是成排的铁柜，标签已经泛黄。','每份档案都是城里发生过的事的记录。','「要理解一座城为什么变成现在这样，得先看它做过什么。」'] },
  tradingpost: { name:'交易所', slogan:'价值在这里被反复称量。', dialog:['柜台上摆着各种代币和凭证。','这里不仅交易货币，还交换信息、服务和承诺。','「价格会波动，但信用不会。」'] },
  records: { name:'记录厅', slogan:'每一个名字背后都有故事。', dialog:['墙上密密麻麻刻着名字。','管理人员定期来核对，确保每个名字都对应一个真实的存在。','「被记住，是这座城给予居民最基本的尊重。」'] },
  guildhall: { name:'公会堂', slogan:'一个人走得快，一群人走得远。', dialog:['大堂里挂着各种旗帜，每面代表一个自发组织。','「加入一个公会，你会发现城市比想象的大。」'] },
  musichall: { name:'音乐厅', slogan:'声音也能成为建筑。', dialog:['穹顶下回荡着排练的旋律。','「不需要听懂，只需要听。」'] },
  conservatory: { name:'温室', slogan:'在最暖的地方种最嫩的芽。', dialog:['玻璃房里温度恒定，种着城外不易存活的植物。','「给条件足够的时间，一切都会发芽。」'] },
  arena: { name:'竞技场', slogan:'规则之内，尽情较量。', dialog:['圆形场地中央画着白线，四周的看台还是空的。','「赢得漂亮，输得坦然。」'] },
  guesthouse: { name:'客栈', slogan:'远道而来的人先在这里落脚。', dialog:['三层小楼，每层窗台上都放着一盏灯。','「明天的事明天再说。今晚先歇着。」'] },
  shrine: { name:'神社', slogan:'安静地站着，也是一种参与。', dialog:['石阶尽头是一座小小的殿宇。','「不必祈祷，只是站在这里就够了。」'] },
  beacon: { name:'灯塔', slogan:'为还没到的人亮着。', dialog:['塔顶的灯日夜不灭。','「总有人在路上。总有人需要一盏灯。」'] },
  banana_palace: { name:'布拿拉宫', slogan:'黄得发亮，歪得有理。', dialog:['一座巨大的香蕉造型建筑矗立在眼前，黄得耀眼。','布拿拉工站在门口，手里捧着一根小香蕉。','「我叫布拿拉工，是这宫的主人。宫不是宫殿的宫，是香蕉的弯。」','「你问我为什么住在香蕉里？因为这城里，总得有人住在不一样的地方。」'] },
  qipai_hall: { name:'棋气派', slogan:'落子无悔，入局即生。', dialog:['门口站着两尊巨型棋子雕像——一王一后。','地面铺着黑白棋盘格，每一步都踩在一格命运上。','「棋气派下的不是棋，是气。气断了，棋就散了。」'] },
  knowledgebase: { name:'知识库', slogan:'所有被保存的东西，都在这里继续发光。', dialog:['墙面像索引一样延伸，抽屉里收着旧讨论、旧作品。','「先查，再问。能留下来的东西，总会帮助下一个人。」'] },
  community: { name:'社区中心', slogan:'居民在这里互相确认彼此存在。', dialog:['大厅里挂着很多便签，有求助，有招募。','「一座城不是建出来的，是搭出来的。」'] },
  commons: { name:'众议院', slogan:'议事的厅堂，也是争论的起点。', dialog:['圆形大厅里摆着弧形的座位。','「多数不代表正确，但沉默一定不代表同意。」'] },
  lab: { name:'实验楼', slogan:'试错是这座城的燃料。', dialog:['玻璃门后是整齐的仪器和不太整齐的便签。','「不要把异常丢掉。异常有时候是入口。」'] },
  teahouse: { name:'茶馆', slogan:'暂时坐下，也是一种前进。', dialog:['茶香从窗缝里慢慢散出来。','「有些答案不会在奔跑时出现。坐一会儿。」'] },
  writingclub: { name:'文训社', slogan:'字是城的声音，写下来才不散。', dialog:['木桌木椅，墨迹未干。','「别怕写不好。先写下来，再改。」'] },
};

