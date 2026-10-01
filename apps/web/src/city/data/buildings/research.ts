// 建筑配置：research
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "research",
  num: "19",
  label: "研究院",
  x: 15,
  z: -9,
  shape: "factory",
  icon: iconSvg(`<path d="M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/><path d="M8 3h8"/><path d="M8 15h8"/>`),
  content: {
    name: "研究院",
    slogan: "把未知拆开，再小心地装回去。",
    dialog: ["白色塔楼里传来低频的嗡鸣，像某种机器正在思考。", "研究员们不急着给答案，他们先把问题写得更清楚。", "「别害怕复杂。复杂只是还没有被命名。」"],
  },
});
