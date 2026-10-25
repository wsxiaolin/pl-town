// 年份群岛纪念设施目录（手写，设计 §7.1 修订：作品 → 城市设施）。
//
// 设计原则：年份群岛纪念的是「社区在某个年份做成了什么」，因此把作品抽象成
// 一种城市物件，而不是把作品标题直接挂到建筑上。每座设施给出：
//   - facility：设施名（建筑 label 唯一来源，只用设施名）
//   - family：设施族（决定 shape，见 FACILITY_SHAPES）
//   - note：纪念导语（面板正文，一句话说明为何在此立此物）
//
// 原始作品正文、评论、热度、浏览量等社区数据不进入年份群岛，也不进入任何
// 生成产物；key 为建筑 id（yt-w{year}-{rank}），workId 仅用于稳定关联。
import type { FacilityFamily, YearTownMemorial } from './_types';

/** 设施族 → 既有程序化 shape（rendering/buildingMeshFactory.ts 的真实几何）。 */
export const FACILITY_SHAPES: Readonly<Record<FacilityFamily, string>> = {
  /** 律法与制度：柱廊立面 + 中央台基，庄重、可宣读。 */
  law: 'bank',
  /** 集会与闲谈：带雨棚的低层市集，街道生活的发生器。 */
  gathering: 'market',
  /** 教程与学理：围合庭院 + 门楼，藏讲义、可讲学。 */
  academy: 'academy',
  /** 观星与物理：穹顶开缝，指向天空。 */
  observatory: 'observatory',
  /** 叙事与虚构：多层的塔与灯，供人逐层翻阅。 */
  narrative: 'pagoda',
  /** 声光与实验：玻璃体量，把实验摆进橱窗。 */
  lab: 'greenhouse',
  /** 餐饮与招待：木构、暖光、临街小门脸。 */
  tavern: 'tavern',
  /** 商业与交换：临街店面 + 大玻璃，招牌醒目。 */
  market: 'mall',
  /** 告别与追念：封闭院落 + 高墙，静默的空间。 */
  memorial: 'temple',
  /** 起居与日常：坡顶民居语汇，尺度亲和。 */
  dwelling: 'school',
  /** 报业与纪录：细高的印刷塔，可悬挂版面。 */
  press: 'tower',
  /** 社群与组织：门楼 + 匾额，作为登记与集合点。 */
  guild: 'qipai',
};

