// 建筑配置：conservatory
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "conservatory",
  num: "42",
  label: "温室",
  x: 21,
  z: 33,
  shape: "greenhouse",
  facade: "facade_campus",
  icon: iconSvg(`<path d="M12 2L2 12h3v8h14v-8h3z"/>`),
  content: {
    name: "温室",
    slogan: "在最暖的地方种最嫩的芽。",
    dialog: ["玻璃房里温度恒定，种着城外不易存活的植物。", "「给条件足够的时间，一切都会发芽。」"],
  },
});
