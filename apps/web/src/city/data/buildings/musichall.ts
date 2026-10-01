// 建筑配置：musichall
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "musichall",
  num: "41",
  label: "音乐厅",
  x: -21,
  z: 33,
  shape: "pavilion",
  facade: "facade_screen",
  icon: iconSvg(`<path d="M9 18V5l12-2v13"/><circle cx="6" cy="6" r="3"/>`),
  content: {
    name: "音乐厅",
    slogan: "声音也能成为建筑。",
    dialog: ["穹顶下回荡着排练的旋律。", "「不需要听懂，只需要听。」"],
  },
});