/** 106 座作品建筑 → 纪念设施（按年份、镇内名次排列）。 */
export const YEAR_TOWN_MEMORIALS: readonly YearTownMemorial[] = [
  // ── 起源村（2019）：社区的两块基石 ──────────────────────────────────────
  {
    key: 'yt-w2019-01',
    workId: '5d921799a88e5200014fc0e5',
    layout: { x: 138, z: 211, plot: 5.5, facing: 'e' },
    facility: '律法碑廊',
    family: 'law',
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

  // ── 潮声镇（2021）：人来人往的一年 ──────────────────────────────────────
  {
    key: 'yt-w2021-01',
    workId: '611e318ccb286c0001737c13',
    layout: { x: 32, z: 228, plot: 5.5, facing: 'n' },
    facility: '初代会客厅',
    family: 'gathering',
    note: '镇上最早的一间会客厅。当年整座城的闲谈都从这里开始，桌子至今没有撤走。',
  },
  {
    key: 'yt-w2021-02',
    workId: '6143623b861960000160475f',
    layout: { x: 38, z: 228, plot: 4.6, facing: 'n' },
    facility: '第三代会客厅',
    family: 'gathering',
    note: '会客厅第三次搬到这里。墙面记着历次搬迁的年份，是潮声镇最常被问路的地方。',
  },
  {
    key: 'yt-w2021-03',
    workId: '6155d913861960000162a4fe',
    layout: { x: 44, z: 228, plot: 4.6, facing: 'n' },
    facility: '第四代会客厅',
    family: 'gathering',
    note: '会客厅的第四个家。它比前几代更宽敞，也第一次专门留出了问答的角落。',
  },
  {
    key: 'yt-w2021-04',
    workId: '6119f0a8cb286c000172a7ef',
    layout: { x: 50, z: 228, plot: 3.8, facing: 'n' },
    facility: '循环乐坊',
    family: 'gathering',
    note: '乐坊只放一首歌，且永远从头开始。居民把它当作潮声镇的门铃——听见就知道自己到镇上了。',
  },
  {
    key: 'yt-w2021-05',
    workId: '6130ebc15fd38c0001bcea68',
    layout: { x: 56, z: 228, plot: 3.8, facing: 'n' },
    facility: '第二代会客厅',
    family: 'gathering',
    note: '第二代会客厅，屋顶修得比初代低。据说是为了让路人抬头时正好看见檐下的留言板。',
  },
  {
    key: 'yt-w2021-06',
    workId: '60da78eefdb33a0001226d07',
    layout: { x: 55, z: 234, plot: 3.8, facing: 'e' },
    facility: '逻辑书院',
    family: 'academy',
    note: '书院按章逐节讲授逻辑电路，从最基础的门一路讲到乘法器。目录就刻在门厅的墙上。',
  },
  {
    key: 'yt-w2021-07',
    workId: '6072a5cbf6fe9b0001d81703',
    layout: { x: 55, z: 240, plot: 3.8, facing: 'e' },
    facility: '新居民导览站',
    family: 'academy',
    note: '进镇第一站。这里不卖东西，只告诉初来者哪条路安全、哪些话说不得、遇事该找谁。',
  },
  {
    key: 'yt-w2021-08',
    workId: '61c1cbaf0a9ec000018f92d8',
    layout: { x: 55, z: 246, plot: 3.8, facing: 'e' },
    facility: '重建会客厅',
    family: 'gathering',
    note: '会客厅曾在一次故障中垮掉，这一座是照着原样重建的。门楣上留着那年的修补痕迹。',
  },
  {
    key: 'yt-w2021-09',
    workId: '60935a73b4e3240001734913',
    layout: { x: 55, z: 252, plot: 3.8, facing: 'e' },
    facility: '样式工坊',
    family: 'lab',
    note: '工坊教人给文字上色、加粗、留白。镇上许多招牌的字体，都是从这里的第一张样张抄来的。',
  },
  {
    key: 'yt-w2021-10',
    workId: '617bfffb0cf0bd0001200e9b',
    layout: { x: 50, z: 254, plot: 3.8, facing: 's' },
    facility: '星海会客厅',
    family: 'gathering',
    note: '会客厅的穹顶画着星海，夜里会缓缓流动。它证明了聊天的地方也可以是一处风景。',
  },
  {
    key: 'yt-w2021-11',
    workId: '617ea92d0cf0bd000120656a',
    layout: { x: 44, z: 254, plot: 3.2, facing: 's' },
    facility: '提案广场',
    family: 'guild',
    note: '一座为讨论「下一版城市长什么样」而设的广场。提案写在石板上，谁都可以走近添一笔。',
  },
  {
    key: 'yt-w2021-12',
    workId: '61697cc6753eb80001f7af9a',
    layout: { x: 38, z: 254, plot: 3.2, facing: 's' },
    facility: '第五代会客厅',
    family: 'gathering',
    note: '第五代会客厅，门口无台阶，据说是历次搬迁中第一次考虑到推门而入的便利。',
  },
  {
    key: 'yt-w2021-13',
    workId: '618e5f6f5885db00016f5250',
    layout: { x: 32, z: 254, plot: 3.2, facing: 's' },
    facility: '继任会客厅',
    family: 'gathering',
    note: '上一间会客厅冷清之后，有人接手把它重新点亮。这座楼纪念的是「接力」本身。',
  },
  {
    key: 'yt-w2021-14',
    workId: '610b370a93c6cf000144d4ee',
    layout: { x: 31, z: 248, plot: 3.2, facing: 'w' },
    facility: '冷巷茶室',
    family: 'tavern',
    note: '一间公认「不会有多少人来的」茶室。正因如此，它成了想安静说话的人最常去的地方。',
  },
  {
    key: 'yt-w2021-15',
    workId: '60f442b2cf29060001b519d6',
    layout: { x: 31, z: 241, plot: 3.2, facing: 'w' },
    facility: '著述守则碑',
    family: 'law',
    note: '碑上刻的不是处罚，而是「引用与署名」的分界。争论最激烈的那几年，它就立在这里。',
  },
  {
    key: 'yt-w2021-16',
    workId: '61af53d10a9ec000018df109',
    layout: { x: 31, z: 234, plot: 3.2, facing: 'w' },
    facility: '第七代会客厅',
    family: 'gathering',
    note: '会客厅的第七代，也是潮声镇最后一代。门一直开着，等一个不会再来的旧人。',
  },

  // ── 盛夏镇（2022）：规则与故事并行的一年 ────────────────────────────────
  {
    key: 'yt-w2022-01',
    workId: '620665aad58bcf00016aeb8b',
    layout: { x: -11, z: 273, plot: 5.5, facing: 'n' },
    facility: '新律法厅',
    family: 'law',
    note: '律法碑廊的续篇。厅内条文更细，把从前靠默契的部分也写了进去。',
  },
  {
    key: 'yt-w2022-02',
    workId: '61ef8eea8af0a60001d993a0',
    layout: { x: -5, z: 273, plot: 4.6, facing: 'n' },
    facility: '功能陈列馆',
    family: 'lab',
    note: '把散落各处的隐藏功能集中陈列。它更像一本说明书，进馆的人多半带着问题。',
  },
  {
    key: 'yt-w2022-03',
    workId: '61ef8a128af0a60001d99267',
    layout: { x: 1, z: 273, plot: 4.6, facing: 'n' },
    facility: '艺术字长廊',
    family: 'lab',
    note: '长廊两侧挂着同一句话的不同写法。走到底才明白，内容没变，语气全变了。',
  },
  {
    key: 'yt-w2022-04',
    workId: '6282fdecf1766800018dad23',
    layout: { x: 7, z: 273, plot: 3.8, facing: 'n' },
    facility: '路标广场',
    family: 'guild',
    note: '广场中央立着指向各镇的木牌。它纪念的是城市第一次有了「方向」这件事。',
  },
  {
    key: 'yt-w2022-05',
    workId: '62dd08a637fde000013cae5e',
    layout: { x: 12, z: 273, plot: 3.8, facing: 'n' },
    facility: '律动舞台',
    family: 'gathering',
    note: '一座会跟着节拍轻晃的露天舞台。夏天傍晚，镇上的人常聚在这里。',
  },
  {
    key: 'yt-w2022-06',
    workId: '626c9bc50948e50001d9e45f',
    layout: { x: 11, z: 280, plot: 3.8, facing: 'e' },
    facility: '封禁告示亭',
    family: 'law',
    note: '亭内张贴过最严厉的一次处断。它留下的不是名单，而是关于边界的一次公开说明。',
  },
  {
    key: 'yt-w2022-07',
    workId: '62d412bd57ab5800018bc03f',
    layout: { x: 11, z: 287, plot: 3.8, facing: 'e' },
    facility: '荒岛连载楼',
    family: 'narrative',
    note: '一部长篇的居所。楼层越高，故事走得越远；写到第六章时，楼已经修到了顶。',
  },
  {
    key: 'yt-w2022-08',
    workId: '62f1d55dafedf1000165551b',
    layout: { x: 11, z: 294, plot: 3.8, facing: 'e' },
    facility: '解忧杂货铺',
    family: 'tavern',
    note: '铺子收的不是钱，是问题。写下来投进柜台，多数都会在几天后收到一封回信。',
  },
  {
    key: 'yt-w2022-09',
    workId: '62ea8af8afedf10001634fb0',
    layout: { x: 11, z: 301, plot: 3.8, facing: 'e' },
    facility: '坚持者纪念堂',
    family: 'memorial',
    note: '为那些几乎要放弃的人而建。堂内没有说明牌，只有一段被反复重读的话。',
  },
  {
    key: 'yt-w2022-10',
    workId: '63909e6247585a979cbd31a0',
    layout: { x: 5, z: 302, plot: 3.8, facing: 's' },
    facility: '讨论角',
    family: 'gathering',
    note: '一个人提出问题，镇上留下回声的地方。后来争议散尽，石桌还留在原地。',
  },
  {
    key: 'yt-w2022-11',
    workId: '630da53f442f8c0001dde3e1',
    layout: { x: -1, z: 302, plot: 3.2, facing: 's' },
    facility: '结局陈列馆',
    family: 'narrative',
    note: '馆内依次陈列社区可能走向的结局。最后一间空着，留给尚未发生的那个。',
  },
  {
    key: 'yt-w2022-12',
    workId: '6302f66823f7f0000130d33a',
    layout: { x: -7, z: 302, plot: 3.2, facing: 's' },
    facility: '投稿要求碑',
    family: 'law',
    note: '碑面是一份可核对的要求清单。它让「什么样的作品可以进实验区」不再靠人揣度。',
  },
  {
    key: 'yt-w2022-13',
    workId: '62144cf131d9a6000148553a',
    layout: { x: -12, z: 302, plot: 3.2, facing: 's' },
    facility: '年资查验所',
    family: 'guild',
    note: '一处只需回答「你来了多久」的小屋。答案被刻在门外的柱子上，越久越靠内侧。',
  },
  {
    key: 'yt-w2022-14',
    workId: '630cbdeede06940001b31cda',
    layout: { x: -11, z: 295, plot: 3.2, facing: 'w' },
    facility: '值守哨所',
    family: 'law',
    note: '哨所提醒的是一件朴素的事：维持秩序的人也需要被尊重。',
  },
  {
    key: 'yt-w2022-15',
    workId: '629b5e5708920800019721b0',
    layout: { x: -11, z: 288, plot: 3.2, facing: 'w' },
    facility: '评选公告亭',
    family: 'press',
    note: '亭中发布过关于「精选候选」的第一份公告。从此评选有了可查的流程。',
  },
  {
    key: 'yt-w2022-16',
    workId: '621b045831d9a6000148d5ff',
    layout: { x: -11, z: 281, plot: 3.2, facing: 'w' },
    facility: '告别站',
    family: 'memorial',
    note: '为离开的人留下的站台。没有列车会停靠，但每年仍有人来这里说一句话。',
  },
  {
    key: 'yt-w2022-17',
    workId: '639f1085f10a6c581e8b72df',
    layout: { x: -4, z: 283, plot: 3.2, facing: 's' },
    facility: '会员餐厅',
    family: 'tavern',
    note: '一间讲究规矩的餐厅：入座需邀请，点单需口令。它把「稀缺」做成了可体验的日常。',
  },
  {
    key: 'yt-w2022-18',
    workId: '61da85635fe7e8000106542d',
    layout: { x: 4, z: 283, plot: 3.2, facing: 's' },
    facility: '文明陈列馆',
    family: 'narrative',
    note: '馆内陈列一座古文明的兴衰。策展人最用心的一段，写的是它留下什么，而非它毁于什么。',
  },
  {
    key: 'yt-w2022-19',
    workId: '62a345d108920800019806f2',
    layout: { x: -4, z: 292, plot: 3.2, facing: 'n' },
    facility: '虫洞观测站',
    family: 'observatory',
    note: '观测站并不真的通往别处，但它让人第一次认真想象「从这里穿过去」会到哪里。',
  },
  {
    key: 'yt-w2022-20',
    workId: '627d01305a9b86000155b5da',
    layout: { x: 4, z: 292, plot: 3.2, facing: 'n' },
    facility: '怪谈档案馆',
    family: 'narrative',
    note: '档案按规则编号存放。借阅者须先接受一条规则：读完之后，要假装从未来过。',
  },

  // ── 回响镇（2023）：虚构与生活交织的一年 ────────────────────────────────
  {
    key: 'yt-w2023-01',
    workId: '63ccf6784906dcddc29099c4',
    layout: { x: 31, z: 273, plot: 5.5, facing: 'n' },
    facility: '地下城酒馆',
    family: 'tavern',
    note: '一座设在地下的酒馆，玩家在此扮演各自的角色。它是「以另一种身份说话」最早的地方。',
  },
  {
    key: 'yt-w2023-02',
    workId: '650f2baf701e8266e4aee449',
    layout: { x: 37, z: 273, plot: 4.6, facing: 'n' },
    facility: '自我介绍亭',
    family: 'guild',
    note: '亭中只有一面镜子和一支笔。它纪念的是人们愿意在此说自己是谁。',
  },
  {
    key: 'yt-w2023-03',
    workId: '654782b83b13265ec0206f9a',
    layout: { x: 43, z: 273, plot: 4.6, facing: 'n' },
    facility: '金月杂货铺',
    family: 'market',
    note: '铺子只卖两样东西，却认真经营多年。它证明了小店不需要多，也能成为街角的地标。',
  },
  {
    key: 'yt-w2023-04',
    workId: '63da861dbf4e44a71a256bdc',
    layout: { x: 49, z: 273, plot: 3.8, facing: 'n' },
    facility: '往生堂',
    family: 'memorial',
    note: '堂内替人操办告别的仪式。它把「结束」这件事处理得体面，因此镇上的人并不避讳经过。',
  },
  {
    key: 'yt-w2023-05',
    workId: '64883d649b2695a9991957de',
    layout: { x: 55, z: 273, plot: 3.8, facing: 'n' },
    facility: '旅人客栈',
    family: 'tavern',
    note: '客栈的招牌写得很小，房门却总是开着。长途而来的人多在此歇脚。',
  },
  {
    key: 'yt-w2023-06',
    workId: '6533ddb34d12128c0f04d9bc',
    layout: { x: 55, z: 280, plot: 3.8, facing: 'e' },
    facility: '街口会客厅',
    family: 'gathering',
    note: '回响镇最小的会客厅，只有一张长桌。因为离街口近，反而最常有人推门。',
  },
  {
    key: 'yt-w2023-07',
    workId: '6505a6c3701e8266e4addd33',
    layout: { x: 55, z: 287, plot: 3.8, facing: 'e' },
    facility: '无题杂谈室',
    family: 'gathering',
    note: '室名至今空着。主人说，等哪天想清楚了再挂上去。',
  },
  {
    key: 'yt-w2023-08',
    workId: '6517d85b366e96412de33096',
    layout: { x: 55, z: 294, plot: 3.8, facing: 'e' },
    facility: '作者名录馆',
    family: 'press',
    note: '馆内按年份收录写作者与其代表作。它让「谁在这儿写过什么」变得可以查证。',
  },
  {
    key: 'yt-w2023-09',
    workId: '6550f7f03b13265ec02224a5',
    layout: { x: 55, z: 301, plot: 3.8, facing: 'e' },
    facility: '杂鱼小店',
    family: 'market',
    note: '一间自称「杂鱼」的店，卖些不成体系的东西。镇民路过时总愿意进去翻两下。',
  },
  {
    key: 'yt-w2023-10',
    workId: '63b56078f10a6c581e92187d',
    layout: { x: 49, z: 302, plot: 3.8, facing: 's' },
    facility: '遗言亭',
    family: 'memorial',
    note: '亭中允许把话说完。写下来的人多半没有真的离开，这让亭子更像一次深呼吸。',
  },
  {
    key: 'yt-w2023-11',
    workId: '63c63bd44906dcddc28eb175',
    layout: { x: 43, z: 302, plot: 3.2, facing: 's' },
    facility: '互助会所',
    family: 'guild',
    note: '会所登记愿意帮忙的人，也登记需要帮忙的人。它把善意变成了可检索的名单。',
  },
  {
    key: 'yt-w2023-12',
    workId: '65294a284d12128c0f02fa48',
    layout: { x: 37, z: 302, plot: 3.2, facing: 's' },
    facility: '自我介绍廊',
    family: 'guild',
    note: '廊下垂着一页页自我介绍，风一过就轻轻相碰，像在互相介绍。',
  },
  {
    key: 'yt-w2023-13',
    workId: '63dd09ffbf4e44a71a2633da',
    layout: { x: 31, z: 302, plot: 3.2, facing: 's' },
    facility: '序章剧场',
    family: 'narrative',
    note: '剧场只演第一幕。据说最难的永远是开头，所以它专门为「开始」而建。',
  },
  {
    key: 'yt-w2023-14',
    workId: '64b8cc1e5e2f05a09bf265a1',
    layout: { x: 31, z: 295, plot: 3.2, facing: 'w' },
    facility: '后室入口',
    family: 'narrative',
    note: '通往无穷尽房间的入口。目录贴在门边，提醒来者：越往里越难回头。',
  },
  {
    key: 'yt-w2023-15',
    workId: '63e3837fbf4e44a71a27834b',
    layout: { x: 31, z: 288, plot: 3.2, facing: 'w' },
    facility: '封面陈列所',
    family: 'press',
    note: '这处陈列所只挂封面，不展开内容。它承认第一眼的吸引力也是一种诚实。',
  },
  {
    key: 'yt-w2023-16',
    workId: '63c02f294906dcddc28cea8f',
    layout: { x: 31, z: 281, plot: 3.2, facing: 'w' },
    facility: '志愿者登记处',
    family: 'guild',
    note: '一处安静的小楼，负责把愿意出力的人安排到合适的位置。镇上的公共事务多从这里开始。',
  },
  {
    key: 'yt-w2023-17',
    workId: '63de75b0bf4e44a71a26a92f',
    layout: { x: 40, z: 283, plot: 3.2, facing: 's' },
    facility: '小说区公告亭',
    family: 'press',
    note: '亭上贴着专区规则。它标志着虚构写作在这里有了自己的街区。',
  },
  {
    key: 'yt-w2023-18',
    workId: '65294db54d12128c0f02fc00',
    layout: { x: 47, z: 292, plot: 3.2, facing: 'n' },
    facility: '乞讨者小屋',
    family: 'dwelling',
    note: '一间坦率承认自己窘迫的小屋。它的存在让镇上的人记得，热闹之外还有另一种处境。',
  },

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
    note: '一盏通宵不灭的灯。店里卖什么并不重要，重要的是它证明这里夜里也有人。',
  },

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

  // ── 星港城（2026）：走到今天的一年 ──────────────────────────────────────
  {
    key: 'yt-w2026-01',
    workId: '69ec812d22143ce225bd6e65',
    layout: { x: -206, z: 227, plot: 3.8, facing: 'n' }, // 公共街区北端纪念碑
    facility: '事件纪念碑',
    family: 'memorial',
    note: '为一次波及全城的事件而立。碑上不写指责，只写时间、经过，以及后来怎么修好的。',
  },
  {
    key: 'yt-w2026-02',
    workId: '69e616e322143ce225bcd990',
    layout: { x: -199, z: 227, plot: 3.2, facing: 'n' }, // 货站街封面橱窗
    facility: '封面橱窗',
    family: 'press',
    note: '一扇只展示封面的橱窗。它承认，很多时候人是从一张图开始走近一件作品的。',
  },
  {
    key: 'yt-w2026-03',
    workId: '696c42e0ff56939d0cddbcec',
    layout: { x: -192, z: 227, plot: 3.8, facing: 'n' }, // 周刊印刷所临货站街
    facility: '周刊印刷所',
    family: 'press',
    note: '一份周刊的常设印刷所。它按周记录城市的动静，久了便成了一部编年史。',
  },
  {
    key: 'yt-w2026-04',
    workId: '699cfa29ba6b58d6da15a01b',
    layout: { x: -186, z: 227, plot: 3.2, facing: 'n' }, // 北排宣告台
    facility: '宣告台',
    family: 'guild',
    note: '一处用来把话公开说出来的台子。站上去的人不多，但每次都有回声。',
  },
  {
    key: 'yt-w2026-05',
    workId: '696a2e34ff56939d0cddb025',
    layout: { x: -186, z: 240, plot: 3.8, facing: 'e' }, // 东缘公理讲堂
    facility: '公理讲堂',
    family: 'academy',
    note: '讲堂从几条最基本的公理出发，一步步搭出整个体系。它示范的是严格如何建立。',
  },
  {
    key: 'yt-w2026-06',
    workId: '69ea2a0dee349f84e2c783b5',
    layout: { x: -186, z: 263, plot: 3.8, facing: 'e' }, // 夜航街东口论辩厅
    facility: '论辩厅',
    family: 'guild',
    note: '厅内允许激烈争论，但须按轮次发言。它把对立保存成可以复述的形式。',
  },
  {
    key: 'yt-w2026-07',
    workId: '6a520227820886de092b49a7',
    layout: { x: -186, z: 277, plot: 3.8, facing: 'e' }, // 东侧安静居住段
    facility: '老者居所',
    family: 'dwelling',
    note: '为在这里待了很久的人准备的居所。房间不多，窗朝南，午后有太阳。',
  },
  {
    key: 'yt-w2026-08',
    workId: '696872b6ff56939d0cdda8a6',
    layout: { x: -193, z: 292, plot: 3.8, facing: 's' }, // 南港街藏书楼
    facility: '怪谈藏书楼',
    family: 'narrative',
    note: '楼里收着成系列的怪谈。管理员说，最好的读法是在夜里，且不要读到最后一条。',
  },
  {
    key: 'yt-w2026-09',
    workId: '69611ba3ff56939d0cdd84e9',
    layout: { x: -200, z: 292, plot: 3.2, facing: 's' }, // 南排时间胶囊亭
    facility: '时间胶囊亭',
    family: 'memorial',
    note: '亭下埋着这一年封存的记录。开启的日期写在石板上，谁都可以来看它还剩多久。',
  },
  {
    key: 'yt-w2026-10',
    workId: '69650c7c670c33a80646a7a4',
    layout: { x: -207, z: 292, plot: 3.8, facing: 's' }, // 南排接待站
    facility: '新人接待站',
    family: 'guild',
    note: '星港城的第一站。站内备着热水与地图，还有一句问了千百遍的话：「第一次来？」',
  },
  {
    key: 'yt-w2026-11',
    workId: '69e4ae40ee349f84e2c774bd',
    layout: { x: -206, z: 270, plot: 3.2, facing: 'w' }, // 西缘书斋面向大道
    facility: '突围书斋',
    family: 'academy',
    note: '书斋讨论如何从既定的路径里走出来。它的窗开得很高，光线只落在书桌中央。',
  },
  {
    key: 'yt-w2026-12',
    workId: '6a6cb0ce86476e226f1e6b41',
    layout: { x: -206, z: 245, plot: 3.2, facing: 'w' }, // 西缘纪念堂，面向星港大道
    facility: '幻灭纪念堂',
    family: 'memorial',
    note: '堂内纪念一段从热烈到沉寂的过程。它不劝人振作，只把那段路如实陈列。',
  },
];

