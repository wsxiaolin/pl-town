// 建筑配置：reverberate_wall（回音壁）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "reverberate_wall",
  num: "92",
  label: "回音壁",
  x: -24,
  z: -4,
  shape: "board",
  icon: iconSvg(`<path d="M4 5h16v11H4z"/><path d="M8 16v4M16 16v4"/>`),
  content: {
    name: "回音壁",
    slogan: "你说一句，我晚一点还你一句。",
    dialog: [
      "老城北坡巷底，一段弧形砖墙环出安静。",
      "墙心有一只信龛，顶上挂着四块铭牌。",
    ],
  },
});
