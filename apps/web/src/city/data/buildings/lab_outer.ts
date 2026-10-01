// 建筑配置：lab_outer
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "lab_outer",
  num: "34",
  label: "数据中心",
  x: 33,
  z: 9,
  shape: "greenhouse",
  icon: iconSvg(`<path d="M9 3h6"/><path d="M10 3v5l-4 9a3 3 0 0 0 3 4h6a3 3 0 0 0 3-4l-4-9V3"/>`),
  content: {
    name: "数据中心",
    slogan: "数据即星辰，也即尘埃。",
    dialog: ["一排排机柜亮着冷静的蓝光，风扇声低鸣不止。", "「这里保存着这座城所有被记住的数据。」"],
  },
});
