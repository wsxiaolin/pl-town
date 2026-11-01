// 起源村外城/村舍建筑（从 cityNeighborhoods.ts 按岛拆分；落位手写唯一事实源）。
import { N, home, civic, shop, type NeighborhoodBuilding } from './cityNeighborhoodsKit';

export const VILLAGE_DRAFTS: readonly NeighborhoodBuilding[] = [
  home('yt-ov-h01', 'island-2019', '第一炉窑', 134, 204, Math.PI / 2, 'school', '村子的第一炉窑火烧在这里。砖取本地的泥，火由守灯人帮着看；窑口朝东，为的是让最早出窑的那批砖，先晒到荒原上的太阳。'),
  home('yt-ov-h02', 'island-2019', '守灯人居', 141, 221, Math.PI / 2, 'school', '守灯人的家。屋里那盏灯比任何一间房都起得早：先点灯，再挨家挨户问一句「今天还好吗」——这是起源村延续至今的晨课。'),
  home('yt-ov-h03', 'island-2019', '晒网人家', 160, 218, -Math.PI / 2, 'school', '村东的渔户把网晒在门前。南湾的鱼养活了最早的一批村民，竹架上那张补了又补的第一张网至今没收起来——拆不得，也不必拆。'),
  shop('yt-ov-h04', 'island-2019', '第一碗热汤', 165, 204, -Math.PI / 2, 'tavern', '荒原上的第一碗热汤在这里端出来。规矩很简单：远来的人先坐下喝汤，再谈要去哪儿——起源村的待客之道，从这一碗开始。'),
];
