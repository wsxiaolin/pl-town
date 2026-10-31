// 年份 2023 纪念设施（从 yearTownMemorials.ts 按年拆分；布局手写唯一事实源）。
// key/workId/facility/family/note/noteKind 为既定事实不可改；layout 可按城市规划重排。
//
// 2023 归港镇城市重造落位（docs/year-towns-urban-redesign.md §2，「归航与安居」）：
// 18 座设施全部落旧港城南带六个登记街廓——
//   B13 [-8,13]×[341.5,358]  2 座：海堤排（'s'）客栈 + 东角酒馆转临港口大道
//       面东（'e'，与 2020 议事厅同款大道转角），与外城晚钟茶馆 (4,354)、
//       海风鱼铺 (-12,354) 互成海堤街界面；
//   B14 [27,58]×[341.5,358]  3 座：西南角续海堤排（'s'），北排两座临灯市街
//       （'n'）；北缘让开磁悬环线 (72,332)→(20,346) 斜穿段（最近 9.4u），
//       并让开外城修鞋铺/紫荆里公寓 (37,354)/(52,354) 的 7u 净距圈；
//   B15 [66,94]×[341.5,358]  4 座：北排一列齐 face 's' 围合海灯市集广场
//       (78,354) r7（广场内圈留白给集市，最近 10.2u），东端让开灯塔看守
//       宿舍 (88,354)，距东堤街 ≥12；
//   B16 [-62,13]×[372,396]   5 座（南大里）：北排临南市街林荫道（'n'），
//       南排补外城长屋一/二 (-57,394)/(-27,394) 之间的空档（'s'），东南角
//       往生堂占港口大道门面；courtyard 9 院心 (-24.5,384) 整片留白；
//   B17 [27,59]×[372,396]    3 座：西角面港口大道（'w'）与往生堂隔街对望，
//       北排临林荫道（'n'），南缘一座面院；courtyard 8 院心 (43,384) 留白；
//   B18 [14,26]×[405,411]    1 座：南码头 civic 单座面 's' 迎水广场
//       (20,428)，与终章馆 (20,417) 保持 9u。
// 海堤街（z364）/南市街（z366）双街走廊不落建筑；全部建筑距外城既有坐标 ≥7u，
// 距磁悬环线梁中心 ≥9u。
import type { YearTownMemorial } from '../_types';

