// 建筑配置：singlestep_room（单步机房）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "singlestep_room",
  num: "74",
  label: "单步机房",
  x: 20,
  z: 5,
  shape: "factory",
  icon: iconSvg(`<path d="M4 20V9l5 3V9l5 3V9l6 4v7H4z"/><path d="M8 20v-3h2v3"/>`),
  content: {
    name: "单步机房",
    slogan: "机器比人慢，也比人诚实。",
    dialog: [
      "浅色单层机房，门楣上的「非」字可以按。",
      "一拍取指，一拍执行，一拍步进，一拍停机。",
    ],
  },
});
