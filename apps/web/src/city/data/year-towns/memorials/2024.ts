// 年份 2024 纪念设施（从 yearTownMemorials.ts 按年拆分；布局手写唯一事实源）。
// key/workId/facility/family/note/noteKind 为既定事实不可改；layout 可按城市规划重排。
import type { YearTownMemorial } from '../_types';

export const YEAR_TOWN_MEMORIALS_2024: readonly YearTownMemorial[] = [
  // ── 微光镇（2024）：日常与陪伴的一年 ────────────────────────────────────
  {
    key: 'yt-w2024-01',
    workId: '65d711274c03a9c26e832382',
    layout: { x: -244, z: 227, plot: 5.5, facing: 'n' }, // 微光街区北排起点，面向货站街
    facility: '鸽咖馆',
    family: 'tavern',
    note: '一家把人气聚到一处的小馆。门口挂着营业牌，牌上写着当天谁在店。',
  },
  {
    key: 'yt-w2024-02',
    workId: '65c21aeb000124686a0da1cb',
    layout: { x: -238, z: 227, plot: 5.5, facing: 'n' }, // 与鸽咖馆形成连续餐饮街墙
    facility: '猫咖馆',
    family: 'tavern',
    note: '镇上最安静的一间馆子。窗台上常有猫，客人说话会自动压低声音。',
  },
  {
    key: 'yt-w2024-03',
    workId: '65ec4c7c7724bd85008e094d',
    layout: { x: -232, z: 227, plot: 3.8, facing: 'n' }, // 北排中段，临货站街
    facility: '游荡者小站',
    family: 'gathering',
    note: '一处没有固定用途的地方。它只承认一种状态：暂时还不想停下。',
  },
  {
    key: 'yt-w2024-04',
    workId: '66114fb1d10e3b2940753b23',
    layout: { x: -226, z: 227, plot: 3.8, facing: 'n' }, // 北排收口，转入星港大道
    facility: '小鱼会客厅',
    family: 'gathering',
    note: '会客厅不设门槛，也不点名。它只想让进来的人随便坐一会儿。',
  },
  {
    key: 'yt-w2024-05',
    workId: '65ca1eb94c03a9c26e813f0c',
    layout: { x: -224, z: 234, plot: 4.6, facing: 'e' }, // 大道西侧的制度地标
    facility: '续修律法厅',
    family: 'law',
    note: '律法的又一次续修。厅内保留旧条文的原样，只在旁边注出改动之处。',
  },
  {
    key: 'yt-w2024-06',
    workId: '6673ebf3d46f35b9aadcea6d',
    layout: { x: -224, z: 241, plot: 3.8, facing: 'e' }, // 东缘实验设施面向大道
    facility: '对话实验所',
    family: 'lab',
    note: '一所把「和机器说话」摆上台面的实验所。它记录的不是答案，而是提问方式的变化。',
  },
  {
    key: 'yt-w2024-07',
    workId: '6738a487ce449cb493cd6349',
    layout: { x: -224, z: 248, plot: 3.8, facing: 'e' }, // 夜航街街角店面
    facility: '街角小店',
    family: 'market',
    note: '一间没有名字的小店。招牌空着，生意却一直不错。',
  },
  {
    key: 'yt-w2024-08',
    workId: '66b843682834172329d4eec4',
    layout: { x: -231, z: 248, plot: 3.8, facing: 's' }, // 南排公共门面
    facility: '捐助站',
    family: 'guild',
    note: '站内只做一件事：把愿意给的和需要的对上。账目贴在门口，谁都能看。',
  },
  {
    key: 'yt-w2024-09',
    workId: '676e9b81c45f930f41cc9589',
    layout: { x: -238, z: 248, plot: 3.8, facing: 's' }, // 南排会客厅，与北排共围院落
    facility: '长桌会客厅',
    family: 'gathering',
    note: '一张长桌贯穿整间屋子。坐在哪一头，决定了你听见谁说话。',
  },
  {
    key: 'yt-w2024-10',
    workId: '660fe360d10e3b294074c67e',
    layout: { x: -245, z: 248, plot: 3.2, facing: 's' }, // 西南角安静小亭
    facility: '告白亭',
    family: 'dwelling',
    note: '亭子小得只容两人。它被反复使用，说明有些话始终需要一处地方才说得出口。',
  },
  {
    key: 'yt-w2024-11',
    workId: '66a7940d744ed757b46f7f1d',
    layout: { x: -244, z: 241, plot: 3.2, facing: 'w' }, // 西缘小屋面向湾侧步道
    facility: '试作小屋',
    family: 'dwelling',
    note: '一间用于试验的小屋，连名字都是临时的。它提醒人们：并非每件作品都需要宏大。',
  },
  {
    key: 'yt-w2024-12',
    workId: '6662d7b9d46f35b9aadab02a',
    layout: { x: -244, z: 234, plot: 3.8, facing: 'w' }, // 西缘花园连接滨水步道
    facility: '紫罗兰花园',
    family: 'dwelling',
    note: '一片被写下过的花海。花开时不设围栏，路过的人可以进去坐一会儿。',
  },
  {
    key: 'yt-w2024-13',
    workId: '666e8b11d46f35b9aadc8201',
    layout: { x: -237, z: 234, plot: 3.8, facing: 's' }, // 内巷北侧讲堂
    facility: '逻辑运算馆',
    family: 'academy',
    note: '馆内用实物演示与、或、非。讲解从最基础的规则开始，不假设来者学过。',
  },
  {
    key: 'yt-w2024-14',
    workId: '66f0720c6d0dcacffea48108',
    layout: { x: -230, z: 234, plot: 3.2, facing: 's' }, // 内巷北侧陈列室
    facility: '来函陈列室',
    family: 'press',
    note: '室内陈列一封引起广泛讨论的来函，连同它收到的回应一并保存。',
  },
  {
    key: 'yt-w2024-15',
    workId: '66b856fdd37e8832294bb73a',
    layout: { x: -237, z: 241, plot: 4.6, facing: 'n' }, // 内巷南侧会场，院门朝北
    facility: '周年会场',
    family: 'guild',
    note: '为一次周年活动搭建的会场。活动结束后没有拆，改作镇上的公共集会地。',
  },
  {
    key: 'yt-w2024-16',
    workId: '668d49659e258e6b2f4fbffa',
    layout: { x: -230, z: 241, plot: 3.8, facing: 'n' }, // 内巷夜售店照亮院口
    facility: '夜售店',
    family: 'market',
    noteKind: 'lamp',
    note: '一盏通宵不灭的灯。店里卖什么并不重要，重要的是它证明这里夜里也有人。',
  },
];
