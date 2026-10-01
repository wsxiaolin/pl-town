// 建筑配置：elevator
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "elevator",
  num: "13",
  label: "纪念碑",
  x: 9,
  z: -9,
  shape: "shaft",
  icon: iconSvg(`<rect x="6" y="3" width="12" height="18" rx="1"/><line x1="10" y1="8" x2="12" y2="6"/><line x1="12" y1="6" x2="14" y2="8"/><line x1="10" y1="16" x2="12" y2="18"/><line x1="12" y1="18" x2="14" y2="16"/>`),
  content: {
    name: "纪念碑",
    slogan: "我们会尽快修复其他按钮。",
    dialog: [
      "你拆下了大屏幕，却发现它后面藏着一架电梯。",
      "门缓缓打开，内部的按钮泛着幽光：",
      "⑤　④　③　②　①　-①",
      "「我们会尽快修复其他按钮。」",
      "一张便签贴在按钮旁，字迹潦草：每一层都是一座城的一部分，但不是每一层都还在。",
      "「选择你的楼层。」",
    ],
  },
});
