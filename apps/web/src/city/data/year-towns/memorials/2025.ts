// 年份 2025 纪念设施（从 yearTownMemorials.ts 按年拆分；布局手写唯一事实源）。
// key/workId/facility/family/note/noteKind 为既定事实不可改；layout 可按城市规划重排。
//
// 城市重造落位（docs/year-towns-urban-redesign.md §2）：2025·潮声镇 =「港区生活」，
// 落位星港城夜航带 + 南港带：
//   S11 西宅 [-396,-327]×[263,294]    四座沿块内绿庭成南北两排（courtyard 7 留白），
//                                     巷口开向星港大道；夜航街/南港街均只铺到 x -258
//                                     以东，故两排以内庭为正面
//   S12 西工坊 [-313,-256]×[263,294]  星港大道门面两座（与 2024 大道门面同列对齐）+
//                                     夜航街西口小亭；磁悬环线 (-285,270)→
//                                     (-257.66,282.66)→(-285,322) 纵穿块中部，站前
//                                     广场 (-258,283) r5.2 居块东缘——中东部整体留白
//   S13 东工坊 [-246,-184]×[263,294]  北排临夜航街、南排临南港街并接 2026 南排同线；
//                                     东段 x -207..-186 已被 2026 星火镇占用，本镇只用西段
//   S14 南港西排 [-379,-327]×[306,330] 单座占星港大道转角
//   S15 南港东排 [-313,-256]×[306,330] 单座临夜市街东端；环线 (-285,322)→(-245,340)
//                                     弯段斜穿块东南，落位让开 ≥5.5
import type { YearTownMemorial } from '../_types';

export const YEAR_TOWN_MEMORIALS_2025: readonly YearTownMemorial[] = [
  // ── 长风镇（2025）：交接与回望的一年 ────────────────────────────────────
  {
    key: 'yt-w2025-01',
    workId: '67a36019b90b071f18c39f5e',
    layout: { x: -386, z: 267, plot: 5, facing: 's' }, // S11 北排西端食堂，面向宅间绿庭
    facility: '公共食堂',
    family: 'tavern',
    note: '镇上第一处正式供饭的地方。菜品常年不变，位置却总是满的。',
  },
  {
    key: 'yt-w2025-02',
    workId: '67979258826568de4e9a0dea',
    layout: { x: -232, z: 267, plot: 5.5, facing: 'n' }, // S13 北排临夜航街，公展评审员驻此
    facility: '年度作品厅',
    family: 'press',
    note: '厅内按年陈列社区的年度作品清单。它让「这一年发生了什么」有了固定的去处。',
  },
  {
    key: 'yt-w2025-03',
    workId: '6875e7042805940f58522847',
    layout: { x: -241, z: 267, plot: 3.8, facing: 'n' }, // S13 北排西端小亭，与作品厅同排对齐
    facility: '无名著者亭',
    family: 'guild',
    note: '亭上刻意不写名字。它纪念的是那些不愿留名、却仍在写作的人。',
  },
  {
    key: 'yt-w2025-04',
    workId: '67dd3a8280510429f695b706',
    layout: { x: -308, z: 267, plot: 4.6, facing: 'w' }, // S12 星港大道门面北段，与 2024 门面同列
    facility: '关系实验场',
    family: 'guild',
    note: '一片用于推演结盟与冲突的场地。它把宏大的议题缩小到可以亲手推演的程度。',
  },
  {
    key: 'yt-w2025-05',
    workId: '68bd7e22656b9697a7d941fc',
    layout: { x: -240, z: 292, plot: 5.5, facing: 's' }, // S13 南排临南港街，让开南岸步道与环线
    facility: '鸣野报社',
    family: 'press',
    note: '报社的印刷塔是镇上最高的一栋。夜里灯亮着，说明新一期还在排。',
  },
  {
    key: 'yt-w2025-06',
    workId: '68050380272ccc9710f45a49',
    layout: { x: -348, z: 267, plot: 4.6, facing: 's' }, // S11 北排东端会客厅，近星港大道巷口
    facility: '第二会客厅',
    family: 'gathering',
    note: '潮声镇会客厅的远亲。它在这里重建，接续了那条未曾中断的谈天传统。',
  },
  {
    key: 'yt-w2025-07',
    workId: '693826aee14dc434f7a45493',
    layout: { x: -332, z: 322, plot: 5, facing: 'e' }, // S14 东端转角，面向星港大道
    facility: '名录厅',
    family: 'press',
    note: '厅内只挂名录，不加评论。名字本身就是内容。',
  },
  {
    key: 'yt-w2025-08',
    workId: '6895fd863734f520583ef7db',
    layout: { x: -262, z: 322, plot: 4.2, facing: 's' }, // S15 东端临夜市街，让开环线东南弯段
    facility: '远行公告亭',
    family: 'memorial',
    noteKind: 'leaving',
    note: '有人要走时，会在这里留一张纸条。亭子不挽留，只把纸条收好。',
  },
  {
    key: 'yt-w2025-09',
    workId: '68f3457d6d285b2dc344e940',
    layout: { x: -348, z: 289, plot: 4.4, facing: 'n' }, // S11 南排东端归客门，与北排隔庭相对
    facility: '归客门',
    family: 'guild',
    note: '为重新回来的人立的一道门。门上没有锁，内侧的把手比外侧磨得更亮。',
  },
  {
    key: 'yt-w2025-10',
    workId: '67efeb20c26698f17ed0fddc',
    layout: { x: -386, z: 289, plot: 4.4, facing: 'n' }, // S11 南排西端登记处，与食堂隔庭相对
    facility: '新到登记处',
    family: 'guild',
    note: '新居民在此登记第一笔。登记册按年份装订，最早的一册已经翻得发毛。',
  },
  {
    key: 'yt-w2025-11',
    workId: '67f9ca272b1eb70d739549c9',
    layout: { x: -308, z: 289, plot: 4.6, facing: 'w' }, // S12 星港大道门面南段，与北段同列
    facility: '编号档案楼',
    family: 'press',
    note: '一栋按编号归档的楼。它把杂乱的故事整理成可以检索的秩序。',
  },
  {
    key: 'yt-w2025-12',
    workId: '6932b5290b68ebe5326f5a46',
    layout: { x: -262, z: 267, plot: 3.8, facing: 'e' }, // S12 东北角夜航街西口小亭，面向站前广场
    facility: '公告小亭',
    family: 'press',
    note: '镇上最普通的一座公告亭。它的存在感恰好像一次平静的通知。',
  },
];
