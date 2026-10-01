// 单文件建筑配置的类型定义。一栋建筑的全部信息（定位、外观、地块、
// 社区查询、对话、GLB 模型）都收敛在同名的配置文件里，新增/修改建筑
// 只需改动一个文件，不要再把数据拆散到其他模块。
//
// 新增建筑的标准步骤：
// 1. 在本目录新建 `<building_id>.ts`，`export default defineBuilding({ ... })`；
// 2. 在 `_registry.ts` 按城市空间顺序（大致从小坐标到大坐标）插入该文件；
// 3. 如使用 GLB 模型，把 `glbUrl` 指向 `src/assets/models/` 下的文件名；
// 4. 运行 `npm run gen:building-catalog -w @minicity/server` 同步服务端目录，
//    并按 AGENTS.md 检查治理配置版本要求。
//
// 形状（shape）级别的默认地块 / 门面在 `_shapeDefaults.ts`；只有想覆盖
// 默认值时才在建筑文件里写 `plot` / `facade`。

import type { BuildingContentLike } from '../../../adapters/ui/cityDialogController';

export type { BuildingContentLike };

export type BuildingPlotSpec = { tex: string; size: number; color: number };

/** Physics Lab 社区作品查询参数；与社区面板的 works 查询契约一致。 */
export interface BuildingContentQuery {
  title: string;
  Category: string;
  Languages: string[];
  ExcludeLanguages: string[] | null;
  Tags: string[] | null;
  ExcludeTags: string[] | null;
  ModelTags: string[] | null;
  ModelID: string | null;
  ParentID: string | null;
  UserID: string | null;
  Special: string | null;
  From: string | null;
  Skip: number;
  Take: number;
  Days: number;
  Sort: number;
  ShowAnnouncement: boolean;
}

/**
 * 建筑自带装饰（预留槽位，渲染接线尚未实现）。
 * 世界级装饰（路灯、住宅、郊区房等）仍在 `rendering/worldDecorations.ts`，
 * 不进建筑配置；只有"属于这栋建筑"的挂件（如猫咖的便签）适合放在这里。
 * `kind` 对应未来渲染侧注册的装饰建造器 key，`offset` 为相对建筑原点的偏移。
 */
export interface BuildingDecorationConfig {
  kind: string;
  offset?: { x?: number; y?: number; z?: number };
  rotY?: number;
  params?: Record<string, number | string | boolean>;
}

export interface BuildingConfig {
  /** 稳定 ID，同时是服务端治理账本与存档引用的键；发布后不可改名。 */
  id: string;
  /** 显示编号（门牌 / 治理面板用），如 "01"、"26A"。 */
  num: string;
  /** 可选中文名；缺省时各处回退为 id。 */
  label?: string;
  /** 场景 X 坐标。 */
  x: number;
  /** 场景 Z 坐标。 */
  z: number;
  /** 建筑建造器 key，决定程序化网格；可用值见 cityGraphics 的 buildingBuilders。 */
  shape: string;
  /** SVG 图标字符串，通常用本文件的 iconSvg() 包裹路径数据。 */
  icon: string;

  // ── 外观覆盖（可选）────────────────────────────
  /** 覆盖门面纹理 key；缺省用 `_shapeDefaults.ts` 里该 shape 的默认门面。 */
  facade?: string;
  /** GLB 文件名（`src/assets/models/` 下）。配置后渲染时用模型替换程序化网格。 */
  glbUrl?: string;

  // ── 地块（可选）────────────────────────────────
  /** 覆盖地块纹理 / 半径 / 颜色；缺省用 shape 级默认（见 inferPlot）。 */
  plot?: BuildingPlotSpec;
  /** false = 不生成地块（如 King Ice 的王座底座）。 */
  hasPlot?: boolean;

  // ── 游戏逻辑（可选）────────────────────────────
  /** 点击打开统计面板而非对话。 */
  isStats?: boolean;
  /** true = 不进入场景（待开放的占位建筑）。 */
  disabled?: boolean;
  /** true = 剧情解锁前不可交互、隐藏名称。 */
  storyLocked?: boolean;
  /** 交互半径覆盖（默认由 raycast 决定）。 */
  interactionRadius?: number;
  /** 装饰避让半径（住宅/路灯布局时使用，默认 1.35）。 */
  decorationClearance?: number;
  /** 绑定的剧情 feature id 列表（如冰之王座的 ICE_SANCTUM_FEATURE_ID）。 */
  featureIds?: readonly string[];

  // ── Physics Lab 社区内容（可选）────────────────
  /** 配置后点击建筑打开社区作品面板；缺省走对话弹窗。 */
  contentQuery?: BuildingContentQuery;

  // ── 对话内容（可选）────────────────────────────
  /** 建筑对话：slogan + 线性 dialog 或树状 dialogTree（含分支/动作）。 */
  content?: BuildingContentLike;

  // ── 装饰（预留，见 BuildingDecorationConfig 说明）──
  decorations?: BuildingDecorationConfig[];
}

/** 包一层统一 SVG 外壳（描边色与城市主题蓝一致）。 */
export const iconSvg = (svg: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="#3B6FE0" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>`;

/** 恒等辅助函数：仅为编辑器提供类型提示与自动补全。 */
export const defineBuilding = (config: BuildingConfig): BuildingConfig => config;
