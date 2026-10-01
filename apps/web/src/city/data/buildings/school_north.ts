// 建筑配置：school_north
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "school_north",
  num: "29",
  label: "北区学院",
  x: -22.5,
  z: 15,
  shape: "school",
  icon: iconSvg(`<path d="M3 21h18"/><path d="M6 21V10l6-5 6 5v11"/><path d="M9 21v-5h6v5"/><path d="M4 10l8-5 8 5"/>`),
  content: {
    name: "北区学院",
    slogan: "这里教的不只是答案，更是提问的方法。",
    dialog: ["学院的走廊安静得能听见自己的脚步回声。", "黑板上还留着没擦干净的式子和一句未完的提问。", "「一座城若不再产生提问，便已开始衰老。」"],
  },
});
