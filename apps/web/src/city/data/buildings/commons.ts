// 建筑配置：commons
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "commons",
  num: "20",
  label: "众议院",
  x: -15,
  z: 3,
  shape: "temple",
  icon: iconSvg(`<path d="M3 10l9-6 9 6"/><path d="M5 10h14"/><path d="M7 10v8"/><path d="M12 10v8"/><path d="M17 10v8"/><path d="M4 18h16"/>`),
  content: {
    name: "众议院",
    slogan: "议事的厅堂，也是争论的起点。",
    dialog: ["圆形大厅里摆着弧形的座位。", "「多数不代表正确，但沉默一定不代表同意。」"],
  },
});
