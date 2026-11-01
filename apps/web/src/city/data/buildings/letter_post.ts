// 建筑配置：letter_post（慢递邮亭）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "letter_post",
  num: "80",
  label: "慢递邮亭",
  x: -38,
  z: 10,
  shape: "kiosk",
  icon: iconSvg(`<path d="M4 20h16M6 20V10h12v10"/><path d="M4 10l8-5 8 5"/>`),
  content: {
    name: "慢递邮亭",
    slogan: "信会自己找到下一任。",
    dialog: [
      "坡上的小邮亭正对河谷风口。",
      "把信放进去，什么时候到，不归看亭人管。",
    ],
  },
});
