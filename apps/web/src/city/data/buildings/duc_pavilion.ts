// 建筑配置：duc_pavilion（立约亭）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "duc_pavilion",
  num: "76",
  label: "立约亭",
  x: -30,
  z: -4,
  shape: "pavilion",
  icon: iconSvg(`<path d="M4 20h16M6 20V9l6-5 6 5v11"/><path d="M10 20v-6h4v6"/>`),
  content: {
    name: "立约亭",
    slogan: "名字写对了，机器才认你。",
    dialog: [
      "六角浅砂岩亭子，十二根廊柱等角而立。",
      "亭顶那盏灯黑着，要会用它的语言才亮。",
    ],
  },
});
