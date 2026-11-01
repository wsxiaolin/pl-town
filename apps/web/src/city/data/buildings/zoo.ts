// 建筑配置：zoo（小城动物园）
// 支线剧情 S014「动物园怪谈」的场景建筑：关闭三年后重新开园的小园子。
// 大门 / 售票亭 / 园长办公室合为一栋程序化建筑，五个展区、园史馆与
// 留言点作为园区兴趣点在后续切片补上。园区坐标见 ZOO_AREA。
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "zoo",
  num: "71",
  label: "小城动物园",
  x: -9,
  z: 29.8,
  shape: "zoo",
  hasPlot: false,
  interactionRadius: 3.0,
  icon: iconSvg(`<path d="M4 20V9l8-5 8 5v11"/><path d="M4 13h16"/><path d="M7 20v-4h3v4M14 20v-4h3v4"/><path d="M9 7.5h6"/>`),
  content: {
    name: "小城动物园",
    slogan: "「重新开园第一天，门票免费，先回答一个问题。」",
    dialog: [
      "关了三年的小城动物园重新开了门。门口的彩带还剩半截，售票亭的灯是新的。",
      "园长·逐影站在售票亭后面，手里是一摞还没盖章的申请表。",
      "「欢迎来到小城动物园——重新开园第一天，你是第……不重要，反正从今天重新数。」",
      "五个展区、一座园史馆、一面水墙。守则贴在售票亭的玻璃上，第七条还空着。",
    ],
  },
});
