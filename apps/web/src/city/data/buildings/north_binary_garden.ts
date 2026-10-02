// 建筑配置：north_binary_garden（星语北城 · 黑洞热门作品城市化）
// 原作：双星系统能有宜居行星有点难（黑洞讨论区最热 Top100 #90，@tyq）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_binary_garden",
  num: "57",
  label: "双星花园",
  x: 15,
  z: -49.5,
  shape: "binary_garden",  hasPlot: false,

  icon: iconSvg(`<circle cx="8" cy="14" r="4"/><circle cx="16" cy="10" r="2.5"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-20 12 12)"/>`),
  content: {
    name: "双星花园",
    slogan: "两颗恒星，一个质心。",
    dialog: [
      "双星花园的花坛是按双星系统排的：两颗恒星围绕共同质心旋转，花园的两座灯塔也围着中央花坛转。",
      "「本实验在宜居带内放置了100颗行星，最后剩下了几颗宜居的。」——双星系统里想安稳绕圈，比想象中难得多。",
      "但双星也是宇宙里最常见的组合之一。两束光互相绕着走了一辈子，也算一种浪漫的轨道力学。",
      "花坛边的那圈碎石带，就是被甩出宜居带的另外九十几颗。别踩。",
    ],
  },
  contentQuery: {
    title: "双星花园 · 双星系统",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "66bc220e6188c424cbe6e198",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
