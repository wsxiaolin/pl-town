// 建筑配置：askway_booth（问路处）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "askway_booth",
  num: "93",
  label: "问路处",
  x: 26,
  z: -4,
  shape: "kiosk",
  icon: iconSvg(`<path d="M4 20h16M6 20V10h12v10"/><path d="M4 10l8-5 8 5"/>`),
  content: {
    name: "问路处",
    slogan: "问路请讲，两问自理。",
    dialog: [
      "教育街区环岛，五条街在这里交汇。",
      "老亭与新亭共墙而建，接缝处贴着转址条。",
    ],
  },
});
