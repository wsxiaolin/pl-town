// 建筑配置：human_greenhouse（未刊温室）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "human_greenhouse",
  num: "81",
  label: "未刊温室",
  x: -6,
  z: 19,
  shape: "greenhouse",
  icon: iconSvg(`<path d="M4 20V10l8-6 8 6v10"/><path d="M8 20v-6h8v6"/>`),
  content: {
    name: "未刊温室",
    slogan: "街对面管未写的。",
    dialog: [
      "玻璃温室里立着一面刻文墙和一架回帖。",
      "有些问题被投进墙里，很久以后才有回声。",
    ],
  },
});
