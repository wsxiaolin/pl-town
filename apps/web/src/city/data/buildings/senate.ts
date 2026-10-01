// 建筑配置：senate
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "senate",
  num: "21",
  label: "参议院",
  x: -15,
  z: 9,
  shape: "temple",
  icon: iconSvg(`<circle cx="12" cy="12" r="8"/><path d="M12 4v16"/><path d="M4 12h16"/>`),
  content: {
    name: "参议院",
    slogan: "慢一点，才能决定更重的事。",
    dialog: ["圆顶下的声音被压低，像每句话都要先经过墙壁审查。", "这里不处理喧哗，只处理喧哗之后还剩下的问题。", "「决定不是结束，是责任开始的地方。」"],
  },
  contentQuery: {
    title: "参议院",
    Category: "Experiment",
    Languages: [],
    ExcludeLanguages: null,
    Tags: ["投票"],
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
    Sort: 1,
    ShowAnnouncement: false,
  },
});
