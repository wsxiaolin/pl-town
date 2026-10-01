// 建筑配置：qipai_hall
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "qipai_hall",
  num: "48",
  label: "棋气派",
  x: 30,
  z: 30,
  shape: "qipai",
  icon: iconSvg(`<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>`),
  content: {
    name: "棋气派",
    slogan: "落子无悔，入局即生。",
    dialog: ["门口站着两尊巨型棋子雕像——一王一后。", "地面铺着黑白棋盘格，每一步都踩在一格命运上。", "「棋气派下的不是棋，是气。气断了，棋就散了。」"],
  },
});
