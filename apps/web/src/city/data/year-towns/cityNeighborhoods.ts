// 年份城市日常生活建筑。坐标、名称、用途与临街朝向逐栋手写；
// 作品纪念设施位于内城，本目录补足外围街区与城市公共服务。
import { iconSvg, type BuildingConfig } from '../buildings/_types';
export interface NeighborhoodBuilding extends BuildingConfig {
  townId: 'island-2019' | 'island-2022' | 'island-2026';
  story: string;
}

const home = (id: string, townId: NeighborhoodBuilding['townId'], label: string, x: number, z: number, rotY: number, shape = 'school', story?: string): NeighborhoodBuilding => ({
  id, num: id.slice(-3).toUpperCase(), townId, label, x, z, rotY, shape,
  icon: iconSvg('<path d="M3 11l9-7 9 7M5 10v10h14V10M9 20v-6h6v6"/>'),
  scale: 1.25,
  story: story ?? `${label}的居民把日子过得缓慢而具体。窗边有晾晒的衣物，门前留着给邻居说话的椅子；这里的日常与内城展出的年代一样，都是城市的一部分。`,
});

const shop = (id: string, townId: NeighborhoodBuilding['townId'], label: string, x: number, z: number, rotY: number, shape = 'mall', story?: string): NeighborhoodBuilding => ({
  id, num: id.slice(-3).toUpperCase(), townId, label, x, z, rotY, shape,
  icon: iconSvg('<path d="M4 9h16l-1 11H5zM4 9l2-4h12l2 4M9 13h6"/>'),
  scale: 1.2,
  story: story ?? `${label}面朝街道开门。熟客来买今天的必需品，旅客在这里第一次闻到这座城的烟火气；打烊以后，门檐下仍留着一盏灯。`,
});

const civic = (id: string, townId: NeighborhoodBuilding['townId'], label: string, x: number, z: number, rotY: number, shape: string, story: string): NeighborhoodBuilding => ({
  id, num: id.slice(-3).toUpperCase(), townId, label, x, z, rotY, shape,
  icon: iconSvg('<path d="M4 10l8-6 8 6M6 10v10M18 10v10M12 10v10M3 20h18"/>'),
  scale: 1.35,
  story,
});

