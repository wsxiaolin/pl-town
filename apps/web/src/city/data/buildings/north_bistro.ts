// 建筑配置：north_bistro（星语北城 · 黑洞热门作品城市化）
// 原作：屑天尊的奇妙会员制餐厅（黑洞讨论区最热 Top100 #95，@屑米粥）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_bistro",
  num: "61",
  label: "会员制餐厅",
  x: -6,
  z: -59.5,
  shape: "bistro",  plot: { tex: 'ground4', size: 4.6, color: 0xC6B18C },

  icon: iconSvg(`<path d="M6 3v8a3 3 0 0 0 6 0V3"/><path d="M9 11v10"/><path d="M17 3c-1.5 1.5-2 3-2 5s.5 3 2 3 2-1 2-3-.5-3.5-2-5z"/><path d="M17 11v10"/>`),
  content: {
    name: "会员制餐厅",
    slogan: "店长时隔两年半又回来了。",
    dialog: [
      "「内个，店长时隔两年半又回来了。」——这家会员制餐厅的营业史，本身就是一部鸽子编年史。",
      "门口的留言墙贴满了历史留：新年快乐的、催更的、宣布自己也鸽了的。全都收着，一条没撕。",
      "会员制的规矩很简单：来过一次就是会员，鸽了也算。毕竟在鸽子协会的地界上，这家店的会员资格终身有效。",
      "今日特供是回忆——昨日繁华，今夕消逝，佐餐刚好。",
    ],
  },
  contentQuery: {
    title: "会员制餐厅 · 屑天尊",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "60c4052b6d5cfca210a44273",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
