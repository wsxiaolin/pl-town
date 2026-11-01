// 建筑配置：zilan_shrine（紫兰丛祠）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "zilan_shrine",
  num: "83",
  label: "紫兰丛祠",
  x: -34,
  z: -59.5,
  shape: "pavilion",
  icon: iconSvg(`<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M10 20v-6h4v6"/>`),
  content: {
    name: "紫兰丛祠",
    slogan: "历史不等答案，历史等会背的人。",
    dialog: [
      "碑后三步，一扇从这边推得开的木门。",
      "门楣上刻着：天下苦物理乃久矣。",
    ],
  },
});
