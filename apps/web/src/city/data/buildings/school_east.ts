// 建筑配置：school_east
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "school_east",
  num: "27",
  label: "东区小学",
  x: 31.5,
  z: -15.25,
  shape: "school",
  icon: iconSvg(`<path d="M3 21h18"/><path d="M6 21V10l6-5 6 5v11"/><path d="M9 21v-5h6v5"/><path d="M4 10l8-5 8 5"/>`),
  content: {
    name: "东区小学",
    slogan: "操场上有种永远不变的笑声。",
    dialog: ["铃声刚响过，孩子们从教室里涌出来，像被打翻的彩色弹珠。", "旗杆上的旗被风吹得笔直，沙坑里留着上午的脚印。", "「教育不是把城填满，是给下一座城留出空地。」"],
  },
});
