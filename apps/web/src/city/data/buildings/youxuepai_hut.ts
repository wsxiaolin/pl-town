// 建筑配置：youxuepai_hut（通关木屋）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "youxuepai_hut",
  num: "77",
  label: "通关木屋",
  x: -36,
  z: -47,
  shape: "kiosk",
  icon: iconSvg(`<path d="M4 20h16M6 20V10h12v10"/><path d="M4 10l8-5 8 5"/>`),
  content: {
    name: "通关木屋",
    slogan: "找不完的，找到一处还有下一处。",
    dialog: [
      "高脚木屋面海背城，闸口就在门外。",
      "抽屉里那本册子没有名字，只写着一句话。",
    ],
  },
});
