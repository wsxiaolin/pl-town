// 建筑配置：north_stellar_hall（星语北城 · 黑洞热门作品城市化）
// 原作：恒星的一生（黑洞讨论区最热 Top100 #51，@复兴物实）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_stellar_hall",
  num: "55",
  label: "恒星会堂",
  x: 5.5,
  z: -49.5,
  shape: "planetarium",  plot: { tex: 'ground4', size: 6.2, color: 0xD8CCB0 },

  icon: iconSvg(`<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>`),
  content: {
    name: "恒星会堂",
    slogan: "始于星尘，归于星尘。",
    dialog: [
      "这里是恒星会堂，陈列着一颗恒星完整的一生：从比真空稠密几千倍的星云，到主序星的漫长燃烧，到红巨星的膨胀，最后收拢成白矮星，或者在一场超新星里把自己还给宇宙。",
      "会堂的穹顶按恒星演化排了七个环，从内到外走一圈，就是走完一亿年。",
      "「每一个星云都有一处物质密度最大的地方，这个地方引力也最大。」人也一样——你会回到对你引力最大的地方。",
      "北城叫星语，就是从这里来的：恒星燃烧的每一步，都在对宇宙说话。",
    ],
  },
  contentQuery: {
    title: "恒星会堂 · 恒星的一生",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "5f11a9707f70f6e3527fb4ae",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
