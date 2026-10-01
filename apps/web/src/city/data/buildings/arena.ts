// 建筑配置：arena
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "arena",
  num: "43",
  label: "竞技场",
  x: -33,
  z: 21,
  shape: "factory",
  facade: "facade_clocktower",
  icon: iconSvg(`<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M3 12h18"/>`),
  content: {
    name: "竞技场",
    slogan: "规则之内，尽情较量。",
    dialog: ["圆形场地中央画着白线，四周的看台还是空的。", "「赢得漂亮，输得坦然。」"],
  },
});
