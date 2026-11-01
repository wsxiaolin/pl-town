// 建筑配置：weekly_news（星辉报社）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "weekly_news",
  num: "90",
  label: "星辉报社",
  x: -11,
  z: 21,
  shape: "factory",
  icon: iconSvg(`<path d="M4 20V9l5 3V9l5 3V9l6 4v7H4z"/><path d="M8 20v-3h2v3"/>`),
  content: {
    name: "星辉报社",
    slogan: "总要让这把火，再烧起来。",
    dialog: [
      "临街报亭、编辑部、印刷间连在一起。",
      "荣誉墙旁留着一张空桌。",
    ],
  },
});
