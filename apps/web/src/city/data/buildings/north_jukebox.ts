// 建筑配置：north_jukebox（星语北城 · 黑洞热门作品城市化）
// 原作：Never Gonna Give You Up - Rick Astley（黑洞讨论区最热 Top100 #11，@你被骗了）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_jukebox",
  num: "63",
  label: "点唱机",
  x: 11,
  z: -59.5,
  shape: "jukebox",  plot: { tex: 'ground5', size: 4.0, color: 0xD8D3D0 },

  icon: iconSvg(`<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6v4H9z"/><path d="M8 16h.01M12 16h.01M16 16h.01"/>`),
  content: {
    name: "点唱机",
    slogan: "You know the rules and so do I.",
    dialog: [
      "这台点唱机永远只放一首歌。哪首？投一枚硬币你就知道了。",
      "「We're no strangers to love. You know the rules and so do I.」——点唱机的玻璃罩上刻着这句，像一句陷阱预告。",
      "它已经在黑洞骗了四万四千次播放、四百四十五颗星。被骗的人会给它点赞，这大概是互联网最温柔的默契。",
      "再投一枚硬币？Never gonna give you up, never gonna let you down.",
    ],
  },
  contentQuery: {
    title: "点唱机 · Rickroll",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "6119eb22b713e1101d216570",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
