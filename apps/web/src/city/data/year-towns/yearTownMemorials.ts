// 年份群岛纪念设施目录（手写，设计 §7.1 修订：作品 → 城市设施）。
//
// 设计原则：年份群岛纪念的是「社区在某个年份做成了什么」，因此把作品抽象成
// 一种城市物件，而不是把作品标题直接挂到建筑上。每座设施给出：
//   - facility：设施名（建筑 label 唯一来源，只用设施名）
//   - family：设施族（决定 shape，见 FACILITY_SHAPES）
//   - note：纪念导语（面板正文，一句话说明为何在此立此物）
//
// 原始作品正文、评论、热度、浏览量等社区数据不进入年份群岛，也不进入任何
// 生成产物；key 为建筑 id（yt-w{year}-{rank}），workId 仅用于稳定关联。
import type { FacilityFamily, YearTownMemorial } from './_types';

/** 设施族 → 既有程序化 shape（rendering/buildingMeshFactory.ts 的真实几何）。 */
export const FACILITY_SHAPES: Readonly<Record<FacilityFamily, string>> = {
  /** 律法与制度：柱廊立面 + 中央台基，庄重、可宣读。 */
  law: 'bank',
  /** 集会与闲谈：带雨棚的低层市集，街道生活的发生器。 */
  gathering: 'market',
  /** 教程与学理：围合庭院 + 门楼，藏讲义、可讲学。 */
  academy: 'academy',
  /** 观星与物理：穹顶开缝，指向天空。 */
  observatory: 'observatory',
  /** 叙事与虚构：多层的塔与灯，供人逐层翻阅。 */
  narrative: 'pagoda',
  /** 声光与实验：玻璃体量，把实验摆进橱窗。 */
  lab: 'greenhouse',
  /** 餐饮与招待：木构、暖光、临街小门脸。 */
  tavern: 'tavern',
  /** 商业与交换：临街店面 + 大玻璃，招牌醒目。 */
  market: 'mall',
  /** 告别与追念：封闭院落 + 高墙，静默的空间。 */
  memorial: 'temple',
  /** 起居与日常：坡顶民居语汇，尺度亲和。 */
  dwelling: 'school',
  /** 报业与纪录：细高的印刷塔，可悬挂版面。 */
  press: 'tower',
  /** 社群与组织：门楼 + 匾额，作为登记与集合点。 */
  guild: 'qipai',
};

/** 106 座作品建筑 → 纪念设施（按年份、镇内名次排列）。 */
import { YEAR_TOWN_MEMORIALS_2019 } from './memorials/2019';
import { YEAR_TOWN_MEMORIALS_2020 } from './memorials/2020';
import { YEAR_TOWN_MEMORIALS_2021 } from './memorials/2021';
import { YEAR_TOWN_MEMORIALS_2022 } from './memorials/2022';
import { YEAR_TOWN_MEMORIALS_2023 } from './memorials/2023';
import { YEAR_TOWN_MEMORIALS_2024 } from './memorials/2024';
import { YEAR_TOWN_MEMORIALS_2025 } from './memorials/2025';
import { YEAR_TOWN_MEMORIALS_2026 } from './memorials/2026';

/** 106 座作品建筑 → 纪念设施（按年份、镇内名次排列；分文件见 memorials/）。 */
export const YEAR_TOWN_MEMORIALS: readonly YearTownMemorial[] = [
  ...YEAR_TOWN_MEMORIALS_2019,
  ...YEAR_TOWN_MEMORIALS_2020,
  ...YEAR_TOWN_MEMORIALS_2021,
  ...YEAR_TOWN_MEMORIALS_2022,
  ...YEAR_TOWN_MEMORIALS_2023,
  ...YEAR_TOWN_MEMORIALS_2024,
  ...YEAR_TOWN_MEMORIALS_2025,
  ...YEAR_TOWN_MEMORIALS_2026,
];


/** 建筑 id → 纪念设施（生成器与运行时共用）。 */
export const YEAR_TOWN_MEMORIAL_BY_KEY: Readonly<Record<string, YearTownMemorial>> = Object.fromEntries(
  YEAR_TOWN_MEMORIALS.map((m) => [m.key, m]),
);

/** 各镇档案馆/总目塔/村碑的纪念名录导语（取代作品检索）。 */
export const YEAR_TOWN_LANDMARK_NOTES: Readonly<Record<string, string>> = {
  'yt-arch-2020': '启明镇纪念名录。按年份收录本镇立起的设施，记录它们各自纪念了什么。',
  'yt-arch-2021': '潮声镇纪念名录。这里陈列会客厅的历代沿革，以及它们见证过的闲谈。',
  'yt-arch-2022': '盛夏镇纪念名录。收录本镇关于规则与故事的设施，按立碑先后排列。',
  'yt-arch-2023': '回响镇纪念名录。这册名录偏重虚构写作的街区，以及与它相伴的日常设施。',
  'yt-arch-2024': '微光镇纪念名录。所录多为小店、会客厅与咖啡馆，是一份生活史。',
  'yt-arch-2025': '长风镇纪念名录。这里记录交接、回望与重新出发的那些设施。',
  'yt-arch-2026': '星港城纪念名录。最新的一册，仍在增补。',
  'yt-tower': '千作总目塔。塔内不再陈列作品原文，只按年份立册，记下每年这座城市做成了什么。',
  'yt-stele-2019': '起源村界碑。社区从两块基石开始，此后每一年都在别处另立一岛。',
};
