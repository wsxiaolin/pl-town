// 建筑配置：birch_pavilion（赌约亭）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "birch_pavilion",
  num: "84",
  label: "赌约亭",
  x: -30,
  z: 6,
  shape: "pavilion",
  icon: iconSvg(`<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M10 20v-6h4v6"/>`),
  content: {
    name: "赌约亭",
    slogan: "输家搭亭，冠了赢家的名。",
    dialog: [
      "四柱木亭无墙无门，通体浅木色。",
      "海报上只有七个字：与白桦的绝命赌约。",
    ],
  },
});