const N = Math.PI;
const NEIGHBORHOOD_DRAFTS: readonly NeighborhoodBuilding[] = [
  // 旧港北城：学院街背面是安静的联排住宅与公共服务。
  home('yt-op-n01', 'island-2022', '北堤一号院', -52, 184, N),
  home('yt-op-n02', 'island-2022', '北堤二号院', -39, 184, N),
  home('yt-op-n03', 'island-2022', '潮声托儿所', -2, 174, N, 'academy'),
  shop('yt-op-n04', 'island-2022', '北街面包房', 48, 210, N, 'tavern'),
  shop('yt-op-n05', 'island-2022', '海港杂货铺', 61, 210, N, 'market'),
  home('yt-op-n06', 'island-2022', '信风旅舍', 77, 184, N, 'pagoda'),
  home('yt-op-n07', 'island-2022', '东堤公寓', 92, 224, N, 'tower'),
  civic('yt-op-n08', 'island-2022', '旧港市民医院', -51, 236, 0, 'academy', '医院服务整座旧港。诊室面向学院街，后院留着供病人散步的树荫；夜里急诊入口的灯始终亮着。'),
  civic('yt-op-n09', 'island-2022', '南城消防站', -24, 236, 0, 'factory', '车库门朝北街打开，值班室随时能望见港口大道。它负责老城木屋、市场棚顶和码头仓库的平安。'),
  shop('yt-op-n10', 'island-2022', '晨光菜市', 49, 236, 0, 'market'),
  civic('yt-op-n11', 'island-2022', '旧港公共浴室', 54, 236, 0, 'bistro', '公共浴室是街坊交换消息的地方。热水房、长椅和更衣室围绕着一个小院，远来者也能在这里洗去旅途风尘。'),
  civic('yt-op-n12', 'island-2022', '港务档案馆', 82, 236, 0, 'library', '这里保存潮位表、船只登记册与旧城地图。它不陈列作品，只记录一座城市如何每天运转。'),

  // 旧港南城：住宅街墙之间安排商铺、学校与手工业。
  home('yt-op-s01', 'island-2022', '南堤长屋一', -57, 392, N),
  home('yt-op-s02', 'island-2022', '南堤长屋二', -27, 392, N),
  shop('yt-op-s03', 'island-2022', '海风鱼铺', -12, 352, N, 'restaurant'),
  shop('yt-op-s04', 'island-2022', '晚钟茶馆', 4, 352, N, 'tavern'),
  shop('yt-op-s05', 'island-2022', '旧港修鞋铺', 37, 352, N, 'kiosk'),
  home('yt-op-s06', 'island-2022', '紫荆里公寓', 52, 352, N, 'tower'),
  home('yt-op-s07', 'island-2022', '南堤长屋三', 68, 392, N),
  home('yt-op-s08', 'island-2022', '灯塔看守宿舍', 88, 352, N, 'pagoda'),
  civic('yt-op-s09', 'island-2022', '南港小学', -53, 404, 0, 'school', '操场朝南，上课铃能一直传到海堤。孩子们从历史街区走来，也把新的城市故事带回自己的家。'),
  shop('yt-op-s10', 'island-2022', '海盐咖啡屋', -34, 404, 0, 'bistro'),
  civic('yt-op-s11', 'island-2022', '南市社区礼堂', -17, 404, 0, 'pavilion', '礼堂用于居民议事、节日演出和雨天集市。城市的大小事务在这里被讨论，散会后门口总有人多聊一会儿。'),
  shop('yt-op-s12', 'island-2022', '南港洗衣房', 2, 404, 0, 'kiosk'),
  civic('yt-op-s13', 'island-2022', '绳结与修船工坊', 30, 404, 0, 'factory', '工匠在门前修桨、补帆、打绳结。港口的体力活和手艺在这里延续，作品与城市生活共用同一片海岸。'),
  shop('yt-op-s14', 'island-2022', '夜市唱片行', 48, 404, 0, 'market'),
  home('yt-op-s15', 'island-2022', '望海旅店', 58, 394, 0, 'pagoda'),
  civic('yt-op-end', 'island-2022', '旧港岁月终章馆', 20, 417, N, 'planetarium', '旅程在城南海潮前抵达终章。馆内把八个年份连成一条时间长廊，最后一扇门面向灯火依旧的城区：纪念的终点不是封存，而是回到仍在继续的日常。'),

  // 星港北城：科研、教育、酒店和市政服务围合站前新区。
  civic('yt-sp-n01', 'island-2026', '星港城市博物馆', -286, 184, N, 'library', '博物馆以模型讲述星港从荒滩到城市的建设史。展厅尽头保留一片真实海沙，提醒来访者这里曾经的模样。'),
  shop('yt-sp-n02', 'island-2026', '天幕便利店', -270, 184, N, 'night_kiosk'),
  home('yt-sp-n03', 'island-2026', '科研人才公寓', -244, 184, N, 'tower'),
  civic('yt-sp-n04', 'island-2026', '星轨研究院', -240, 184, N, 'planetarium', '研究院面向未来的城市交通与能源。穹顶下是开放讲堂，沿街橱窗展示正在运行的星轨模型。'),
  shop('yt-sp-n05', 'island-2026', '极光数码店', -190, 184, N),
  shop('yt-sp-n06', 'island-2026', '星云旅社', -174, 184, N, 'pagoda'),
  home('yt-sp-n07', 'island-2026', '东环观景公寓', -158, 184, N, 'tower'),
  civic('yt-sp-n08', 'island-2026', '星港市政厅', -140, 184, N, 'bank', '市政厅协调港区、住宅与公共空间的运行。大厅有当天开放的施工图纸，居民可以看到下一条街将如何生长。'),
  home('yt-sp-n09', 'island-2026', '西环花园住宅', -289, 196, 0),
  civic('yt-sp-n10', 'island-2026', '天幕图书馆', -270, 196, 0, 'library', '图书馆把阅览桌放在巨大窗面旁。这里的书关于科学，也关于远方；闭馆后仍有人坐在台阶上读完最后一页。'),
  civic('yt-sp-n11', 'island-2026', '星港能源中心', -241, 196, 0, 'factory', '能源中心为街区与磁悬线路供电。透光的设备廊让基础设施成为城市景观的一部分。'),
  shop('yt-sp-n12', 'island-2026', '轨道餐厅', -208.5, 196, 0, 'restaurant'),
  civic('yt-sp-n13', 'island-2026', '远航会展中心', -174, 220, 0, 'pavilion', '会展中心承接新品发布、社团集会与城市庆典。没有活动时，大台阶也是居民看海和等人的地方。'),
  home('yt-sp-n14', 'island-2026', '东站服务公寓', -146, 196, 0, 'tower'),

  // 星港南城：夜市、学校、住宅、文化与港湾终章。
  home('yt-sp-s01', 'island-2026', '长风花园一', -291, 354, N),
  home('yt-sp-s02', 'island-2026', '长风花园二', -262, 354, N),
  shop('yt-sp-s03', 'island-2026', '月面甜品店', -244, 348, N, 'bistro'),
  shop('yt-sp-s04', 'island-2026', '夜航书局', -229, 348, N, 'market'),
  shop('yt-sp-s05', 'island-2026', '星尘照相馆', -201, 348, N, 'kiosk'),
  home('yt-sp-s06', 'island-2026', '银湾公寓', -185, 348, N, 'tower'),
  home('yt-sp-s07', 'island-2026', '远航宿舍', -168, 354, N),
  civic('yt-sp-s08', 'island-2026', '星港音乐厅', -143, 348, N, 'pavilion', '音乐厅以港口潮汐为演出开场。舞台面向内庭，街道一侧则能听见排练时漏出的零星乐句。'),
  civic('yt-sp-s09', 'island-2026', '长风实验学校', -288, 361, 0, 'campus', '学校的屋顶是天文观测台，底层是面向社区开放的运动场。科学与生活在这里共享同一座院落。'),
  shop('yt-sp-s10', 'island-2026', '海风花店', -268, 361, 0, 'greenhouse'),
  civic('yt-sp-s11', 'island-2026', '星港青少年中心', -239, 361, 0, 'academy', '这里有社团教室、排练房和一张永远有人使用的乒乓球桌。城市居民在这里认识课堂之外的朋友。'),
  shop('yt-sp-s12', 'island-2026', '银湾深夜食堂', -231, 361, 0, 'tavern'),
  civic('yt-sp-s13', 'island-2026', '未来工坊', -198, 361, 0, 'factory', '居民可以在这里修理家具、制作模型、学习使用工具。未来并非一座橱窗，而是许多人亲手完成的小东西。'),
  shop('yt-sp-s14', 'island-2026', '远航礼品商店', -179, 361, 0, 'market'),
  home('yt-sp-s15', 'island-2026', '海际酒店', -157, 361, 0, 'pagoda'),
  civic('yt-sp-end', 'island-2026', '星港明日终章塔', -215, 380, N, 'television_tower', '终章塔是旅程的最后目的地。登上观景层能看见内城、外街和来往列车；塔顶每天为下一年预留一盏尚未命名的灯，城市的结局因此始终通向明天。'),

  // 起源村村舍：环村心四座小屋，各面朝村心（rotY 同 FACING_ROTATION：e=+π/2、w=−π/2），
  // story 逐栋手写村史，补足 2019「两栋屋」之外的日常生活。
  home('yt-ov-h01', 'island-2019', '第一炉窑', 134, 204, Math.PI / 2, 'school', '村子的第一炉窑火烧在这里。砖取本地的泥，火由守灯人帮着看；窑口朝东，为的是让最早出窑的那批砖，先晒到荒原上的太阳。'),
  home('yt-ov-h02', 'island-2019', '守灯人居', 141, 221, Math.PI / 2, 'school', '守灯人的家。屋里那盏灯比任何一间房都起得早：先点灯，再挨家挨户问一句「今天还好吗」——这是起源村延续至今的晨课。'),
  home('yt-ov-h03', 'island-2019', '晒网人家', 160, 218, -Math.PI / 2, 'school', '村东的渔户把网晒在门前。南湾的鱼养活了最早的一批村民，竹架上那张补了又补的第一张网至今没收起来——拆不得，也不必拆。'),
  shop('yt-ov-h04', 'island-2019', '第一碗热汤', 165, 204, -Math.PI / 2, 'tavern', '荒原上的第一碗热汤在这里端出来。规矩很简单：远来的人先坐下喝汤，再谈要去哪儿——起源村的待客之道，从这一碗开始。'),
];

