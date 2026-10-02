// 建筑配置：banana_palace
// ── 特殊建筑 ──
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "banana_palace",
  num: "47",
  label: "布拿拉宫",
  x: -30,
  z: 30,
  shape: "banana",
  glbFile: "banana.glb",
  icon: iconSvg(`<path d="M6 14c0-4 2-8 6-8s6 4 6 8c0 3-2 6-6 6s-6-3-6-6z"/><path d="M12 6V3"/>`),
  content: {
    name: "布拿拉宫",
    slogan: "黄得发亮，歪得有理。",
    dialog: ["一座巨大的香蕉造型建筑矗立在眼前，黄得耀眼。", "布拿拉工站在门口，手里捧着一根小香蕉。", "「我叫布拿拉工，是这宫的主人。宫不是宫殿的宫，是香蕉的弯。」", "「你问我为什么住在香蕉里？因为这城里，总得有人住在不一样的地方。」"],
  },
});
