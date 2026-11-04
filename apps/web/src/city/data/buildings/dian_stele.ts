// 建筑配置：dian_stele（奠碑）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "dian_stele",
  num: "78",
  label: "奠碑",
  x: -36,
  z: 15,
  shape: "altar",
  icon: iconSvg(`<path d="M6 20h12M8 20V9h8v11"/><path d="M10 6h4v3h-4z"/>`),
  content: {
    name: "奠碑",
    slogan: "答案在水里。",
    dialog: [
      "青石矮碑高及腰，正面刻着一个「奠」字。",
      "碑侧一盏小马灯，夜里不灭。",
    ],
  },
});
