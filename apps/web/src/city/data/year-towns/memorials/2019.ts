// 年份 2019 纪念设施（从 yearTownMemorials.ts 按年拆分；布局手写唯一事实源）。
// key/workId/facility/family/note/noteKind 为既定事实不可改；layout 可按城市规划重排。
import type { YearTownMemorial } from '../_types';

export const YEAR_TOWN_MEMORIALS_2019: readonly YearTownMemorial[] = [
  // ── 起源村（2019）：社区的两块基石 ──────────────────────────────────────
  {
    key: 'yt-w2019-01',
    workId: '5d921799a88e5200014fc0e5',
    layout: { x: 138, z: 211, plot: 5.5, facing: 'e' },
    facility: '律法碑廊',
    family: 'law',
    noteKind: 'stamp',
    note: '这里立着社区最早的成文规矩。它把「怎样共处」写成可宣读的条文，此后每一次修订都以它为准绳。',
  },
  {
    key: 'yt-w2019-02',
    workId: '5dfa24ee3244000001b4afce',
    layout: { x: 162, z: 211, plot: 5.5, facing: 'w' },
    facility: '门电路工坊',
    family: 'lab',
    note: '早期实验者把与非门串成会呼吸的装置，用闪烁的灯告诉路过的人：逻辑可以亲手搭出来。',
  },
];
