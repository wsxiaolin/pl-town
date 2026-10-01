// 建筑配置：community
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "community",
  num: "18",
  label: "社区中心",
  x: 15,
  z: -15,
  shape: "clocktower",
  icon: iconSvg(`<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/><path d="M7 11h2"/><path d="M15 11h2"/>`),
  content: {
    name: "社区中心",
    slogan: "居民在这里互相确认彼此存在。",
    dialog: ["大厅里挂着很多便签，有求助，有招募。", "「一座城不是建出来的，是搭出来的。」"],
  },
});
