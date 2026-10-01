// 建筑配置：knowledgebaseD
// ── 外环扩展建筑 ──
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "knowledgebaseD",
  num: "31",
  label: "黑洞知识库",
  x: -33,
  z: -33,
  shape: "library",
  icon: iconSvg(`<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M8 4v16"/>`),
  // 原统一「知识库」建筑的共用对话；46f7a4e 拆分改名时遗漏，这里按各自名字补回（文案逐字保留）。
  content: {
    name: "黑洞知识库",
    slogan: "所有被保存的东西，都在这里继续发光。",
    dialog: [
      "墙面像索引一样延伸，抽屉里收着旧讨论、旧作品。",
      "「先查，再问。能留下来的东西，总会帮助下一个人。」",
    ],
  },
  contentQuery: {
    title: "黑洞知识库",
    Category: "Discussion",
    Languages: ["Chinese"],
    ExcludeLanguages: null,
    Tags: ["知识库"],
    ExcludeTags: null,
    ModelTags: null,
    ModelID: null,
    ParentID: null,
    UserID: null,
    Special: null,
    From: null,
    Skip: 0,
    Take: 24,
    Days: 0,
    Sort: 0,
    ShowAnnouncement: false,
  },
});
