// 建筑配置：beauty_mailbox（同题信箱）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "beauty_mailbox",
  num: "82",
  label: "同题信箱",
  x: 4,
  z: 19,
  shape: "kiosk",
  icon: iconSvg(`<path d="M4 20h16M6 20V10h12v10"/><path d="M4 10l8-5 8 5"/>`),
  content: {
    name: "同题信箱",
    slogan: "同名不同人。信会自己找到下一任。",
    dialog: [
      "几何圆冠树下立着一只奶油白信箱。",
      "圆窗里叠着几封折起的信。",
    ],
  },
});
