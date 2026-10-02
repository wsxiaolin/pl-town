// 建筑配置：north_pigeon_square（星语北城 · 黑洞热门作品城市化）
// 原作：鸽子协会聊天室（黑洞讨论区最热 Top100 #6，@晴栀Starry）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_pigeon_square",
  num: "54",
  label: "鸽子广场",
  x: -26,
  z: -49.5,
  shape: "pigeon_square",  hasPlot: false,

  icon: iconSvg(`<path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/>`),
  content: {
    name: "鸽子广场",
    slogan: "欢迎来到鸽咖！",
    dialog: [
      "咕咕。欢迎来到鸽子协会——继猫咖之后，黑洞最热闹的咕咕集散地。",
      "这里的常客都有个共同点：说好的更新，鸽了；说好的告别，又回来了。协会对此表示充分理解。",
      "门口的栖架和挡雨棚都是为鸽子们准备的。全球分部（Global Division）正在筹备中，欢迎多去支持。",
      "临走前记得在留言簿上咕一声——两万五千多条咕，一条都没删。",
    ],
  },
  contentQuery: {
    title: "鸽子广场 · 鸽子协会",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "62e514ffb695b0de04bef407",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
