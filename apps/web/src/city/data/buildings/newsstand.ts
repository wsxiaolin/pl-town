// 建筑配置：newsstand
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "newsstand",
  num: "17",
  label: "报摊",
  x: -9,
  z: -15,
  shape: "market",
  icon: iconSvg(`<path d="M4 7h16v11H4z"/><path d="M4 7l2-3h12l2 3"/><path d="M8 11h4"/><path d="M8 14h8"/>`),
  content: {
    name: "报摊",
    slogan: "消息比路灯亮得更早。",
    dialog: ["报纸叠在木箱上，墨迹还没完全干。", "摊主说今天的头条换了三次，因为这座城总有人突然出现，也总有人突然消失。", "「拿一份吧。知道发生了什么，至少能少走一点弯路。」"],
  },
});
