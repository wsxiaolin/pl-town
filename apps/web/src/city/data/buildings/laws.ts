// 建筑配置：laws
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "laws",
  num: "05",
  label: "城的法则",
  x: 4,
  z: 3,
  shape: "pavilion",
  icon: iconSvg(`<path d="M12 3v18"/><path d="M6 8h12"/><path d="M6 8l-2 6h4z"/><path d="M18 8l-2 6h4z"/>`),
  content: {
    name: "城的法则",
    slogan: "你违反的每一条法则，都会化作你不甘的泪水。",
    dialog: ["一卷羊皮纸摊在石台上，字迹工整得近乎冰冷。", "谨记，认真思考管理人员的每一次警告，他们对你的生活有很大影响。", "你要做一个好公民。", "「法则不是束缚，是这座城还在运转的理由。」"],
  },
});
