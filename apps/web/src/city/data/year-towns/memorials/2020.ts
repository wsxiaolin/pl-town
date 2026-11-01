// 年份 2020 纪念设施（从 yearTownMemorials.ts 按年拆分；布局手写唯一事实源）。
// key/workId/facility/family/note/noteKind 为既定事实不可改；layout 可按城市规划重排。
//
// 2020 启明镇＝「向外看的一年」（城门与市政），落位旧港城站前厢（§2）：
// - B3 [-62,13]×[225.5,256] 西城厢：站前街南排（'n'）大小交替成排
//   （academy 4.6 / lab 3.8 / observatory 4.6，8u 均匀间距），东端由议事厅
//   5.5 转临港口大道面东（'e'），镇守站前街×港口大道交叉口西南象限，
//   与中央市场圆盘对景；中市街北排（'s'）两座小体量收里。
// - 西门广场（站前广场 -26,229 r5.2，即启明镇站泊位）：站房地标 yt-arch-2020
//   (-20,232) 守东缘，月相馆 (-34,230.5) 面东对望合成门厅，其余留白；
//   磁悬环线 (−36,252)→(−25.9,229.21)→(−32,210) 斜穿廓内西侧，
//   全部建筑距环线 ≥6.8u。
// - B4 [27,79]×[225.5,256] 东商肆：站前街南排（'n'）两座 3.8 成排（8u），
//   双星撞击台 (30,240) 面西（'w'）锚住中央市场圆盘（20,240 r6.5）东缘；
//   东站前广场 (66,229) 与潮声站房 yt-arch-2021 (60,232)、外城菜市/杂货铺
//   (48,250)/(61,250) 的 7u 净距圈整片留白作装饰区。
import type { YearTownMemorial } from '../_types';

export const YEAR_TOWN_MEMORIALS_2020: readonly YearTownMemorial[] = [
  // ── 启明镇（2020）：向外看的一年 ────────────────────────────────────────
  {
    key: 'yt-w2020-01',
    workId: '5e195ed8b670d4000162e78b',
    layout: { x: 12, z: 229, plot: 5.5, facing: 'e' },
    facility: '议事厅',
    family: 'guild',
    note: '这间厅把「课程该往哪走」变成公开议题，居民第一次以提案和表决的方式改变了自己脚下这座城市。',
  },
  {
    key: 'yt-w2020-02',
    workId: '5eee232f3e71080001a40960',
    layout: { x: -10, z: 226.5, plot: 4.6, facing: 'n' },
    facility: '入门讲堂',
    family: 'academy',
    note: '为初来者而建。讲堂不讲高深内容，只把进门要用的每一步逐条讲清，让新人不必独自摸索。',
  },
  {
    key: 'yt-w2020-03',
    workId: '5f4cba69ddf63e0001d25a12',
    layout: { x: 6, z: 226.5, plot: 4.6, facing: 'n' },
    facility: '恒星观测台',
    family: 'observatory',
    note: '从星尘到红巨星，一座台把恒星的漫长一生压缩成可被看见的几段。夜里穹顶开缝，是镇上看星的地方。',
  },
  {
    key: 'yt-w2020-04',
    workId: '5f3620716adfbe0001ca35e9',
    layout: { x: -2, z: 226.5, plot: 3.8, facing: 'n' },
    facility: '彩字印坊',
    family: 'lab',
    note: '有人发现文字可以用颜色和粗细说话，印坊便成了试用这些手段的地方，招牌上的字至今仍会变色。',
  },
  {
    key: 'yt-w2020-05',
    workId: '5f35fd766adfbe0001ca2d2b',
    layout: { x: 30, z: 226.5, plot: 3.8, facing: 'n' },
    facility: '色谱对照所',
    family: 'lab',
    note: '一整面墙排着可复制的颜色编号。它把「这是什么颜色」变成可以抄下来带走的东西。',
  },
  {
    key: 'yt-w2020-06',
    workId: '5f9e93366c0cae0001661cbe',
    layout: { x: -34, z: 230.5, plot: 3.8, facing: 'e' },
    facility: '月相馆',
    family: 'observatory',
    note: '按月相陈列的展厅，讲解月亮为何盈亏。馆顶留了一圈开口，让真实的月光落在展板上。',
  },
  {
    key: 'yt-w2020-07',
    workId: '5f880f12f2c46200016db893',
    layout: { x: -12, z: 253.5, plot: 3.8, facing: 's' },
    facility: '静思堂',
    family: 'memorial',
    note: '一间不谈结论的堂屋。它只请人坐下，想一想「如果那一刻到来」，因此常年安静。',
  },
  {
    key: 'yt-w2020-08',
    workId: '5ef6bf0dfd88f7000106505d',
    layout: { x: 38, z: 226.5, plot: 3.8, facing: 'n' },
    facility: '视界回廊',
    family: 'observatory',
    note: '回廊向下盘旋，模拟坠入黑洞的最后一段路。走到尽头时，光全都消失了。',
  },
  {
    key: 'yt-w2020-09',
    workId: '5e12b670fe687900017f1c46',
    layout: { x: -4, z: 253.5, plot: 3.8, facing: 's' },
    facility: '措辞试场',
    family: 'lab',
    note: '这处场地专门用来试新词：哪句称呼更贴切，就留下；不合适的，当场换掉。',
  },
  {
    key: 'yt-w2020-10',
    workId: '5f5a1a65cc9e800001f9c89c',
    layout: { x: 30, z: 240, plot: 3.8, facing: 'w' },
    facility: '双星撞击台',
    family: 'observatory',
    note: '两座塔相对而立，中间留出碰撞的轨道。它演示的不是毁灭，而是两个体系合成一个的过程。',
  },
];
