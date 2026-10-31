// 年份 2025 纪念设施（从 yearTownMemorials.ts 按年拆分；布局手写唯一事实源）。
// key/workId/facility/family/note/noteKind 为既定事实不可改；layout 可按城市规划重排。
import type { YearTownMemorial } from '../_types';

export const YEAR_TOWN_MEMORIALS_2025: readonly YearTownMemorial[] = [
  // ── 长风镇（2025）：交接与回望的一年 ────────────────────────────────────
  {
    key: 'yt-w2025-01',
    workId: '67a36019b90b071f18c39f5e',
    layout: { x: -244, z: 266, plot: 4.6, facing: 'n' }, // 长风街区北排食堂
    facility: '公共食堂',
    family: 'tavern',
    note: '镇上第一处正式供饭的地方。菜品常年不变，位置却总是满的。',
  },
  {
    key: 'yt-w2025-02',
    workId: '67979258826568de4e9a0dea',
    layout: { x: -237, z: 266, plot: 4.6, facing: 'n' }, // 年度作品厅临夜航街
    facility: '年度作品厅',
    family: 'press',
    note: '厅内按年陈列社区的年度作品清单。它让「这一年发生了什么」有了固定的去处。',
  },
  {
    key: 'yt-w2025-03',
    workId: '6875e7042805940f58522847',
    layout: { x: -230, z: 266, plot: 3.2, facing: 'n' }, // 北排小亭
    facility: '无名著者亭',
    family: 'guild',
    note: '亭上刻意不写名字。它纪念的是那些不愿留名、却仍在写作的人。',
  },
  {
    key: 'yt-w2025-04',
    workId: '67dd3a8280510429f695b706',
    layout: { x: -224, z: 266, plot: 3.8, facing: 'n' }, // 北排东端的开放实验场
    facility: '关系实验场',
    family: 'guild',
    note: '一片用于推演结盟与冲突的场地。它把宏大的议题缩小到可以亲手推演的程度。',
  },
  {
    key: 'yt-w2025-05',
    workId: '68bd7e22656b9697a7d941fc',
    layout: { x: -224, z: 274, plot: 4.6, facing: 'e' }, // 报社塔面向星港大道
    facility: '鸣野报社',
    family: 'press',
    note: '报社的印刷塔是镇上最高的一栋。夜里灯亮着，说明新一期还在排。',
  },
  {
    key: 'yt-w2025-06',
    workId: '68050380272ccc9710f45a49',
    layout: { x: -224, z: 282, plot: 3.8, facing: 'e' }, // 大道边会客厅
    facility: '第二会客厅',
    family: 'gathering',
    note: '潮声镇会客厅的远亲。它在这里重建，接续了那条未曾中断的谈天传统。',
  },
  {
    key: 'yt-w2025-07',
    workId: '693826aee14dc434f7a45493',
    layout: { x: -224, z: 290, plot: 3.8, facing: 'e' }, // 南港街口名录厅
    facility: '名录厅',
    family: 'press',
    note: '厅内只挂名录，不加评论。名字本身就是内容。',
  },
  {
    key: 'yt-w2025-08',
    workId: '6895fd863734f520583ef7db',
    layout: { x: -231, z: 292, plot: 3.2, facing: 's' }, // 南排送别亭
    facility: '远行公告亭',
    family: 'memorial',
    noteKind: 'leaving',
    note: '有人要走时，会在这里留一张纸条。亭子不挽留，只把纸条收好。',
  },
  {
    key: 'yt-w2025-09',
    workId: '68f3457d6d285b2dc344e940',
    layout: { x: -238, z: 292, plot: 3.8, facing: 's' }, // 南排归客门
    facility: '归客门',
    family: 'guild',
    note: '为重新回来的人立的一道门。门上没有锁，内侧的把手比外侧磨得更亮。',
  },
  {
    key: 'yt-w2025-10',
    workId: '67efeb20c26698f17ed0fddc',
    layout: { x: -245, z: 292, plot: 3.8, facing: 's' }, // 靠长风站的登记处
    facility: '新到登记处',
    family: 'guild',
    note: '新居民在此登记第一笔。登记册按年份装订，最早的一册已经翻得发毛。',
  },
  {
    key: 'yt-w2025-11',
    workId: '67f9ca272b1eb70d739549c9',
    layout: { x: -244, z: 282, plot: 3.8, facing: 'w' }, // 西缘档案楼面向集装箱路
    facility: '编号档案楼',
    family: 'press',
    note: '一栋按编号归档的楼。它把杂乱的故事整理成可以检索的秩序。',
  },
  {
    key: 'yt-w2025-12',
    workId: '6932b5290b68ebe5326f5a46',
    layout: { x: -244, z: 274, plot: 3.2, facing: 'w' }, // 西缘公告亭
    facility: '公告小亭',
    family: 'press',
    note: '镇上最普通的一座公告亭。它的存在感恰好像一次平静的通知。',
  },
];