export const YEAR_TOWN_MEMORIALS_2023: readonly YearTownMemorial[] = [
  // ── 回响镇（2023）：虚构与生活交织的一年 ────────────────────────────────
  {
    key: 'yt-w2023-01',
    workId: '63ccf6784906dcddc29099c4',
    layout: { x: 12, z: 355, plot: 5.5, facing: 'e' },
    facility: '地下城酒馆',
    family: 'tavern',
    note: '一座设在地下的酒馆，玩家在此扮演各自的角色。它是「以另一种身份说话」最早的地方。',
  },
  {
    key: 'yt-w2023-02',
    workId: '650f2baf701e8266e4aee449',
    layout: { x: 20, z: 408, plot: 4.6, facing: 's' },
    facility: '自我介绍亭',
    family: 'guild',
    note: '亭中只有一面镜子和一支笔。它纪念的是人们愿意在此说自己是谁。',
  },
  {
    key: 'yt-w2023-03',
    workId: '654782b83b13265ec0206f9a',
    layout: { x: 29.5, z: 355, plot: 4.6, facing: 's' },
    facility: '金月杂货铺',
    family: 'market',
    note: '铺子只卖两样东西，却认真经营多年。它证明了小店不需要多，也能成为街角的地标。',
  },
  {
    key: 'yt-w2023-04',
    workId: '63da861dbf4e44a71a256bdc',
    layout: { x: 10, z: 393, plot: 5.5, facing: 'e' },
    facility: '往生堂',
    family: 'memorial',
    note: '堂内替人操办告别的仪式。它把「结束」这件事处理得体面，因此镇上的人并不避讳经过。',
  },
  {
    key: 'yt-w2023-05',
    workId: '64883d649b2695a9991957de',
    layout: { x: -4, z: 355, plot: 4.6, facing: 's' },
    facility: '旅人客栈',
    family: 'tavern',
    note: '客栈的招牌写得很小，房门却总是开着。长途而来的人多在此歇脚。',
  },
  {
    key: 'yt-w2023-06',
    workId: '6533ddb34d12128c0f04d9bc',
    layout: { x: 68.5, z: 344, plot: 4.6, facing: 's' },
    facility: '街口会客厅',
    family: 'gathering',
    note: '回响镇最小的会客厅，只有一张长桌。因为离街口近，反而最常有人推门。',
  },
  {
    key: 'yt-w2023-07',
    workId: '6505a6c3701e8266e4addd33',
    layout: { x: 76, z: 344, plot: 4.2, facing: 's' },
    facility: '无题杂谈室',
    family: 'gathering',
    note: '室名至今空着。主人说，等哪天想清楚了再挂上去。',
  },
  {
    key: 'yt-w2023-08',
    workId: '6517d85b366e96412de33096',
    layout: { x: 84, z: 344, plot: 5, facing: 's' },
    facility: '作者名录馆',
    family: 'press',
    note: '馆内按年份收录写作者与其代表作。它让「谁在这儿写过什么」变得可以查证。',
  },
  {
    key: 'yt-w2023-09',
    workId: '6550f7f03b13265ec02224a5',
    layout: { x: 44, z: 349.5, plot: 4.2, facing: 'n' },
    facility: '杂鱼小店',
    family: 'market',
    note: '一间自称「杂鱼」的店，卖些不成体系的东西。镇民路过时总愿意进去翻两下。',
  },
  {
    key: 'yt-w2023-10',
    workId: '63b56078f10a6c581e92187d',
    layout: { x: -42, z: 393.5, plot: 4.2, facing: 's' },
    facility: '遗言亭',
    family: 'memorial',
    note: '亭中允许把话说完。写下来的人多半没有真的离开，这让亭子更像一次深呼吸。',
  },
  {
    key: 'yt-w2023-11',
    workId: '63c63bd44906dcddc28eb175',
    layout: { x: -59.5, z: 375, plot: 4.6, facing: 'n' },
    facility: '互助会所',
    family: 'guild',
    note: '会所登记愿意帮忙的人，也登记需要帮忙的人。它把善意变成了可检索的名单。',
  },
  {
    key: 'yt-w2023-12',
    workId: '65294a284d12128c0f02fa48',
    layout: { x: 29.5, z: 384, plot: 4.2, facing: 'w' },
    facility: '自我介绍廊',
    family: 'guild',
    note: '廊下垂着一页页自我介绍，风一过就轻轻相碰，像在互相介绍。',
  },
  {
    key: 'yt-w2023-13',
    workId: '63dd09ffbf4e44a71a2633da',
    layout: { x: -38, z: 374.5, plot: 4.6, facing: 'n' },
    facility: '序章剧场',
    family: 'narrative',
    note: '剧场只演第一幕。据说最难的永远是开头，所以它专门为「开始」而建。',
  },
  {
    key: 'yt-w2023-14',
    workId: '64b8cc1e5e2f05a09bf265a1',
    layout: { x: 33, z: 391.5, plot: 4.2, facing: 's' },
    facility: '后室入口',
    family: 'narrative',
    note: '通往无穷尽房间的入口。目录贴在门边，提醒来者：越往里越难回头。',
  },
  {
    key: 'yt-w2023-15',
    workId: '63e3837fbf4e44a71a27834b',
    layout: { x: 91.5, z: 344, plot: 4.2, facing: 's' },
    facility: '封面陈列所',
    family: 'press',
    note: '这处陈列所只挂封面，不展开内容。它承认第一眼的吸引力也是一种诚实。',
  },
  {
    key: 'yt-w2023-16',
    workId: '63c02f294906dcddc28cea8f',
    layout: { x: -49, z: 374.5, plot: 3.8, facing: 'n' },
    facility: '志愿者登记处',
    family: 'guild',
    note: '一处安静的小楼，负责把愿意出力的人安排到合适的位置。镇上的公共事务多从这里开始。',
  },
  {
    key: 'yt-w2023-17',
    workId: '63de75b0bf4e44a71a26a92f',
    layout: { x: 37, z: 374.5, plot: 3.8, facing: 'n' },
    facility: '小说区公告亭',
    family: 'press',
    note: '亭上贴着专区规则。它标志着虚构写作在这里有了自己的街区。',
  },
  {
    key: 'yt-w2023-18',
    workId: '65294db54d12128c0f02fc00',
    layout: { x: 56, z: 346, plot: 3.8, facing: 'n' },
    facility: '乞讨者小屋',
    family: 'dwelling',
    note: '一间坦率承认自己窘迫的小屋。它的存在让镇上的人记得，热闹之外还有另一种处境。',
  },
];
