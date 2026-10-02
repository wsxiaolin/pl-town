// 建筑配置：north_night_kiosk（星语北城 · 黑洞热门作品城市化）
// 原作：不打烊贩卖店（黑洞讨论区最热 Top100 #65，@TransparentBubble）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_night_kiosk",
  num: "62",
  label: "不打烊贩卖店",
  x: 4,
  z: -59.5,
  shape: "night_kiosk",  plot: { tex: 'ground2', size: 4.2, color: 0xD6C8AC },

  icon: iconSvg(`<path d="M4 10h16v10H4z"/><path d="M6 10V7a6 6 0 0 1 12 0v3"/><path d="M12 15v2"/>`),
  content: {
    name: "不打烊贩卖店",
    slogan: "轻柔的晚风，泠泠的轻响。",
    dialog: [
      "「随着轻松愉悦的歌曲，你缓缓踏进了这家店的大门，那么恭喜你，欢迎来到不打烊贩卖店。」",
      "店长叫泠月。晚风拂过店外的树梢，门口的风铃泠泠地响——那串风铃真的挂在那里，你听。",
      "这里只在夜里亮灯，卖的东西不标价：一句晚安、一段没讲完的故事、一小罐勇气。",
      "不打烊是真的。凌晨三点路过，灯还亮着。",
    ],
  },
  contentQuery: {
    title: "不打烊贩卖店",
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
