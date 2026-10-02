// 建筑配置：north_worry_store（星语北城 · 黑洞热门作品城市化）
// 原作：解忧杂货店(解忧咨询室)（黑洞讨论区最热 Top100 #40，@生巧）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_worry_store",
  num: "60",
  label: "解忧杂货店",
  x: -14,
  z: -59.5,
  shape: "worry_store",  plot: { tex: 'ground4', size: 4.4, color: 0xCFC3A4 },

  icon: iconSvg(`<path d="M3 9l1-5h16l1 5"/><path d="M4 9v11h16V9"/><path d="M10 20v-6h4v6"/>`),
  content: {
    name: "解忧杂货店",
    slogan: "把烦恼写成信，投进来。",
    dialog: [
      "这里是解忧杂货店，黑洞区营业最久的咨询室之一。公告栏上贴满了里程碑：破五千浏览、破三千留言、成立两周年。",
      "烦恼写下来投进卷帘门上的信口就行。回信不一定快，但一定认真——店主两年来一直在回。",
      "「是物实的新人吗？用导航来快速了解物理实验室的规则吧！」杂货店还兼着新人的引路牌。",
      "小说可以发布辣，详情请见小说条例——好消息也要挂在门口，让路过的人高兴一下。",
    ],
  },
  contentQuery: {
    title: "解忧杂货店 · 咨询室",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "5e44c1e883d247292cc8b749",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
