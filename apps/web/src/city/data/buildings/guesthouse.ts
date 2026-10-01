// 建筑配置：guesthouse
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "guesthouse",
  num: "44",
  label: "客栈",
  x: 33,
  z: 21,
  shape: "pagoda",
  facade: "facade_kiosk",
  icon: iconSvg(`<path d="M3 21V8l9-5 9 5v13"/><path d="M9 21v-6h6v6"/>`),
  content: {
    name: "客栈",
    slogan: "远道而来的人先在这里落脚。",
    dialog: ["三层小楼，每层窗台上都放着一盏灯。", "「明天的事明天再说。今晚先歇着。」"],
  },
});