/** 建筑 id → 纪念设施（生成器与运行时共用）。 */
export const YEAR_TOWN_MEMORIAL_BY_KEY: Readonly<Record<string, YearTownMemorial>> = Object.fromEntries(
  YEAR_TOWN_MEMORIALS.map((m) => [m.key, m]),
);

/** 各镇档案馆/总目塔/村碑的纪念名录导语（取代作品检索）。 */
export const YEAR_TOWN_LANDMARK_NOTES: Readonly<Record<string, string>> = {
  'yt-arch-2020': '启明镇纪念名录。按年份收录本镇立起的设施，记录它们各自纪念了什么。',
  'yt-arch-2021': '潮声镇纪念名录。这里陈列会客厅的历代沿革，以及它们见证过的闲谈。',
  'yt-arch-2022': '盛夏镇纪念名录。收录本镇关于规则与故事的设施，按立碑先后排列。',
  'yt-arch-2023': '回响镇纪念名录。这册名录偏重虚构写作的街区，以及与它相伴的日常设施。',
  'yt-arch-2024': '微光镇纪念名录。所录多为小店、会客厅与咖啡馆，是一份生活史。',
  'yt-arch-2025': '长风镇纪念名录。这里记录交接、回望与重新出发的那些设施。',
  'yt-arch-2026': '星港城纪念名录。最新的一册，仍在增补。',
  'yt-tower': '千作总目塔。塔内不再陈列作品原文，只按年份立册，记下每年这座城市做成了什么。',
  'yt-stele-2019': '起源村界碑。社区从两块基石开始，此后每一年都在别处另立一岛。',
};
