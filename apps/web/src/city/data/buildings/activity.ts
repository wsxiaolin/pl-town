// 建筑配置：activity
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "activity",
  num: "01",
  label: "活动区",
  x: 4,
  z: -9,
  shape: "bank",
  icon: iconSvg(`<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>`),
  content: {
    name: "活动区",
    slogan: "在这里领取你的货币吧。",
    dialog: [
      "钱袋落在柜台上，发出一声闷响。",
      "\"在这里想要生存，没钱可不行。\"柜台后面的人头也没抬，\"必要的时候买些东西，以及……贿赂。\"",
      "你会有越来越多的追随者，没钱给他们可不行。",
      "「马内的力量，还是大的。」",
      "你不会以为我们真做了这个功能吧",
    ],
  },
});
