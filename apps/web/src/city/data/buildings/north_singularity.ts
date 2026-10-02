// 建筑配置：north_singularity（星语北城 · 黑洞热门作品城市化）
// 原作：人落入黑洞（黑洞讨论区最热 Top100 #98，@搞笑派--哈哈）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_singularity",
  num: "56",
  label: "奇点塔",
  x: -5.5,
  z: -49.5,
  shape: "singularity",  plot: { tex: 'ground5', size: 5.4, color: 0xB9BCC8 },

  icon: iconSvg(`<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5" fill="#3B6FE0"/><path d="M12 5a7 7 0 0 1 7 7"/>`),
  content: {
    name: "奇点塔",
    slogan: "连光都无法逃脱。",
    dialog: [
      "塔名奇点：黑洞是体积无限小、密度无限大的奇怪天体。在事件视界内，连光都无法逃脱。",
      "我们看不到黑洞本身，只能看到它周围发光的吸积盘——塔身那一圈金环就是。有些存在感，恰恰要靠环绕它的东西来证明。",
      "至于人落入黑洞会发生什么？塔里有整整一层的推演：潮汐力、时间膨胀、意大利面化……物理学家们也还在争论。",
      "放心，这座塔只收观光客，不收任何下坠物。",
    ],
  },
  contentQuery: {
    title: "奇点塔 · 人落入黑洞",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "5e9982670f884b871508d684",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
