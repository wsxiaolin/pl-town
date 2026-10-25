// 年份镇数据类型（手写；gen-* 生成模块与面板/装配消费方共用，设计 §8.2）。
// gen-* 文件由 scripts/generate_town_buildings.mjs 产出（幂等、gitignore 覆盖），
// 类型契约集中在这里，生成器与消费端永不各写一份。
//
// 修订（设计 §7.1 纪念设施）：年份群岛不再承载社区原始数据（正文 / 评论 /
// 热度 / 浏览量）。建筑只呈现改写后的纪念设施：设施名 + 纪念导语 + 可选便签
// 交互。手写目录见 `yearTownMemorials.ts`。
import type { BuildingConfig } from '../buildings/_types';

export type { BuildingConfig };

/** 设施族：决定建筑 shape 与纪念语义（见 FACILITY_SHAPES）。 */
export type FacilityFamily =
  | 'law'
  | 'gathering'
  | 'academy'
  | 'observatory'
  | 'narrative'
  | 'lab'
  | 'tavern'
  | 'market'
  | 'memorial'
  | 'dwelling'
  | 'press'
  | 'guild';

/** 便签交互种类（少量设施拥有，提供一处轻微可玩的小动作）。 */
export type MemorialNoteKind = 'stamp' | 'lamp' | 'leaving' | 'capsule';

/** 单座纪念设施（手写目录 `yearTownMemorials.ts` 的条目）。 */
export interface YearTownMemorial {
  /** 建筑 id（yt-w{year}-{rank}）。 */
  key: string;
  /** 社区作品 ID（仅用于稳定关联，不展示、不再携带任何作品数据）。 */
  workId: string;
  /** 设施名——建筑 label 的唯一来源。 */
  facility: string;
  /** 设施族（shape 由 FACILITY_SHAPES 决定）。 */
  family: FacilityFamily;
  /** 纪念导语（面板正文：为何在此立此物）。 */
  note: string;
  /** 手写落位（世界坐标与地块尺寸）；由人工逐栋决定，不走算法布局。 */
  layout?: { x: number; z: number; plot?: number };
  /** 可选便签交互（仅少数设施）。 */
  noteKind?: MemorialNoteKind;
}

/** 建筑分类（works=作品主题建筑 / archive=纪念名录 / tower=千作总目塔 / stele=村碑）。 */
export type YearTownBuildingKind = 'work' | 'archive' | 'tower' | 'stele';

/** 建筑附加信息（gen-buildings 导出，装配与面板路由消费）。 */
export interface YearTownBuildingExtras {
  kind: YearTownBuildingKind;
  townId: string;
  year: number;
  /** kind=work 时指向纪念设施条目。 */
  memorialKey?: string;
}

/** 纪念名录条目（gen-index 产出；不含作品原文/评论/热度）。 */
export interface MemorialIndexEntry {
  /** 建筑 id。 */
  key: string;
  townId: string;
  year: number;
  /** 镇内名次（1 起）。 */
  townRank: number;
  /** 设施名。 */
  facility: string;
  family: FacilityFamily;
  /** 纪念导语。 */
  note: string;
}

/** gen-index 模块形状（106 条纪念设施索引）。 */
export interface MemorialIndexModule {
  memorials: readonly MemorialIndexEntry[];
}
