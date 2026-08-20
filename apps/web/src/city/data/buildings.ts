import type { BuildingContentLike } from '../../adapters/ui/cityDialogController';

const I = (svg: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;

export const BUILDING_DEFS = [
  {
    id: "academy_library",
    num: "书院",
    label: "书院",
    x: 3,
    z: -15,
    shape: "academy",
    icon: I(`<path d="M4 19V8l8-4 8 4v11"/><path d="M8 19v-6h8v6"/><path d="M9 9h6"/><path d="M12 4v5"/>`),
  },
  {
    id: "activity",
    num: "01",
    label: "活动区",
    x: 4,
    z: -9,
    shape: "bank",
    icon: I(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>`),
  },
  {
    id: "bulletin",
    num: "02",
    label: "公告板",
    x: -4,
    z: -9,
    shape: "board",
    icon: I(
      `<rect x="4" y="5" width="16" height="14" rx="1"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>`,
    ),
  },
  {
    id: "techhalf",
    num: "03",
    label: "技术半城",
    x: 9,
    z: -3,
    shape: "tower",
    icon: I(
      `<polyline points="8 6 4 12 8 18"/><polyline points="16 6 20 12 16 18"/>`,
    ),
  },
  {
    id: "blackhole",
    num: "04",
    label: "黑洞半城",
    x: -9,
    z: -3,
    shape: "darktower",
    icon: I(
      `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2" fill="#3B6FE0"/>`,
    ),
  },
  {
    id: "laws",
    num: "05",
    label: "城的法则",
    x: 4,
    z: 3,
    shape: "pavilion",
    icon: I(
      `<path d="M12 3v18"/><path d="M6 8h12"/><path d="M6 8l-2 6h4z"/><path d="M18 8l-2 6h4z"/>`,
    ),
  },
  {
    id: "library",
    num: "06",
    label: "图书馆",
    x: -4,
    z: 3,
    shape: "library",
    icon: I(
      `<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M4 19a2 2 0 0 1 2-2h12"/>`,
    ),
  },
  {
    id: "litreview",
    num: "07",
    storyLocked: true,
    label: "文学审核部",
    x: -9,
    z: 3,
    shape: "ruins",
    icon: I(
      `<path d="M4 20V8l5-4 5 4v8"/><path d="M14 20V12l6-3v11"/><line x1="4" y1="20" x2="20" y2="20"/>`,
    ),
  },
  {
    id: "catcafe",
    num: "08",
    label: "猫咖馆",
    x: 9,
    z: 3,
    shape: "skyscraper",
    icon: I(
      `<path d="M6 8V5l3 2"/><path d="M18 8V5l-3 2"/><path d="M5 10c0-2 2-3 7-3s7 1 7 3v5c0 3-3 5-7 5s-7-2-7-5z"/>`,
    ),
  },
  {
    id: "academy",
    num: "09",
    label: "物实学院",
    x: 4,
    z: 9,
    shape: "campus",
    icon: I(
      `<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1 2.5 3 6 3s6-2 6-3v-5"/>`,
    ),
  },
  {
    id: "news",
    num: "10",
    label: "星尘报社",
    x: -4,
    z: 9,
    shape: "kiosk",
    icon: I(
      `<rect x="3" y="5" width="18" height="14" rx="1"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/><line x1="7" y1="17" x2="13" y2="17"/>`,
    ),
  },
  {
    id: "mutualaid",
    num: "11",
    label: "互助团",
    x: -9,
    z: 9,
    shape: "kiosk",
    icon: I(
      `<path d="M12 21s-7-5-7-11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-7 11-7 11z"/>`,
    ),
  },
  {
    id: "screen",
    num: "12",
    label: "大屏幕",
    x: 9,
    z: 9,
    shape: "screen",
    icon: I(
      `<rect x="3" y="4" width="18" height="13" rx="1"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/>`,
    ),
  },
  {
    id: "elevator",
    num: "13",
    label: "纪念碑",
    x: 9,
    z: -9,
    shape: "shaft",
    icon: I(
      `<rect x="6" y="3" width="12" height="18" rx="1"/><line x1="10" y1="8" x2="12" y2="6"/><line x1="12" y1="6" x2="14" y2="8"/><line x1="10" y1="16" x2="12" y2="18"/><line x1="12" y1="18" x2="14" y2="16"/>`,
    ),
  },
  {
    id: "residentid",
    num: "14",
    label: "居民证",
    x: -9,
    z: -9,
    shape: "altar",
    icon: I(
      `<rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="8" cy="12" r="2"/><line x1="13" y1="11" x2="18" y2="11"/><line x1="13" y1="14" x2="16" y2="14"/>`,
    ),
  },
  {
    id: "stats",
    num: "15",
    label: "STATS",
    x: -5.5,
    z: -5.5,
    shape: "observatory",
    isStats: true,
    icon: I(
      `<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`,
    ),
  },
  {
    id: "knowledgebaseE",
    num: "16",
    label: "实验知识库",
    x: -15,
    z: -15,
    shape: "library",
    icon: I(
      `<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 4v16"/><path d="M11 8h5"/><path d="M11 12h4"/>`,
    ),
  },
  {
    id: "newsstand",
    num: "17",
    label: "报摊",
    x: -9,
    z: -15,
    shape: "market",
    icon: I(
      `<path d="M4 7h16v11H4z"/><path d="M4 7l2-3h12l2 3"/><path d="M8 11h4"/><path d="M8 14h8"/>`,
    ),
  },
  {
    id: "community",
    num: "18",
    label: "社区中心",
    x: 15,
    z: -15,
    shape: "clocktower",
    icon: I(
      `<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M7 11h2"/><path d="M15 11h2"/>`,
    ),
  },
  {
    id: "research",
    num: "19",
    label: "研究院",
    x: 15,
    z: -9,
    shape: "factory",
    icon: I(
      `<path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 3h8"/><path d="M8 15h8"/>`,
    ),
  },
  {
    id: "commons",
    num: "20",
    label: "众议院",
    x: -15,
    z: 3,
    shape: "temple",
    icon: I(
      `<path d="M3 10l9-6 9 6"/><path d="M5 10h14"/><path d="M7 10v8"/><path d="M12 10v8"/><path d="M17 10v8"/><path d="M4 18h16"/>`,
    ),
  },
  {
    id: "senate",
    num: "21",
    label: "参议院",
    x: -15,
    z: 9,
    shape: "temple",
    icon: I(
      `<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M4 12h16"/>`,
    ),
  },
  {
    id: "writingclub",
    num: "22",
    label: "文训社",
    x: -15,
    z: 15,
    shape: "factory",
    icon: I(
      `<path d="M4 20l4-1 10-10a3 3 0 0 0-4-4L4 15z"/><path d="M13 6l5 5"/>`,
    ),
  },
  {
    id: "lab",
    num: "23",
    label: "实验楼",
    x: 15,
    z: 3,
    shape: "greenhouse",
    icon: I(
      `<path d="M9 3h6"/><path d="M10 3v5l-4 9a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-9V3"/><path d="M8 16h8"/>`,
    ),
  },
  {
    id: "culturehall",
    num: "24",
    label: "文化馆",
    x: 15,
    z: 9,
    shape: "screen",
    icon: I(
      `<path d="M4 5h16v14H4z"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="M6 19l3-4"/><path d="M18 19l-3-4"/>`,
    ),
  },
  {
    id: "teahouse",
    num: "25",
    label: "茶馆",
    x: 15,
    z: 15,
    shape: "pagoda",
    icon: I(
      `<path d="M5 10h12v3a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M17 11h1a2 2 0 0 1 0 4h-1"/><path d="M8 6c0-1 1-1 1-2"/><path d="M12 6c0-1 1-1 1-2"/>`,
    ),
  },
  // ── New city-life buildings (malls & schools) ──
  {
    id: "photostudio",
    num: "26A",
    label: "照相馆",
    x: 21,
    z: 15,
    shape: "kiosk",
    facade: "facade_market",
    icon: I(`<rect x="3" y="7" width="18" height="12" rx="1"/><circle cx="12" cy="13" r="3"/><path d="M7 7l2-3h6l2 3"/>`),
  },
  {
    id: "mall_south",
    num: "26",
    // <discussion=654782b83b13265ec0206f9a>五金月饼&一瓶农夫山泉『金月店』</discussion>
    label: "金月店",
    x: 22.5,
    z: -22.5,
    shape: "mall",
    icon: I(
      `<path d="M3 9l2-5h14l2 5"/><path d="M3 9v11h18V9"/><path d="M9 20v-5h6v5"/><path d="M3 13h18"/>`,
    ),
  },
  {
    id: "school_east",
    num: "27",
    label: "东区小学",
    x: 31.5,
    z: -15.25,
    shape: "school",
    icon: I(
      `<path d="M3 21h18"/><path d="M6 21V10l6-5 6 5v11"/><path d="M9 21v-5h6v5"/><path d="M4 10l8-5 8 5"/>`,
    ),
  },
  {
    id: "mall_west",
    num: "28",
    // <discussion=6738a487ce449cb493cd6349>小店</discussion>
    label: "断星玄",
    x: -22.5,
    z: 22.5,
    shape: "mall",
    icon: I(
      `<path d="M3 9l2-5h14l2 5"/><path d="M3 9v11h18V9"/><path d="M9 20v-5h6v5"/><path d="M3 13h18"/>`,
    ),
  },
  {
    id: "school_north",
    num: "29",
    label: "北区学院",
    x: -22.5,
    z: 15,
    shape: "school",
    icon: I(
      `<path d="M3 21h18"/><path d="M6 21V10l6-5 6 5v11"/><path d="M9 21v-5h6v5"/><path d="M4 10l8-5 8 5"/>`,
    ),
  },
  {
    id: "kingice",
    num: "30",
    label: "King Ice",
    x: 20,
    z: 20,
    shape: "crown",
    icon: I(`<path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>`),
  },
  // ── 外环扩展建筑 ──
  {
    id: "knowledgebaseD",
    num: "31",
    label: "黑洞知识库",
    x: -33,
    z: -33,
    shape: "library",
    icon: I(
      `<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 4v16"/>`,
    ),
  },
  {
    id: "community_outer",
    num: "32",
    label: "社区中心（外环）",
    x: 33,
    z: -33,
    shape: "clocktower",
    icon: I(`<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>`),
  },
  {
    id: "commons_outer",
    num: "33",
    label: "众议院（外环）",
    x: -33,
    z: -9,
    shape: "temple",
    icon: I(`<path d="M3 10l9-6 9 6"/><path d="M5 10h14"/><path d="M7 10v8"/>`),
  },
  {
    id: "lab_outer",
    num: "34",
    label: "数据中心",
    x: 33,
    z: 9,
    shape: "greenhouse",
    icon: I(
      `<path d="M9 3h6"/><path d="M10 3v5l-4 9a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-9V3"/>`,
    ),
  },
  {
    id: "teahouse_outer",
    num: "35",
    disabled: true,
    label: "茶馆（外环）",
    x: 33,
    z: 33,
    shape: "pagoda",
    icon: I(
      `<path d="M5 10h12v3a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M17 11h1a2 2 0 0 1 0 4h-1"/>`,
    ),
  },
  {
    id: "writingclub_outer",
    num: "36",
    label: "野生菌餐馆",
    x: -33,
    z: 3,
    shape: "wild_mushroom_restaurant",
    icon: I(
      `<path d="M4 10h16v10H4z"/><path d="M3 10h18"/><path d="M6 6v4M12 6v4M18 6v4"/><path d="M8 14h8v6H8z"/>`,
    ),
  },
  {
    id: "film_city",
    num: "50",
    label: "物实影视城",
    x: -9,
    z: -21,
    shape: "film_city",
    icon: I(`<rect x="3" y="7" width="14" height="12" rx="2"/><path d="m17 11 4-2v8l-4-2z"/><path d="M6 7 8 3h4l2 4"/>`),
  },
  {
    id: "archive",
    num: "37",
    label: "档案馆",
    x: -21,
    z: -33,
    shape: "library",
    facade: "facade_board",
    icon: I(`<path d="M3 4h18v16H3z"/><path d="M7 4v16"/>`),
  },
  {
    id: "tradingpost",
    num: "38",
    label: "交易所",
    x: 21,
    z: -33,
    shape: "bank",
    facade: "facade_market",
    icon: I(`<path d="M3 10h18v8H3z"/><path d="M3 10l9-5 9 5"/>`),
  },
  {
    id: "records",
    num: "39",
    label: "记录厅",
    x: -33,
    z: -21,
    shape: "temple",
    facade: "facade_observatory",
    icon: I(`<path d="M4 4h16v16H4z"/><path d="M8 8h8"/>`),
  },
  {
    id: "guildhall",
    num: "40",
    label: "公会堂",
    x: 33,
    z: -21,
    shape: "clocktower",
    facade: "facade_tower",
    icon: I(`<path d="M6 20V8h12v12"/><path d="M4 8h16l-2-4H6z"/>`),
  },
  {
    id: "musichall",
    num: "41",
    label: "音乐厅",
    x: -21,
    z: 33,
    shape: "pavilion",
    facade: "facade_screen",
    icon: I(`<path d="M9 18V5l12-2v13"/><circle cx="6" cy="6" r="3"/>`),
  },
  {
    id: "conservatory",
    num: "42",
    label: "温室",
    x: 21,
    z: 33,
    shape: "greenhouse",
    facade: "facade_campus",
    icon: I(`<path d="M12 2L2 12h3v8h14v-8h3z"/>`),
  },
  {
    id: "arena",
    num: "43",
    label: "竞技场",
    x: -33,
    z: 21,
    shape: "factory",
    facade: "facade_clocktower",
    icon: I(
      `<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/>`,
    ),
  },
  {
    id: "guesthouse",
    num: "44",
    label: "客栈",
    x: 33,
    z: 21,
    shape: "pagoda",
    facade: "facade_kiosk",
    icon: I(`<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>`),
  },
  {
    id: "shrine",
    num: "45",
    label: "神社",
    x: 9,
    z: -33,
    shape: "altar",
    facade: "facade_temple",
    icon: I(`<path d="M4 20h16"/><path d="M6 20V8h12v12"/>`),
  },
  {
    id: "beacon",
    num: "46",
    label: "灯塔",
    x: 9,
    z: 31.5,
    shape: "tower",
    facade: "facade_darktower",
    icon: I(`<path d="M8 21V5l4-3 4 3v16"/><path d="M8 21h8"/>`),
  },
  // ── 特殊建筑 ──
  {
    id: "banana_palace",
    num: "47",
    label: "布拿拉宫",
    x: -30,
    z: 30,
    shape: "banana",
    icon: I(
      `<path d="M6 14c0-4 2-8 6-8s6 4 6 8c0 3-2 6-6 6s-6-3-6-6z"/><path d="M12 6V3"/>`,
    ),
  },
  {
    id: "qipai_hall",
    num: "48",
    label: "棋气派",
    x: 30,
    z: 30,
    shape: "qipai",
    icon: I(
      `<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>`,
    ),
  },
  {
    id: "wushi_restaurant",
    num: "49",
    label: "物实饭店",
    x: -22.5,
    z: -15,
    shape: "restaurant",
    icon: I(`<path d="M4 20V7h16v13"/><path d="M7 20v-7h4v7"/><path d="M14 11h3"/><path d="M6 4h12v3H6z"/>`),
  },
  {
    id: "television_tower",
    num: "53",
    label: "电视塔",
    x: 32,
    z: -8,
    shape: "television_tower",
    icon: I(`<path d="M12 3v18"/><path d="M8 21h8"/><path d="M7 9h10"/><path d="M5 5c2 2 2 5 0 7"/><path d="M19 5c-2 2-2 5 0 7"/>`),
  },
  {
    id: "fried_chicken_shop",
    num: "51",
    label: "炸鸡店",
    x: 28,
    z: 2,
    shape: "fried_chicken_shop",
    icon: I(`<path d="M4 20V9h16v11"/><path d="M3 9h18"/><path d="M6 5h12v4"/><path d="M9 14h6"/>`),
  },
  {
    id: "tavern",
    num: "52",
    label: "酒馆",
    x: 33,
    z: 3,
    shape: "tavern",
    icon: I(`<path d="M5 20V8l7-4 7 4v12"/><path d="M9 20v-6h6v6"/><path d="M7 11h10"/>`),
  },
];

// Buildings with an entry here become configurable Physics Lab work queries.
// Keep the payload close to the city's fiction so adding a new query is data-only.
export const BUILDING_API_QUERIES = Object.freeze({
  // activity: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:null, ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:30, Sort:1, ShowAnnouncement:false },
  knowledgebaseE: {
    title: "实验知识库",
    Category: "Experiment",
    Languages: [],
    ExcludeLanguages: null,
    Tags: ["知识库"],
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: null,
    Special: null,
    From: null,
    Skip: 0,
    Take: 24,
    Days: 0,
    Sort: 0,
    ShowAnnouncement: false,
  },
  knowledgebaseD: {
    title: "黑洞知识库",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: ["知识库"],
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: null,
    Special: null,
    From: null,
    Skip: 0,
    Take: 24,
    Days: 0,
    Sort: 0,
    ShowAnnouncement: false,
  },
  // litreview: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:['精选'], ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:1, ShowAnnouncement:false },
  blackhole: {
    title: "黑洞半城",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: ["小作品"],
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: null,
    Special: null,
    From: null,
    Skip: 0,
    Take: 24,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: true,
  },
  // culturehall: 点击已改为打开右侧"物实作家图鉴"面板（见 writerCatalogController），不再走社区作品查询。
  // lab: { Category:'Experiment', Languages:[], ExcludeLanguages:['小作品'], Tags:null, ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:0, ShowAnnouncement:false },
  // research: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:['大学'], ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:null, Special:null, From:null, Skip:0, Take:24, Days:0, Sort:1, ShowAnnouncement:false },
  senate: {
    title: "参议院",
    Category: "Experiment",
    Languages: [],
    ExcludeLanguages: null,
    Tags: ["投票"],
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: null,
    Special: null,
    From: null,
    Skip: 0,
    Take: 24,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },
  // tradingpost: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:null, ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:'Favorite', Special:null, From:null, Skip:0, Take:24, Days:0, Sort:0, ShowAnnouncement:false },
  // records: { Category:'Experiment', Languages:[], ExcludeLanguages:null, Tags:null, ExcludeTags:null, ModelTags:null, ModelID:null, ParentID:null, UserID:'Mine', Special:null, From:null, Skip:0, Take:24, Days:0, Sort:0, ShowAnnouncement:false },
});

// Materialize the optional query on every matching building definition so the
// renderer can treat this as ordinary building data instead of a hardcoded switch.
type BuildingDefWithQuery = typeof BUILDING_DEFS[number] & { contentQuery?: Record<string, unknown> };
BUILDING_DEFS.forEach((building: BuildingDefWithQuery) => {
  const query =
    BUILDING_API_QUERIES[building.id as keyof typeof BUILDING_API_QUERIES];
  if (query) building.contentQuery = query;
});

// ── Building dialog content (from copywriting) ────────────────────────────────
export const BUILDING_CONTENT: Record<string, BuildingContentLike> = {
  activity: {
    name: "活动区",
    slogan: "在这里领取你的货币吧。",
    dialog: [
      "钱袋落在柜台上，发出一声闷响。",
      '"在这里想要生存，没钱可不行。"柜台后面的人头也没抬，"必要的时候买些东西，以及……贿赂。"',
      "你会有越来越多的追随者，没钱给他们可不行。",
      "「马内的力量，还是大的。」",
      "你不会以为我们真做了这个功能吧",
    ],
  },
  bulletin: {
    name: "公告板",
    slogan: "一块镶了铁框、加了雨棚的木板。",
    dialog: [
      "一块普通的大木板，用铁镶了框，还安了雨棚。很明显，这里最近有人来修过。",
      "纸页都有些发黄了，不过还牢牢粘在上面，不掉下来。凑近一点好好看看——并非传单或小报，而是一堆公告。写这些公告的人做事一定特别有条理，句句分明，就是潦草了些。",
      "你正看着，一个空旷的声音忽然响起：",
      "「一座城市，怎么会没有管理人员呢？」",
      '——哦？难道这里还有"管理人员"？',
    ],
  },
  techhalf: {
    name: "技术半城",
    slogan: "你完全可以相信这里。",
    dialog: [
      "这里的所有居民都是知识居民，都是很友善的。",
      "但它对你没有那么友好——在你真正成为居民之前，也就是当你不再需要这本手册时，你才会体会到这里的乐趣。",
      "也就是说，在别的地方，可能会有危险。",
      '也有一些新居民偏偏喜欢这里，我们称他们为"新知者"。总有一些另一个半城的居民混进来，管理人员的部分工作，就是把他们请回去。他们居住的房子，我们叫"水实验"。',
      "「建议：熟悉这里之前，少接触这个区。」",
    ],
  },
  blackhole: {
    name: "黑洞半城",
    slogan: "这里包容一切。",
    dialog: [
      "正如名字所说的，这里包容一切。你会找到朋友，也会发现……黑暗。",
      '这里的人鱼龙混杂，尽量避免和坏人接触。什么是坏人？那些被"封禁"的人，他们的"居民权限"失效了——有些只是暂时的，有些是永远的。',
      "不过，我们允许你展示自己的存在，你可以在半城发布你的作品。在这个半城，你可以做作家、数学家、历史学家……某些方面，它比技术半城更多元。",
      "「无论在哪一个半城，那些发布'水作品'极多的人，都被称为'伪用户'。」",
    ],
  },
  laws: {
    name: "城的法则",
    slogan: "你违反的每一条法则，都会化作你不甘的泪水。",
    dialog: [
      "一卷羊皮纸摊在石台上，字迹工整得近乎冰冷。",
      "谨记，认真思考管理人员的每一次警告，他们对你的生活有很大影响。",
      "你要做一个好公民。",
      "「法则不是束缚，是这座城还在运转的理由。」",
    ],
  },
  library: {
    name: "图书馆",
    slogan: "这里是珍藏知识的地方。",
    dialog: [
      "推门进去，空气里是旧纸和木头的味道。",
      "技术半城的人们绞尽脑汁，为大家做出了一些优质作品，他们为了让更多人居住在技术半城而努力贡献。如果你选择住在技术半城，一些基本的知识你要明白——《实验记录》会给予你很大帮助。",
      "黑洞半城的人们也不落后，有些大佬就出现在这个半城。《这都是知识》里收录了他们的智慧。",
      "想当管理人员？翻开《志愿者要求一览》——志愿者是管理人员的基础。怀念外部世界吗？了解一下法律吧，这对你回去有很大帮助。",
      '角落里，一本厚厚的《物实百科全书》静静躺着，记载着这座城的历史与文化。旁边的小说合集，则承诺"文学可以带给你乐趣"。',
      "「招募图书管理员、收集员，欢迎大家。」",
      "待收集：杂文　未完整：小说",
    ],
  },
  litreview: {
    name: "文学审核部",
    slogan: "「已废弃」",
    dialog: [
      "你看到一行脚印，顺着它走了过去。脚印越来越杂乱。",
      "一栋古里古气的大房子，门前脚印十分杂乱，管理者似乎匆匆忙忙地离开的。门前挂着褪色的牌匾：文学审核部。",
      "原来所有书进图书馆之前都要经过他们的审核。权力还是蛮大的，或许他们有一部分人员就是管理人员。",
      "真令人痛心，这么气宇轩昂的组织……",
      "「已废弃。」",
      "告示板上的字迹还没干透。",
    ],
  },
  catcafe: {
    name: "物实猫咖馆",
    slogan: "闲暇时光来撸猫也不错。",
    dialog: [
      "一栋高得看不到顶的楼，门牌上画着一只打哈欠的猫。",
      "趁着三月的暖阳，和着微风听听风铃吧。",
      "不过，这可是高达 15000 多层的楼哦。",
      "还有——小心军火！",
      "「猫在窗台上眯着眼，像是已经在这里等了你很久。」",
    ],
  },
  academy: {
    name: "物实学院",
    slogan: "文化一条街。",
    dialog: [
      "现代化的大楼立在老街尽头，玻璃幕墙反着光。",
      "这貌似是一个学校，不知道里面是什么样子。咦，这里面的课程好像对我们的生存很有帮助。",
      "面前出现了一个五角星。这里可以收藏吗？拿着这些课，以后或许有用。",
      "「知识不是必需品，是奢侈品——但在物实，它两者都是。」",
    ],
  },
  news: {
    name: "星尘报社",
    slogan: "隶属于 SNO.星尘报社总部。",
    dialog: [
      '"拿着这份报纸吧！"',
      "你抬起头，想问他是哪个报社的。可那个人已经消失了。",
      "你看了看手中的报纸。报纸上写着：",
      "「隶属于 SNO.星尘报社总部」",
      "真有意思，连这都有。看起来，要在这里待一段时间了。",
      "「新闻是这座城里唯一比法则跑得更快的东西。」",
    ],
  },
  mutualaid: {
    name: "互助团",
    slogan: "你有什么需要吗？",
    dialog: [
      "一张广告贴在墙上，边角被风掀起。",
      "互助团成立了！你有什么需要吗？快来这里投稿吧，我们会尽所可能的帮助你！",
      '你对着空气说："我怎么能离开这里？"',
      "「抱歉，我们属于这里，无法帮你离开。」",
      "不要灰心。这个组织还是很有用的。",
      "「能帮的，他们都会帮。不能帮的，只有你自己。」",
    ],
  },
  screen: {
    name: "大屏幕",
    slogan: "闪着荧荧的光。",
    dialog: [
      "这条街竟然有尽头。尽头的墙上夹着一块大屏幕，闪着荧荧的光。",
      "屏幕亮起：",
      "你好，欢迎来到物实！",
      "有几点你需要注意：",
      "1. 一定要尊敬管理员们，尤其是紫兰斋。",
      "2. 不要理会那些骂人、刷屏的居民。",
      '3. 如果你是管理人员，记住，你的责任就是"移水"和"处理事件"，不要借着管理人员的名义去……（模糊）',
      "4. 尽量发布一些有意义的作品，否则你会失去一些货币。",
      "5. 请一定把这个大屏幕拆下来揣在兜里。不要担心它会消失——下一个来这里的人，同样也会看到它。",
      "「屏幕可以带走，规则要留下。」",
    ],
  },
  elevator: {
    name: "纪念碑",
    slogan: "我们会尽快修复其他按钮。",
    dialog: [
      "你拆下了大屏幕，却发现它后面藏着一架电梯。",
      "门缓缓打开，内部的按钮泛着幽光：",
      "⑤　④　③　②　①　-①",
      "「我们会尽快修复其他按钮。」",
      "一张便签贴在按钮旁，字迹潦草：每一层都是一座城的一部分，但不是每一层都还在。",
      "「选择你的楼层。」",
    ],
  },
  residentid: {
    name: "居民证",
    slogan: "请撕下这张纸，作为你的居民证。",
    dialog: [
      "一张纸静静躺在石台上，边角整齐。",
      "——————————————————",
      "{Visitor}",
      "我会遵守《这个城的法则》，我已阅读《居民生存指南》。",
      "——————————————————",
      "如你遇到 Bug 类困难，请联系 turtlesim。",
      "你要参与这个故事的话，就请签上你的名字。",
      "「签名之后，你就是这座城的人了。」",
    ],
  },
  newsstand: {
    name: "报摊",
    slogan: "消息比路灯亮得更早。",
    dialog: [
      "报纸叠在木箱上，墨迹还没完全干。",
      "摊主说今天的头条换了三次，因为这座城总有人突然出现，也总有人突然消失。",
      "「拿一份吧。知道发生了什么，至少能少走一点弯路。」",
    ],
  },
  research: {
    name: "研究院",
    slogan: "把未知拆开，再小心地装回去。",
    dialog: [
      "白色塔楼里传来低频的嗡鸣，像某种机器正在思考。",
      "研究员们不急着给答案，他们先把问题写得更清楚。",
      "「别害怕复杂。复杂只是还没有被命名。」",
    ],
  },
  senate: {
    name: "参议院",
    slogan: "慢一点，才能决定更重的事。",
    dialog: [
      "圆顶下的声音被压低，像每句话都要先经过墙壁审查。",
      "这里不处理喧哗，只处理喧哗之后还剩下的问题。",
      "「决定不是结束，是责任开始的地方。」",
    ],
  },
  culturehall: {
    name: "文化馆",
    slogan: "城的记忆在这里被展出。",
    dialog: [
      "展厅里有模型、照片、手稿，还有一些无法归类的小东西。",
      "它们不一定重要，但它们共同证明：这座城曾经被很多人认真使用过。",
      "「文化不是纪念品，是居民留下的痕迹。」",
    ],
  },
  // ── New city-life dialogs ──
  mall_south: {
    name: "金月店",
    slogan: "霓虹之下，欲望被精心陈列。",
    dialog: [
      '自动门"嗖"地滑开，空调冷风裹住刚进来的你。',
      "橱窗里陈列着进口商品、电子玩具、还有那些说不上有用但就是想买的小东西。",
      "「城市之所以像城市，是因为这里永远有你想买却买不起的东西。」",
    ],
  },
  mall_west: {
    name: "断星玄",
    slogan: "旧街坊与霓虹的交界处。",
    dialog: [
      "这间商场比南门那家旧些，但人却不显得少。",
      "楼下菜场、楼上服饰，再往上是个改造过的电影院，只放老片。",
      "「商业的层次，就是城市的层次。这里能买到全部日常。」",
    ],
  },
  school_east: {
    name: "东区小学",
    slogan: "操场上有种永远不变的笑声。",
    dialog: [
      "铃声刚响过，孩子们从教室里涌出来，像被打翻的彩色弹珠。",
      "旗杆上的旗被风吹得笔直，沙坑里留着上午的脚印。",
      "「教育不是把城填满，是给下一座城留出空地。」",
    ],
  },
  school_north: {
    name: "北区学院",
    slogan: "这里教的不只是答案，更是提问的方法。",
    dialog: [
      "学院的走廊安静得能听见自己的脚步回声。",
      "黑板上还留着没擦干净的式子和一句未完的提问。",
      "「一座城若不再产生提问，便已开始衰老。」",
    ],
  },
  kingice: {
    name: "King Ice",
    slogan: "皇冠落座之处，冰与光交界。",
    dialog: ["这段话是ice自己写的，他直接推送到我代码仓库里面了"],
  },
  archive: {
    name: "档案馆",
    slogan: "过去不会消失，只是被收了起来。",
    dialog: [
      "厚重的木门后面是成排的铁柜，标签已经泛黄。",
      "每份档案都是城里发生过的事的记录。",
      "「要理解一座城为什么变成现在这样，得先看它做过什么。」",
    ],
  },
  tradingpost: {
    name: "交易所",
    slogan: "价值在这里被反复称量。",
    dialog: [
      "柜台上摆着各种代币和凭证。",
      "这里不仅交易货币，还交换信息、服务和承诺。",
      "「价格会波动，但信用不会。」",
    ],
  },
  records: {
    name: "记录厅",
    slogan: "每一个名字背后都有故事。",
    dialog: [
      "墙上密密麻麻刻着名字。",
      "管理人员定期来核对，确保每个名字都对应一个真实的存在。",
      "「被记住，是这座城给予居民最基本的尊重。」",
    ],
  },
  guildhall: {
    name: "公会堂",
    slogan: "一个人走得快，一群人走得远。",
    dialog: [
      "大堂里挂着各种旗帜，每面代表一个自发组织。",
      "「加入一个公会，你会发现城市比想象的大。」",
    ],
  },
  musichall: {
    name: "音乐厅",
    slogan: "声音也能成为建筑。",
    dialog: ["穹顶下回荡着排练的旋律。", "「不需要听懂，只需要听。」"],
  },
  conservatory: {
    name: "温室",
    slogan: "在最暖的地方种最嫩的芽。",
    dialog: [
      "玻璃房里温度恒定，种着城外不易存活的植物。",
      "「给条件足够的时间，一切都会发芽。」",
    ],
  },
  arena: {
    name: "竞技场",
    slogan: "规则之内，尽情较量。",
    dialog: [
      "圆形场地中央画着白线，四周的看台还是空的。",
      "「赢得漂亮，输得坦然。」",
    ],
  },
  guesthouse: {
    name: "客栈",
    slogan: "远道而来的人先在这里落脚。",
    dialog: [
      "三层小楼，每层窗台上都放着一盏灯。",
      "「明天的事明天再说。今晚先歇着。」",
    ],
  },
  shrine: {
    name: "神社",
    slogan: "安静地站着，也是一种参与。",
    dialog: ["石阶尽头是一座小小的殿宇。"],
    dialogTree: [
      {
        text: "听说神社正在举办一个拔刀的活动，只有天选之人才能把刀从石头中拔出来。",
        options: [
          { text: "让我试试！", next: 1 },
          { text: "这不对吧？", next: 1 },
        ],
      },
      {
        text: "不知道为什么，你情不自禁地接受了这个挑战。",
        options: [
          { text: "用力拔", next: 2 },
          { text: "轻轻的拔", next: 2 },
        ],
      },
      {
        text: "宝刀就在眼前，决定命运的时刻到了。",
        options: [{
          text: "继续",
          next: 3,
          nextByVisitor: { includes: ["有地", "将臣"], maxLength: 5, next: 4 },
        }],
      },
      {
        text: "宝刀纹丝不动，可能是你的用户名起的不对吧。",
        options: [{ text: "告辞", next: null }],
      },
      {
        text: "你竟然把它拔出来了！",
        options: [{ text: "然后呢？", next: null, action: "open-url:https://store.steampowered.com/app/1144400/_?l=schinese" }],
      },
    ],
  },
  beacon: {
    name: "灯塔",
    slogan: "为还没到的人亮着。",
    dialog: ["塔顶的灯日夜不灭。", "「总有人在路上。总有人需要一盏灯。」"],
  },
  banana_palace: {
    name: "布拿拉宫",
    slogan: "黄得发亮，歪得有理。",
    dialog: [
      "一座巨大的香蕉造型建筑矗立在眼前，黄得耀眼。",
      "布拿拉工站在门口，手里捧着一根小香蕉。",
      "「我叫布拿拉工，是这宫的主人。宫不是宫殿的宫，是香蕉的弯。」",
      "「你问我为什么住在香蕉里？因为这城里，总得有人住在不一样的地方。」",
    ],
  },
  qipai_hall: {
    name: "棋气派",
    slogan: "落子无悔，入局即生。",
    dialog: [
      "门口站着两尊巨型棋子雕像——一王一后。",
      "地面铺着黑白棋盘格，每一步都踩在一格命运上。",
      "「棋气派下的不是棋，是气。气断了，棋就散了。」",
    ],
  },
  knowledgebase: {
    name: "知识库",
    slogan: "所有被保存的东西，都在这里继续发光。",
    dialog: [
      "墙面像索引一样延伸，抽屉里收着旧讨论、旧作品。",
      "「先查，再问。能留下来的东西，总会帮助下一个人。」",
    ],
  },
  community: {
    name: "社区中心",
    slogan: "居民在这里互相确认彼此存在。",
    dialog: [
      "大厅里挂着很多便签，有求助，有招募。",
      "「一座城不是建出来的，是搭出来的。」",
    ],
  },
  community_outer: {
    name: "社区中心（外环）",
    slogan: "居民在这里互相确认彼此存在。",
    dialog: [
      "大厅里挂着很多便签，有求助，有招募。",
      "「一座城不是建出来的，是搭出来的。」",
    ],
  },
  commons: {
    name: "众议院",
    slogan: "议事的厅堂，也是争论的起点。",
    dialog: [
      "圆形大厅里摆着弧形的座位。",
      "「多数不代表正确，但沉默一定不代表同意。」",
    ],
  },
  commons_outer: {
    name: "众议院（外环）",
    slogan: "议事的厅堂，也是争论的起点。",
    dialog: [
      "圆形大厅里摆着弧形的座位。",
      "「多数不代表正确，但沉默一定不代表同意。」",
    ],
  },
  lab: {
    name: "实验楼",
    slogan: "试错是这座城的燃料。",
    dialog: [
      "玻璃门后是整齐的仪器和不太整齐的便签。",
      "「不要把异常丢掉。异常有时候是入口。」",
    ],
  },
  lab_outer: {
    name: "数据中心",
    slogan: "数据即星辰，也即尘埃。",
    dialog: [
      "一排排机柜亮着冷静的蓝光，风扇声低鸣不止。",
      "「这里保存着这座城所有被记住的数据。」",
    ],
  },
  teahouse: {
    name: "茶馆",
    slogan: "暂时坐下，也是一种前进。",
    dialog: [
      "茶香从窗缝里慢慢散出来。",
      "「有些答案不会在奔跑时出现。坐一会儿。」",
    ],
  },
  teahouse_outer: {
    name: "茶馆（外环）",
    slogan: "暂时坐下，也是一种前进。",
    dialog: [
      "茶香从窗缝里慢慢散出来。",
      "「有些答案不会在奔跑时出现。坐一会儿。」",
    ],
  },
  writingclub: {
    name: "文训社",
    slogan: "字是城的声音，写下来才不散。",
    dialog: ["木桌木椅，墨迹未干。", "「别怕写不好。先写下来，再改。」"],
  },
  wushi_restaurant: {
    name: "物实饭店",
    slogan: "全天亮着暖黄灯光的聊天室与茶楼。",
    dialog: ["玻璃墙后的灯光很暖，门边还贴着一行小字。"],
    dialogTree: [
      {
        text: "（huh？为什么还会有饭店，要不进去看看。）",
        options: [
          { text: "要不进去看看？", next: 1 },
          { text: "算了吧", next: null },
          { text: "认真读小字", next: 6 },
        ],
      },
      {
        text: "“欢迎欢迎！”前台传来爽朗的笑声，“哈哈哈，你好。”",
        options: [
          { text: "呃，您好，请问您叫什么？", next: 2 },
          { text: "（被吓一跳）你好你好你好", next: 2 },
          { text: "嘿 bro，你好啊，这里是饭店吗？", next: 2 },
        ],
      },
      {
        text: "“我叫禹智博の鸽。这里是物实饭店，更像一个聊天室或者茶楼。请问有什么要吃的吗？”",
        options: [
          { text: "你们这都有什么？", next: 3 },
          { text: "wow，你们的店看着不错啊，让我看看有什么吃的", next: 3 },
          { text: "呃，算了吧，我就坐坐吧", next: 4 },
          { text: "好的，谢谢，打扰了，再见", next: 5 },
        ],
      },
      {
        text: "“我们有些员工外出了，所以能做的菜不多，请见谅。”他掏出菜单。",
        options: [
          { text: "清蒸濑莱（濑莱还是店长吧）", next: 7 },
          { text: "凉拌闪电……这个是什么？", next: 4 },
          { text: "服务器蘸酱（这个真的能吃么）", next: 4 },
          { text: "蛋炒饭（这个还算正常）", next: 4 },
        ],
      },
      {
        text: "（随便找地方坐坐吧。）",
        options: [
          { text: "坐到看向落地窗外的那个人对面", next: 8 },
          { text: "坐到前台旁边", next: 9 },
          { text: "坐到靠书架的位置", next: 10 },
        ],
      },
      {
        text: "“嘿，来都来了，好歹吃点东西再走嘛！”远处传来濑莱的声音，“实在不行，送你点东西吃呀——这是给新住户的福利～”",
        options: [
          { text: "我也要吃吗？", next: 7 },
          { text: "那我再看看……", next: 7 },
          { text: "我去意已决", next: null },
        ],
      },
      {
        text: "“进入本店后，您的生命由您自行负责。”",
        options: [
          { text: "这啥黑店啊，跑路了", next: null },
          { text: "有趣有趣，我必须品鉴", next: 1 },
        ],
      },
      {
        text: "前台的博鸽给了你一份完整菜单。你不由得感叹：这店子的成分还真复杂……",
        options: [
          { text: "随便点几道菜吃吃得了……", next: 9 },
          { text: "那我必须狠狠品鉴（）", next: 9 },
        ],
      },
      {
        text: "（对面的人注意到了你。）“诶！欢迎来到物实饭店，我是店长濑莱，你是来吃饭的吧！”",
        options: [
          { text: "是的呀", next: 11 },
          { text: "没有（汗），我只是来看看", next: 12 },
        ],
      },
      {
        text: "博鸽似乎因为你的到来很开心，一直与你说着这里的历史：“这里原本是一个聊天室，后来有人说了一些奇怪的菜肴，濑莱就直接把这里改装成饭店了。”",
        options: [
          { text: "哇塞！听起来很有趣诶！", next: 13 },
          { text: "然后呢然后呢？", next: 13 },
        ],
      },
      {
        text: "一个看起来像员工的人正在整理书。“欢迎光临！已经点好菜了吗？博鸽也没给我说一声……我叫时年梦烟雨，你可以叫我时年！”她一边说着，一边把你安顿到座位上。“稍等啊，菜马上就来——三黄蟹——”",
        options: [
          { text: "诶诶？（这人好热情……继续等待）", next: 14 },
          { text: "去问问博鸽关于饭店", next: 13 },
        ],
      },
      {
        text: "“嗷，点好菜了吗？现在店子里人越来越少了……平时还在店子里的只有五个，有两个时不时来帮一下忙……耐心等等罢。”",
        options: [
          { text: "能具体说说吗？", next: 13 },
          { text: "没事没事，你忙吧", next: 14 },
        ],
      },
      {
        text: "“啊……没事！来参观参观也可以～有什么意见也可以直接告诉我！拜拜！”",
        options: [{ text: "拜拜～", next: null }],
      },
      {
        text: "濑莱看向窗外：“本来这里有 14 位员工，像高特、玄灰、墨孞，大家在一起也都超级开心。结果一个暑假过完，开学了，饭店冷清下来。我们幻想着下一个寒假新饭店的辉煌，本约好下一个寒假再见，有的人却再也没回来，连个联系方式也没给……大家现实里的学业，成了横在我们面前最大的墙啊——”",
        options: [
          { text: "没想到你们还有这样一段故事", next: 14 },
          { text: "听起来很令人伤心……", next: 14 },
        ],
      },
      {
        text: "（随后开始等菜。你打量着饭店：这里的装修还挺好看的诶！）",
        options: [{ text: "继续", next: 15 }],
      },
      {
        text: "“菜来啦！”店长濑莱端着菜，轻轻放在桌上，“您慢用。”你看着冰冻罗非鱼和东方树叶蛋花汤陷入沉思……",
        options: [
          { text: "溜了溜了", next: null },
          { text: "认真吃完", next: 16 },
        ],
      },
      {
        text: "（好难吃……）“欢迎下次光临～”门口的濑莱笑眯眯地送别了你。你看着手里 9072000 的账单陷入沉思……",
        options: [{ text: "离开", next: null }],
      },
    ],
  },
  writingclub_outer: {
    name: "野生菌餐馆",
    slogan: "一年总要吃两次野生菌火锅。",
    dialog: ["门头挂着几串风干的菌子，锅底翻滚着奶白色的汤。", "老板笑眯眯地说：「吃完保准看见点新东西。」"],
  },
  television_tower: {
    name: "电视塔",
    slogan: "把城市的声音送往更远处。",
    dialog: ["观景层的玻璃映着街区与道路。", "天线在风里轻轻转动，把每一段讯号送向远方。"],
  },
  fried_chicken_shop: {
    name: "炸鸡店",
    slogan: "酥脆的香气从街角一路飘来。",
    dialog: ["橱窗后的保温灯把每一块炸鸡照得金黄。", "店员把纸袋折好，递出一份刚出锅的热气。"],
  },
  tavern: {
    name: "酒馆",
    slogan: "故事在木桌边慢慢发酵。",
    dialog: ["门口的木桶带着淡淡的麦芽香。", "暖黄的灯透过窗格，里面有人正低声交谈。"],
  },
};
