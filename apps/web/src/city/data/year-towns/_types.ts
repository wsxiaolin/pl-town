// 年份镇数据类型（手写；gen-* 生成模块与面板/装配消费方共用，设计 §8.2）。
// gen-* 文件由 scripts/generate_town_buildings.mjs 产出（幂等、gitignore 覆盖），
// 类型契约集中在这里，生成器与消费端永不各写一份。
import type { BuildingConfig } from '../buildings/_types';

export type { BuildingConfig };

/** 评论精选条目（昵称 / 内容 / 时间；回复为平铺前缀结构，无树形）。 */
export interface YearComment {
  nickname: string;
  content: string;
  /** ISO 时间串（面板侧再格式化为日期）。 */
  time?: string;
  /** 社区徽章（Oldtimer/Volunteer/…，可选渲染）。 */
  verification?: string;
}

/** P 级铭牌数据（随建筑配置常驻 / gen-index 全量懒加载）。 */
export interface YearWorkNameplate {
  /** 作品 ID（社区 24 位 hex，稳定键）。 */
  id: string;
  /** 全局 Top1000 名次（1–1000）。 */
  rank: number;
  year: number;
  /** 镇内名次（热度排序，1 起）。 */
  townRank: number;
  /** 面板题名（清洗后 ≤48 字）。 */
  subject: string;
  /** label-safe 短名（≤24 字，建筑 label 同款）。 */
  label: string;
  /** 清洗后作者昵称（空 → 无名氏）。 */
  author: string;
  popularity: number;
  visits: number;
  stars: number;
  /** 标签 ≤4（label-safe）。 */
  tags: readonly string[];
  /** 摘要 ≤120 字（来自正文，空白折叠）。 */
  abstract: string;
  /** 服务端评论总数（渲染条数以 len(comments) 为准——Count 偏差口径）。 */
  totalComments: number;
  /** 已采样（非空白）评论条数。 */
  sampledComments: number;
  /** 巨楼 200 条采样标记（面板标「仅展示最新 N 条 / 共 totalComments 条」）。 */
  commentsTruncated: boolean;
  /** 评论区已锁定（服务端 403，如 rank 344）。 */
  commentsLocked: boolean;
  /** 正文含内嵌实验模型（面板渲染模型 chip）。 */
  hasModel: boolean;
}

/** D 级详情数据（gen-t{y}[-a/b] 懒加载模块）。 */
export interface YearWorkDetail {
  id: string;
  /** 正文全文（≤8KB 内联）；bodyExternal=true 时为 2000 字级截断。 */
  body: string;
  /** 超长正文外置标记（全文在 gen-b{y} 包，按需懒加载）。 */
  bodyExternal: boolean;
  /** 评论精选（非空白、单条 ≤500 字；默认前 20 条）。 */
  comments: readonly YearComment[];
  /** 全部评论包 key（gen-c{y}-{i}；comments > 20 时存在）。 */
  pack?: string;
  /** 评论区已锁定 → 面板「评论区已锁定」占位，无载入入口。 */
  locked?: boolean;
}

/** gen-t{y}[-a/b] 模块形状（分片合并后）。 */
export interface YearTownDetailModule {
  year: number;
  works: readonly YearWorkDetail[];
}

/** gen-index 模块形状（1000 条 P 级索引）。 */
export interface YearIndexModule {
  works: readonly YearWorkNameplate[];
}

/** gen-b{y} 超长正文包。 */
export interface YearTownBodyPack {
  bodies: Readonly<Record<string, string>>;
}

/** gen-c{y}-{i} 评论包。 */
export interface YearTownCommentPackModule {
  works: readonly { id: string; comments: readonly YearComment[] }[];
}

/** 建筑分类（works=作品主题建筑 / archive=镇档案馆 / tower=千作总目塔 / stele=村碑）。 */
export type YearTownBuildingKind = 'work' | 'archive' | 'tower' | 'stele';

/** 建筑附加信息（gen-buildings 导出，装配与面板路由消费）。 */
export interface YearTownBuildingExtras {
  kind: YearTownBuildingKind;
  townId: string;
  year: number;
  /** kind=work 时指向作品 ID。 */
  workId?: string;
  /** kind=work 时的镇内名次。 */
  townRank?: number;
}
