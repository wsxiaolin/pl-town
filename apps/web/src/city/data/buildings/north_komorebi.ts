// 建筑配置：north_komorebi（木漏时光 · 時計工房）
// 原作：《木漏时光》单文件 Three.js 场景（github.com/XinyuWang250428/
// gpt6-Astra_3.js 的 木漏时光.html，外部只读参考）；几何在
// rendering/komorebiClockworks.ts 按本城地块尺度移植。
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_komorebi",
  num: "65",
  label: "木漏时光",
  x: 27.5,
  z: -59.5,
  shape: "komorebi_workshop",  plot: { tex: 'ground5', size: 9.4, color: 0xD9D5CB },

  icon: iconSvg(`<circle cx="12" cy="13" r="7.5"/><path d="M12 13V8.5M12 13l3 2"/><path d="M9.5 4.5c1.5-1.5 3.5-1.5 5 0"/><path d="M17.5 6.5c1.2.4 1.8 1.3 1.8 2.5"/>`),
  content: {
    name: "木漏时光",
    slogan: "叶隙漏下的光，是被慢慢啃出来的时间。",
    dialog: [
      "工房的名字来自「木漏れ日」——从叶隙间洒落的光斑。整座工房是一座放大的木钟：梁柱是木、齿轮是木、连流水和鸟鸣，也尽量是木。",
      "大钟盘的指针走得和真实时间一样慢。木匠从不赶时间——时间在他手里，只是一圈一圈被刻刀啃出来的年轮与花纹。",
      "后院的水车把溪水舀回高处的木槽，再让它们一路跌成两级小瀑布；布谷鸟每过一阵推门报时一次，动力是一根木凸轮和它自己的好脾气。",
      "工房常年敞着检修口：所有机构都摆在明处，坏了任何一枚木齿，路过的人都可以坐下修一修。修钟即是修心。",
    ],
  },
});
