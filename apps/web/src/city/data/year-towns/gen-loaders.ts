// GENERATED FILE — do not edit by hand.
// 由 scripts/generate_town_buildings.mjs 产出（幂等；重跑前会清理旧 gen-* 文件）。
// 数据源：../data/blackhole_top1000.json + blackhole_details.json（T4.5 质检收口口径）。
// 懒加载路由表（全部 import() 路径字面量——Vite 静态分析与分片的前提）。
import type { YearTownDetailModule, YearTownBodyPack, YearTownCommentPackModule } from './_types';

/** 镇 D 级模块（分片自动合并）。 */
export const TOWN_LOADERS: Readonly<Record<number, () => Promise<YearTownDetailModule>>> = {
  2019: () => import("./gen-t2019").then((m) => m.default),
  2020: () => import("./gen-t2020").then((m) => m.default),
  2021: () => import("./gen-t2021").then((m) => m.default),
  2022: () => import("./gen-t2022").then((m) => m.default),
  2023: () => import("./gen-t2023").then((m) => m.default),
  2024: () => import("./gen-t2024").then((m) => m.default),
  2025: () => import("./gen-t2025").then((m) => m.default),
  2026: () => import("./gen-t2026").then((m) => m.default),
};

/** 超长正文包（有外置作品的镇才有）。 */
export const BODY_PACK_LOADERS: Readonly<Record<number, () => Promise<YearTownBodyPack>>> = {
  2021: () => import('./gen-b2021').then((m) => m.default),
  2022: () => import('./gen-b2022').then((m) => m.default),
  2023: () => import('./gen-b2023').then((m) => m.default),
  2024: () => import('./gen-b2024').then((m) => m.default),
  2025: () => import('./gen-b2025').then((m) => m.default),
  2026: () => import('./gen-b2026').then((m) => m.default),
};

/** 全部评论包。 */
export const COMMENT_PACK_LOADERS: Readonly<Record<string, () => Promise<YearTownCommentPackModule>>> = {
  "2019-1": () => import('./gen-c2019-1').then((m) => m.default),
  "2020-1": () => import('./gen-c2020-1').then((m) => m.default),
  "2021-1": () => import('./gen-c2021-1').then((m) => m.default),
  "2021-2": () => import('./gen-c2021-2').then((m) => m.default),
  "2022-1": () => import('./gen-c2022-1').then((m) => m.default),
  "2022-2": () => import('./gen-c2022-2').then((m) => m.default),
  "2022-3": () => import('./gen-c2022-3').then((m) => m.default),
  "2022-4": () => import('./gen-c2022-4').then((m) => m.default),
  "2023-1": () => import('./gen-c2023-1').then((m) => m.default),
  "2023-2": () => import('./gen-c2023-2').then((m) => m.default),
  "2023-3": () => import('./gen-c2023-3').then((m) => m.default),
  "2023-4": () => import('./gen-c2023-4').then((m) => m.default),
  "2024-1": () => import('./gen-c2024-1').then((m) => m.default),
  "2024-2": () => import('./gen-c2024-2').then((m) => m.default),
  "2024-3": () => import('./gen-c2024-3').then((m) => m.default),
  "2024-4": () => import('./gen-c2024-4').then((m) => m.default),
  "2025-1": () => import('./gen-c2025-1').then((m) => m.default),
  "2025-2": () => import('./gen-c2025-2').then((m) => m.default),
  "2025-3": () => import('./gen-c2025-3').then((m) => m.default),
  "2026-1": () => import('./gen-c2026-1').then((m) => m.default),
};
