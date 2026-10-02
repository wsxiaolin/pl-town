// 建筑配置：north_backrooms_door（星语北城 · 黑洞热门作品城市化）
// 原作：后室的奇妙冒险X目录（黑洞讨论区最热 Top100 #87，@灭神之天）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_backrooms_door",
  num: "64",
  label: "后室之门",
  x: 18,
  z: -59.5,
  shape: "backrooms_door",  plot: { tex: 'ground4', size: 4.0, color: 0xC8BC96 },

  icon: iconSvg(`<path d="M5 3v18h14V3"/><path d="M9 21v-7h6v7"/><circle cx="12" cy="12" r="1.5" fill="#3B6FE0"/>`),
  content: {
    name: "后室之门",
    slogan: "在前厅之外，超越现实之中。",
    dialog: [
      "一扇独立站在草地上的门。门后不是北城，是「后室」。",
      "「所谓之后室，在前厅之外，超越现实之中，无数可能或不可能。请不要质疑，因为这是属于后室的奇妙冒险。」",
      "推开它会怎样？目录持续更新中——目前记载的冒险者都去了更深处，暂时没人回来写完结篇。",
      "门口的灯有点老式嗡鸣声。那是作者在装修时的彩蛋，或者不是。别盯着看太久。",
    ],
  },
  contentQuery: {
    title: "后室之门 · 奇妙冒险",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "63ea4191fd0015ad302ea261",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
