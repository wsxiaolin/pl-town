// 建筑配置：cityin_well（枯井）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "cityin_well",
  num: "86",
  label: "枯井",
  x: -14,
  z: -5,
  shape: "shaft",
  icon: iconSvg(`<ellipse cx="12" cy="7" rx="6" ry="2.5"/><path d="M6 7v10c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V7"/>`),
  content: {
    name: "枯井",
    slogan: "抱歉，我们属于这里，无法帮你离开。",
    dialog: [
      "图书馆背后的巷子尽头，一口爬满藤蔓的石井。",
      "井沿有一行几乎磨平的字。",
    ],
  },
});
