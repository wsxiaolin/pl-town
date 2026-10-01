// 建筑配置：bulletin
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "bulletin",
  num: "02",
  label: "公告板",
  x: -4,
  z: -9,
  shape: "board",
  icon: iconSvg(`<rect x="4" y="5" width="16" height="14" rx="1"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>`),
  content: {
    name: "公告板",
    slogan: "一块镶了铁框、加了雨棚的木板。",
    dialog: [
      "一块普通的大木板，用铁镶了框，还安了雨棚。很明显，这里最近有人来修过。",
      "纸页都有些发黄了，不过还牢牢粘在上面，不掉下来。凑近一点好好看看——并非传单或小报，而是一堆公告。写这些公告的人做事一定特别有条理，句句分明，就是潦草了些。",
      "你正看着，一个空旷的声音忽然响起：",
      "「一座城市，怎么会没有管理人员呢？」",
      "——哦？难道这里还有\"管理人员\"？",
    ],
  },
});
