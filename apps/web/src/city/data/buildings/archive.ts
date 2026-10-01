// 建筑配置：archive
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "archive",
  num: "37",
  label: "档案馆",
  x: -21,
  z: -33,
  shape: "library",
  facade: "facade_board",
  icon: iconSvg(`<path d="M3 4h18v16H3z"/><path d="M7 4v16"/>`),
  content: {
    name: "档案馆",
    slogan: "过去不会消失，只是被收了起来。",
    dialog: ["厚重的木门后面是成排的铁柜，标签已经泛黄。", "每份档案都是城里发生过的事的记录。", "「要理解一座城为什么变成现在这样，得先看它做过什么。」"],
  },
});
