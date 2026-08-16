// 报摊报纸档案入口：<discussion=64bf2629731c9248ff6dd8ad>星辉刊物目录</discussion>
// 静态配置文件，内容可删改；新增刊物只需追加到对应年份文件。
import type { NewspaperIssue } from './newspapers/newspapers-types';
import { NEWSPAPER_ISSUES_2023 } from './newspapers/newspapers-2023';
import { NEWSPAPER_ISSUES_2024 } from './newspapers/newspapers-2024';
import { NEWSPAPER_ISSUES_2025 } from './newspapers/newspapers-2025';
import { NEWSPAPER_ISSUES_2026 } from './newspapers/newspapers-2026';

export type { NewspaperIssue, NewspaperPage, NewspaperBlock, NewspaperBlockKind } from './newspapers/newspapers-types';

export const NEWSPAPER_ARCHIVE: readonly NewspaperIssue[] = [
  ...NEWSPAPER_ISSUES_2023,
  ...NEWSPAPER_ISSUES_2024,
  ...NEWSPAPER_ISSUES_2025,
  ...NEWSPAPER_ISSUES_2026,
];
