// 建筑配置：fukushima_reactor（新闻反应堆）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "fukushima_reactor",
  num: "87",
  label: "新闻反应堆",
  x: 2,
  z: -41,
  shape: "factory",
  icon: iconSvg(`<path d="M4 20V9l5 3V9l5 3V9l6 4v7H4z"/><path d="M8 20v-3h2v3"/>`),
  content: {
    name: "新闻反应堆",
    slogan: "先看数据，再下判断。",
    dialog: [
      "外墙是一整面可读的数据墙。",
      "问题被记录下来，答案仍待定。",
    ],
  },
});
