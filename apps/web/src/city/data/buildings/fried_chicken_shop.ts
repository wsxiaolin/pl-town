// 建筑配置：fried_chicken_shop
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "fried_chicken_shop",
  num: "51",
  label: "炸鸡店",
  x: 28,
  z: 2,
  shape: "fried_chicken_shop",
  icon: iconSvg(`<path d="M4 20V9h16v11"/><path d="M3 9h18"/><path d="M6 5h12v4"/><path d="M9 14h6"/>`),
  content: {
    name: "炸鸡店",
    slogan: "酥脆的香气从街角一路飘来。",
    dialog: ["橱窗后的保温灯把每一块炸鸡照得金黄。", "店员把纸袋折好，递出一份刚出锅的热气。"],
  },
});