// 最终绝对坐标：星港城区相对草案整体西移 70、南移 6，旧港内城保持原位；
// 起源村村舍草案即最终坐标（零偏移）。南端生活排屋与终章馆逐栋保留岸线退距。
export const YEAR_TOWN_NEIGHBORHOODS: readonly NeighborhoodBuilding[] = NEIGHBORHOOD_DRAFTS.map((building) => ({
  ...building,
  x: building.x + (building.townId === 'island-2026' ? -70 : 0),
  z: building.z + (building.townId === 'island-2019' ? 0 : building.townId === 'island-2026' ? 6 : 40)
    - (building.townId === 'island-2022' && building.id.startsWith('yt-op-s') ? 38 : 0)
    - (building.id === 'yt-op-end' ? 40 : 0)
    - (building.id === 'yt-sp-end' ? 6 : 0),
}));

export const YEAR_TOWN_NEIGHBORHOOD_CONTENT = Object.fromEntries(
  YEAR_TOWN_NEIGHBORHOODS.map((building) => [building.id, {
    name: building.label ?? building.id,
    slogan: building.townId === 'island-2019'
      ? '起源村 · 村舍'
      : building.townId === 'island-2022' ? '旧港城 · 生活街区' : '星港城 · 明日街区',
    dialog: [building.story],
  }]),
);
