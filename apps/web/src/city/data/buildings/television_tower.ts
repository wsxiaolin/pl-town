// 建筑配置：television_tower
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "television_tower",
  num: "50",
  label: "电视塔",
  x: 32,
  z: -8,
  shape: "television_tower",
  icon: iconSvg(`<path d="M12 3v18"/><path d="M8 21h8"/><path d="M7 9h10"/><path d="M5 5c2 2 2 5 0 7"/><path d="M19 5c-2 2-2 5 0 7"/>`),
  content: {
    name: "电视塔",
    slogan: "把城市的声音送往更远处。",
    dialog: ["观景层的玻璃映着街区与道路。", "天线在风里轻轻转动，把每一段讯号送向远方。"],
  },
});
