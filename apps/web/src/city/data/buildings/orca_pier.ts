// 建筑配置：orca_pier（深夜鲸栈）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "orca_pier",
  num: "79",
  label: "深夜鲸栈",
  x: -39,
  z: 29,
  shape: "kiosk",
  icon: iconSvg(`<path d="M4 20h16M6 20V10h12v10"/><path d="M4 10l8-5 8 5"/>`),
  content: {
    name: "深夜鲸栈",
    slogan: "本鲸在。",
    dialog: [
      "栈桥尽头有浮标和潮汐计，黑板写着今天的浪。",
      "公共屏还亮着，滚过去一行行没头没尾的话。",
    ],
  },
});
