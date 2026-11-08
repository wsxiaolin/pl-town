// 建筑配置：huigui_hostel（会归寮）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "huigui_hostel",
  num: "91",
  label: "会归寮",
  x: -4,
  z: 25,
  shape: "pagoda",
  icon: iconSvg(`<path d="M4 20h16M6 20v-4h12v4M8 16v-3h8v3M10 13V8h4v5"/>`),
  content: {
    name: "会归寮",
    slogan: "说人话，炉子才亮。",
    dialog: [
      "寮门半掩，里面总有一盏灯。",
      "住客不常出来，杯底的茶却总是温的。",
    ],
  },
});
