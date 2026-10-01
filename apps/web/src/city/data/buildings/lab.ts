// 建筑配置：lab
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "lab",
  num: "23",
  label: "实验楼",
  x: 15,
  z: 3,
  shape: "greenhouse",
  icon: iconSvg(`<path d="M9 3h6"/><path d="M10 3v5l-4 9a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-9V3"/><path d="M8 16h8"/>`),
  content: {
    name: "实验楼",
    slogan: "试错是这座城的燃料。",
    dialog: ["玻璃门后是整齐的仪器和不太整齐的便签。", "「不要把异常丢掉。异常有时候是入口。」"],
  },
});
