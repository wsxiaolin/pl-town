// 建筑配置：north_chat_plaza（星语北城 · 黑洞热门作品城市化）
// 原作：真·第一聊天室（黑洞讨论区最热 Top100 #5，@米米米米）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_chat_plaza",
  num: "53",
  label: "聊天广场",
  x: -15,
  z: -49.5,
  shape: "chat_plaza",  hasPlot: false,

  icon: iconSvg(`<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>`),
  content: {
    name: "聊天广场",
    slogan: "如题，没错，畅快地聊吧！",
    dialog: [
      "欢迎来到聊天广场——黑洞最大的水楼，「真·第一聊天室」的地上建筑。两万六千多条留言，就是两万六千多次想说话的念头。",
      "在这里没人要求你聊出什么名堂。聊鸽了、聊跑了题、聊到只剩表情包，都是聊天的一部分。",
      "「不是没有热度，是没有话题！」——所以广场永远敞着，话题由下一个人带来。",
      "小提醒：鸽叽与黑纸请另寻去处（原楼主原话，与本广场立场无关）。",
    ],
  },
  contentQuery: {
    title: "聊天广场 · 聊天室谱系",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "6111fbbd731a8e774c58d865",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
