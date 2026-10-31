// 年份 2020 纪念设施（从 yearTownMemorials.ts 按年拆分；布局手写唯一事实源）。
// key/workId/facility/family/note/noteKind 为既定事实不可改；layout 可按城市规划重排。
import type { YearTownMemorial } from '../_types';

export const YEAR_TOWN_MEMORIALS_2020: readonly YearTownMemorial[] = [
  // ── 启明镇（2020）：向外看的一年 ────────────────────────────────────────
  {
    key: 'yt-w2020-01',
    workId: '5e195ed8b670d4000162e78b',
    layout: { x: -11, z: 228, plot: 5.5, facing: 'n' },
    facility: '议事厅',
    family: 'guild',
    note: '这间厅把「课程该往哪走」变成公开议题，居民第一次以提案和表决的方式改变了自己脚下这座城市。',
  },
  {
    key: 'yt-w2020-02',
    workId: '5eee232f3e71080001a40960',
    layout: { x: -3, z: 228, plot: 4.6, facing: 'n' },
    facility: '入门讲堂',
    family: 'academy',
    note: '为初来者而建。讲堂不讲高深内容，只把进门要用的每一步逐条讲清，让新人不必独自摸索。',
  },
  {
    key: 'yt-w2020-03',
    workId: '5f4cba69ddf63e0001d25a12',
    layout: { x: 4, z: 228, plot: 4.6, facing: 'n' },
    facility: '恒星观测台',
    family: 'observatory',
    note: '从星尘到红巨星，一座台把恒星的漫长一生压缩成可被看见的几段。夜里穹顶开缝，是镇上看星的地方。',
  },
  {
    key: 'yt-w2020-04',
    workId: '5f3620716adfbe0001ca35e9',
    layout: { x: 11, z: 228, plot: 3.8, facing: 'n' },
    facility: '彩字印坊',
    family: 'lab',
    note: '有人发现文字可以用颜色和粗细说话，印坊便成了试用这些手段的地方，招牌上的字至今仍会变色。',
  },
  {
    key: 'yt-w2020-05',
    workId: '5f35fd766adfbe0001ca2d2b',
    layout: { x: 11, z: 236, plot: 3.8, facing: 'e' },
    facility: '色谱对照所',
    family: 'lab',
    note: '一整面墙排着可复制的颜色编号。它把「这是什么颜色」变成可以抄下来带走的东西。',
  },
  {
    key: 'yt-w2020-06',
    workId: '5f9e93366c0cae0001661cbe',
    layout: { x: 11, z: 243, plot: 3.8, facing: 'e' },
    facility: '月相馆',
    family: 'observatory',
    note: '按月相陈列的展厅，讲解月亮为何盈亏。馆顶留了一圈开口，让真实的月光落在展板上。',
  },
  {
    key: 'yt-w2020-07',
    workId: '5f880f12f2c46200016db893',
    layout: { x: 11, z: 251, plot: 3.8, facing: 'e' },
    facility: '静思堂',
    family: 'memorial',
    note: '一间不谈结论的堂屋。它只请人坐下，想一想「如果那一刻到来」，因此常年安静。',
  },
  {
    key: 'yt-w2020-08',
    workId: '5ef6bf0dfd88f7000106505d',
    layout: { x: 5, z: 252, plot: 3.8, facing: 's' },
    facility: '视界回廊',
    family: 'observatory',
    note: '回廊向下盘旋，模拟坠入黑洞的最后一段路。走到尽头时，光全都消失了。',
  },
  {
    key: 'yt-w2020-09',
    workId: '5e12b670fe687900017f1c46',
    layout: { x: -2, z: 252, plot: 3.8, facing: 's' },
    facility: '措辞试场',
    family: 'lab',
    note: '这处场地专门用来试新词：哪句称呼更贴切，就留下；不合适的，当场换掉。',
  },
  {
    key: 'yt-w2020-10',
    workId: '5f5a1a65cc9e800001f9c89c',
    layout: { x: -9, z: 252, plot: 3.8, facing: 's' },
    facility: '双星撞击台',
    family: 'observatory',
    note: '两座塔相对而立，中间留出碰撞的轨道。它演示的不是毁灭，而是两个体系合成一个的过程。',
  },
];
