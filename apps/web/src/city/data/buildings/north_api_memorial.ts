// 建筑配置：north_api_memorial（星语北城 · 黑洞热门作品城市化）
// 原作：物理实验室API事件纪念碑（黑洞讨论区最热 Top100 #1，@16号管理者）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_api_memorial",
  num: "59",
  label: "安全碑",
  x: -26,
  z: -59.5,
  shape: "monolith",  plot: { tex: 'ground5', size: 4.6, color: 0xD4D6DC },

  icon: iconSvg(`<rect x="7" y="3" width="10" height="18" rx="1"/><path d="M10 8h4M10 12h4M10 16h4"/>`),
  content: {
    name: "安全碑",
    slogan: "滥用 API 的人，被记在了碑上。",
    dialog: [
      "2026年5月，两位用户恶意使用 API 刷评论、刷支持、刷观看。这块碑立在北城，记的就是这件事。",
      "碑体是黑的，刻痕是蓝色的——像服务器日志的颜色。滥用API留下的痕迹，最后都变成了这里的刻度。",
      "碑文只有一句：本作品作为受害作品之一，用于展示作用。沉默，但有效。",
      "路过的时候慢一点。管理员们维护社区秩序的方式，有时候是一块碑。",
    ],
  },
  contentQuery: {
    title: "安全碑 · API 事件纪念",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: null,
    Tags: null,
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: "5ea1934c8116c49429d3e405",
    Special: null,
    From: null,
    Skip: 0,
    Take: 16,
    Days: 0,
    Sort: 1,
    ShowAnnouncement: false,
  },});
