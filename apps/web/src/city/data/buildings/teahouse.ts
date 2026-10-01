// 建筑配置：teahouse
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "teahouse",
  num: "25",
  label: "茶馆",
  x: 15,
  z: 15,
  shape: "pagoda",
  icon: iconSvg(`<path d="M5 10h12v3a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M17 11h1a2 2 0 0 1 0 4h-1"/><path d="M8 6c0-1 1-1 1-2"/><path d="M12 6c0-1 1-1 1-2"/>`),
  content: {
    name: "茶馆",
    slogan: "暂时坐下，也是一种前进。",
    dialog: ["茶香从窗缝里慢慢散出来。", "「有些答案不会在奔跑时出现。坐一会儿。」"],
  },
});
