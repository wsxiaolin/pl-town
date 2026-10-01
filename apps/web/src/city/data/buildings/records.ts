// 建筑配置：records
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "records",
  num: "39",
  label: "记录厅",
  x: -33,
  z: -21,
  shape: "temple",
  facade: "facade_observatory",
  icon: iconSvg(`<path d="M4 4h16v16H4z"/><path d="M8 8h8"/>`),
  content: {
    name: "记录厅",
    slogan: "每一个名字背后都有故事。",
    dialog: ["墙上密密麻麻刻着名字。", "管理人员定期来核对，确保每个名字都对应一个真实的存在。", "「被记住，是这座城给予居民最基本的尊重。」"],
  },
});
