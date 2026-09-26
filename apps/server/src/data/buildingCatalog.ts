// GENERATED FILE — do not edit by hand.
// Mirrors apps/web/src/city/data BUILDING_DEFS for the admin world-config map.
// Regenerate with `npm run gen:building-catalog` after changing building placement.

export type BuildingCatalogEntry = {
  id: string;
  label: string;
  num: string;
  x: number;
  z: number;
  storyLocked: boolean;
};

export const BUILDING_CATALOG: readonly BuildingCatalogEntry[] = Object.freeze(
[
  {
    id: "activity",
    label: "活动区",
    num: "01",
    x: 4,
    z: -9,
    storyLocked: false
  },
  {
    id: "bulletin",
    label: "公告板",
    num: "02",
    x: -4,
    z: -9,
    storyLocked: false
  },
  {
    id: "techhalf",
    label: "技术半城",
    num: "03",
    x: 9,
    z: -3,
    storyLocked: false
  },
  {
    id: "blackhole",
    label: "黑洞半城",
    num: "04",
    x: -9,
    z: -3,
    storyLocked: false
  },
  {
    id: "laws",
    label: "城的法则",
    num: "05",
    x: 4,
    z: 3,
    storyLocked: false
  },
  {
    id: "library",
    label: "图书馆",
    num: "06",
    x: -4,
    z: 3,
    storyLocked: false
  },
  {
    id: "litreview",
    label: "文学审核部",
    num: "07",
    x: -9,
    z: 3,
    storyLocked: true
  },
  {
    id: "catcafe",
    label: "猫咖馆",
    num: "08",
    x: 9,
    z: 3,
    storyLocked: false
  },
  {
    id: "academy",
    label: "物实学院",
    num: "09",
    x: 4,
    z: 9,
    storyLocked: false
  },
  {
    id: "news",
    label: "星尘报社",
    num: "10",
    x: -4,
    z: 9,
    storyLocked: false
  },
  {
    id: "mutualaid",
    label: "互助团",
    num: "11",
    x: -9,
    z: 9,
    storyLocked: false
  },
  {
    id: "screen",
    label: "大屏幕",
    num: "12",
    x: 9,
    z: 9,
    storyLocked: false
  },
  {
    id: "elevator",
    label: "纪念碑",
    num: "13",
    x: 9,
    z: -9,
    storyLocked: false
  },
  {
    id: "residentid",
    label: "居民证",
    num: "14",
    x: -9,
    z: -9,
    storyLocked: false
  },
  {
    id: "stats",
    label: "STATS",
    num: "15",
    x: -5.5,
    z: -5.5,
    storyLocked: false
  },
  {
    id: "knowledgebaseE",
    label: "实验知识库",
    num: "16",
    x: -15,
    z: -15,
    storyLocked: false
  },
  {
    id: "newsstand",
    label: "报摊",
    num: "17",
    x: -9,
    z: -15,
    storyLocked: false
  },
  {
    id: "community",
    label: "社区中心",
    num: "18",
    x: 15,
    z: -15,
    storyLocked: false
  },
  {
    id: "research",
    label: "研究院",
    num: "19",
    x: 15,
    z: -9,
    storyLocked: false
  },
  {
    id: "commons",
    label: "众议院",
    num: "20",
    x: -15,
    z: 3,
    storyLocked: false
  },
  {
    id: "senate",
    label: "参议院",
    num: "21",
    x: -15,
    z: 9,
    storyLocked: false
  },
  {
    id: "writingclub",
    label: "文训社",
    num: "22",
    x: -15,
    z: 15,
    storyLocked: false
  },
  {
    id: "lab",
    label: "实验楼",
    num: "23",
    x: 15,
    z: 3,
    storyLocked: false
  },
  {
    id: "culturehall",
    label: "文化馆",
    num: "24",
    x: 15,
    z: 9,
    storyLocked: false
  },
  {
    id: "teahouse",
    label: "茶馆",
    num: "25",
    x: 15,
    z: 15,
    storyLocked: false
  },
  {
    id: "mall_south",
    label: "金月店",
    num: "26",
    x: 22.5,
    z: -22.5,
    storyLocked: false
  },
  {
    id: "school_east",
    label: "东区小学",
    num: "27",
    x: 31.5,
    z: -15.25,
    storyLocked: false
  },
  {
    id: "mall_west",
    label: "断星玄",
    num: "28",
    x: -22.5,
    z: 22.5,
    storyLocked: false
  },
  {
    id: "school_north",
    label: "北区学院",
    num: "29",
    x: -22.5,
    z: 15,
    storyLocked: false
  },
  {
    id: "kingice",
    label: "King Ice",
    num: "30",
    x: 20,
    z: 20,
    storyLocked: false
  },
  {
    id: "knowledgebaseD",
    label: "黑洞知识库",
    num: "31",
    x: -33,
    z: -33,
    storyLocked: false
  },
  {
    id: "community_outer",
    label: "社区中心（外环）",
    num: "32",
    x: 33,
    z: -33,
    storyLocked: false
  },
  {
    id: "commons_outer",
    label: "众议院（外环）",
    num: "33",
    x: -33,
    z: -9,
    storyLocked: false
  },
  {
    id: "lab_outer",
    label: "数据中心",
    num: "34",
    x: 33,
    z: 9,
    storyLocked: false
  },
  {
    id: "teahouse_outer",
    label: "茶馆（外环）",
    num: "35",
    x: 33,
    z: 33,
    storyLocked: false
  },
  {
    id: "writingclub_outer",
    label: "野生菌餐馆",
    num: "36",
    x: -31.5,
    z: -15.125,
    storyLocked: false
  },
  {
    id: "archive",
    label: "档案馆",
    num: "37",
    x: -21,
    z: -33,
    storyLocked: false
  },
  {
    id: "tradingpost",
    label: "交易所",
    num: "38",
    x: 21,
    z: -33,
    storyLocked: false
  },
  {
    id: "records",
    label: "记录厅",
    num: "39",
    x: -33,
    z: -21,
    storyLocked: false
  },
  {
    id: "guildhall",
    label: "公会堂",
    num: "40",
    x: 33,
    z: -21,
    storyLocked: false
  },
  {
    id: "musichall",
    label: "音乐厅",
    num: "41",
    x: -21,
    z: 33,
    storyLocked: false
  },
  {
    id: "conservatory",
    label: "温室",
    num: "42",
    x: 21,
    z: 33,
    storyLocked: false
  },
  {
    id: "arena",
    label: "竞技场",
    num: "43",
    x: -33,
    z: 21,
    storyLocked: false
  },
  {
    id: "guesthouse",
    label: "客栈",
    num: "44",
    x: 33,
    z: 21,
    storyLocked: false
  },
  {
    id: "shrine",
    label: "神社",
    num: "45",
    x: 9,
    z: -33,
    storyLocked: false
  },
  {
    id: "beacon",
    label: "灯塔",
    num: "46",
    x: 9,
    z: 31.5,
    storyLocked: false
  },
  {
    id: "banana_palace",
    label: "布拿拉宫",
    num: "47",
    x: -30,
    z: 30,
    storyLocked: false
  },
  {
    id: "qipai_hall",
    label: "棋气派",
    num: "48",
    x: 30,
    z: 30,
    storyLocked: false
  },
  {
    id: "wushi_restaurant",
    label: "物实饭店",
    num: "49",
    x: -22.5,
    z: -15,
    storyLocked: false
  },
  {
    id: "film_city",
    label: "物实影视城",
    num: "50",
    x: -9,
    z: -21,
    storyLocked: false
  },
  {
    id: "academy_library",
    label: "书院",
    num: "书院",
    x: 3,
    z: -15,
    storyLocked: false
  },
  {
    id: "television_tower",
    label: "电视塔",
    num: "50",
    x: 32,
    z: -8,
    storyLocked: false
  },
  {
    id: "fried_chicken_shop",
    label: "炸鸡店",
    num: "51",
    x: 28,
    z: 2,
    storyLocked: false
  },
  {
    id: "tavern",
    label: "酒馆",
    num: "52",
    x: 33,
    z: 3,
    storyLocked: false
  },
  {
    id: "photostudio",
    label: "照相馆",
    num: "26A",
    x: 21,
    z: 15,
    storyLocked: false
  }
]
);
