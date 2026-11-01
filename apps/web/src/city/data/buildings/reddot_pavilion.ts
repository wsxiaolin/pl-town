// 建筑配置：reddot_pavilion（红点亭）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "reddot_pavilion",
  num: "73",
  label: "红点亭",
  x: 17,
  z: -4,
  shape: "pavilion",
  icon: iconSvg(`<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M10 20v-6h4v6"/>`),
  content: {
    name: "红点亭",
    slogan: "半秒之后，地图换成新的。",
    dialog: [
      "屋顶是一面 4×4 的红点天窗，白天也亮着微光。",
      "门楣上三个 R 刻得各不相同，点了只亮，不解释。",
    ],
  },
});
