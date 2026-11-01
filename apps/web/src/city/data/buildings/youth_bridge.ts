// 建筑配置：youth_bridge（半句桥）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "youth_bridge",
  num: "89",
  label: "半句桥",
  x: 6,
  z: 27,
  shape: "board",
  icon: iconSvg(`<path d="M4 5h16v11H4z"/><path d="M8 16v4M16 16v4"/>`),
  content: {
    name: "半句桥",
    slogan: "旗子不需要答案。",
    dialog: [
      "桥从南岸起，止于河心。",
      "桥头挂着一面旗，风一吹就响。",
    ],
  },
});
