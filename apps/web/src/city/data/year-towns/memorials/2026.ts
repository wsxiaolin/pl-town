// 年份 2026 纪念设施（从 yearTownMemorials.ts 按年拆分；布局手写唯一事实源）。
// key/workId/facility/family/note/noteKind 为既定事实不可改；layout 可按城市规划重排。
//
// 城市重造落位（docs/year-towns-urban-redesign.md §2）：2026·星火镇 =「夜市与灯火」，
// 落位星港城夜市带，两排隔夜市街（z=336）对望形成夜市街谷：
//   S16 南港东排 [-246,-192]×[306,330]  报刊/市政一排，面向夜市街（间口留白给街角亭）
//   S17 夜市西排 [-368,-344]×[342,362]  西端两座，西望市集广场 (-383,352)（留白给灯串摊位）
//   S18 夜市中排 [-313,-270]×[342,366]  夜市主排，临夜市街北墙；东端让开摊位线与广场 (-257,352)
//   S19 夜市东排 [-246,-228]×[342,358]  两座小体量；磁悬环线 z=340 横穿块北缘，压 z≥347 落位
// 全部避让外城生活排屋（cityNeighborhoods，≥7u）与 2024/2025 已落位坐标（≥5u）。
import type { YearTownMemorial } from '../_types';

export const YEAR_TOWN_MEMORIALS_2026: readonly YearTownMemorial[] = [
  // ── 星港城（2026）：走到今天的一年 ──────────────────────────────────────
  {
    key: 'yt-w2026-01',
    workId: '69ec812d22143ce225bd6e65',
    layout: { x: -240.5, z: 347, plot: 3.8, facing: 'n' }, // 夜市东排事件纪念碑，面向夜市街
    facility: '事件纪念碑',
    family: 'memorial',
    note: '为一次波及全城的事件而立。碑上不写指责，只写时间、经过，以及后来怎么修好的。',
  },
  {
    key: 'yt-w2026-02',
    workId: '69e616e322143ce225bcd990',
    layout: { x: -244, z: 327.5, plot: 3.8, facing: 's' }, // 南港东排西端封面橱窗，临夜市街
    facility: '封面橱窗',
    family: 'press',
    note: '一扇只展示封面的橱窗。它承认，很多时候人是从一张图开始走近一件作品的。',
  },
  {
    key: 'yt-w2026-03',
    workId: '696c42e0ff56939d0cddbcec',
    layout: { x: -237.5, z: 327.5, plot: 4.6, facing: 's' }, // 南港东排周刊印刷所，临夜市街
    facility: '周刊印刷所',
    family: 'press',
    note: '一份周刊的常设印刷所。它按周记录城市的动静，久了便成了一部编年史。',
  },
  {
    key: 'yt-w2026-04',
    workId: '699cfa29ba6b58d6da15a01b',
    layout: { x: -225, z: 327.5, plot: 3.8, facing: 's' }, // 南港东排宣告台，面向夜市街
    facility: '宣告台',
    family: 'guild',
    note: '一处用来把话公开说出来的台子。站上去的人不多，但每次都有回声。',
  },
  {
    key: 'yt-w2026-05',
    workId: '696a2e34ff56939d0cddb025',
    layout: { x: -364, z: 345.5, plot: 4.6, facing: 'n' }, // 夜市西排公理讲堂，临夜市街，西望市集广场
    facility: '公理讲堂',
    family: 'academy',
    note: '讲堂从几条最基本的公理出发，一步步搭出整个体系。它示范的是严格如何建立。',
  },
  {
    key: 'yt-w2026-06',
    workId: '69ea2a0dee349f84e2c783b5',
    layout: { x: -288, z: 346, plot: 4.6, facing: 'n' }, // 夜市中排东端论辩厅，临夜市街
    facility: '论辩厅',
    family: 'guild',
    note: '厅内允许激烈争论，但须按轮次发言。它把对立保存成可以复述的形式。',
  },
  {
    key: 'yt-w2026-07',
    workId: '6a520227820886de092b49a7',
    layout: { x: -233.5, z: 347, plot: 3.4, facing: 'n' }, // 夜市东排老者居所，面向夜市街
    facility: '老者居所',
    family: 'dwelling',
    note: '为在这里待了很久的人准备的居所。房间不多，窗朝南，午后有太阳。',
  },
  {
    key: 'yt-w2026-08',
    workId: '696872b6ff56939d0cdda8a6',
    layout: { x: -309, z: 346, plot: 4.6, facing: 'n' }, // 夜市中排西端怪谈藏书楼，临夜市街
    facility: '怪谈藏书楼',
    family: 'narrative',
    note: '楼里收着成系列的怪谈。管理员说，最好的读法是在夜里，且不要读到最后一条。',
  },
  {
    key: 'yt-w2026-09',
    workId: '69611ba3ff56939d0cdd84e9',
    layout: { x: -302, z: 346, plot: 3.4, facing: 'n' }, // 夜市中排时间胶囊亭
    facility: '时间胶囊亭',
    family: 'memorial',
    noteKind: 'capsule',
    note: '亭下埋着这一年封存的记录。开启的日期写在石板上，谁都可以来看它还剩多久。',
  },
  {
    key: 'yt-w2026-10',
    workId: '69650c7c670c33a80646a7a4',
    layout: { x: -218.5, z: 327.5, plot: 4.2, facing: 's' }, // 南港东排东段新人接待站，面向夜市街
    facility: '新人接待站',
    family: 'guild',
    note: '星港城的第一站。站内备着热水与地图，还有一句问了千百遍的话：「第一次来？」',
  },
  {
    key: 'yt-w2026-11',
    workId: '69e4ae40ee349f84e2c774bd',
    layout: { x: -295, z: 346, plot: 3.8, facing: 'n' }, // 夜市中排突围书斋，临夜市街
    facility: '突围书斋',
    family: 'academy',
    note: '书斋讨论如何从既定的路径里走出来。它的窗开得很高，光线只落在书桌中央。',
  },
  {
    key: 'yt-w2026-12',
    workId: '6a6cb0ce86476e226f1e6b41',
    layout: { x: -356.5, z: 346, plot: 4.2, facing: 'n' }, // 夜市西排幻灭纪念堂，临夜市街
    facility: '幻灭纪念堂',
    family: 'memorial',
    note: '堂内纪念一段从热烈到沉寂的过程。它不劝人振作，只把那段路如实陈列。',
  },
];
