// 建筑配置：wandering_observatory（问天台）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "wandering_observatory",
  num: "88",
  label: "问天台",
  x: 31,
  z: -33,
  shape: "observatory",
  icon: iconSvg(`<path d="M4 20h16"/><path d="M6 20V11a6 6 0 0 1 12 0v9"/><path d="M12 5V2"/>`),
  content: {
    name: "问天台",
    slogan: "南岸有人填空，北坡有人问天。",
    dialog: [
      "白色天文台立在小城北坡最高处。",
      "圆顶上有七道彩色观测缝。",
    ],
  },
});
