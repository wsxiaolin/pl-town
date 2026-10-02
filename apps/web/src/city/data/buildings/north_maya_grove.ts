// 建筑配置：north_maya_grove（星语北城 · 黑洞热门作品城市化）
// 原作：玛雅文明--神秘而发达的文明（黑洞讨论区最热 Top100 #99，@gooooose）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_maya_grove",
  num: "58",
  label: "玛雅台地",
  x: 25,
  z: -49.5,
  shape: "ziggurat",  plot: { tex: 'ground2', size: 6.4, color: 0xD9CDA0 },

  icon: iconSvg(`<path d="M12 3 3 8v13h18V8z"/><path d="M7 21v-6M12 21v-9M17 21v-6"/>`),
  content: {
    name: "玛雅台地",
    slogan: "金字塔会记住消失的文明。",
    dialog: [
      "台地按玛雅金字塔的形制修了三层——从公元两千多年前起步，在南北朝的时代进入黄金期。",
      "公元十世纪，它像楼兰一样突然消失了，只留下金字塔和没能破译的文字。",
      "「请支持原作者 @白桦」——这座台地是转建的，就像玛雅文明的历史本身，一半是石头，一半是转述。",
      "天文学、数学、建筑，他们在没有金属工具的年代把这三样都点满了。历史学爱好者常年在台阶上开讲座。",
    ],
  },
  contentQuery: {
    title: "玛雅台地 · 文明史",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "60e933da4ad4cae147f48a66",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
