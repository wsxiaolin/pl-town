// 建筑配置：catcafe
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "catcafe",
  num: "08",
  label: "猫咖馆",
  x: 9,
  z: 3,
  shape: "skyscraper",
  icon: iconSvg(`<path d="M6 8V5l3 2"/><path d="M18 8V5l-3 2"/><path d="M5 10c0-2 2-3 7-3s7 1 7 3v5c0 3-3 5-7 5s-7-2-7-5z"/>`),
  content: {
    name: "物实猫咖馆",
    slogan: "闲暇时光来撸猫也不错。",
    dialog: [
      "一栋高得看不到顶的楼，门牌上画着一只打哈欠的猫。",
      "趁着三月的暖阳，和着微风听听风铃吧。",
      "不过，这可是高达 15000 多层的楼哦。",
      "还有——小心军火！",
      "「猫在窗台上眯着眼，像是已经在这里等了你很久。」",
    ],
  },
});
