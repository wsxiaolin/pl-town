// 建筑配置：blackhole
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "blackhole",
  num: "04",
  label: "黑洞半城",
  x: -9,
  z: -3,
  shape: "darktower",
  icon: iconSvg(`<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="2" fill="#3B6FE0"/>`),
  content: {
    name: "黑洞半城",
    slogan: "这里包容一切。",
    dialog: ["正如名字所说的，这里包容一切。你会找到朋友，也会发现……黑暗。", "这里的人鱼龙混杂，尽量避免和坏人接触。什么是坏人？那些被\"封禁\"的人，他们的\"居民权限\"失效了——有些只是暂时的，有些是永远的。", "不过，我们允许你展示自己的存在，你可以在半城发布你的作品。在这个半城，你可以做作家、数学家、历史学家……某些方面，它比技术半城更多元。", "「无论在哪一个半城，那些发布'水作品'极多的人，都被称为'伪用户'。」"],
  },
  contentQuery: {
    title: "黑洞半城",
    Category: "Discussion",
    Languages: [],
    ExcludeLanguages: ["小作品"],
    Tags: null,
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
    ShowAnnouncement: true,
  },
});
