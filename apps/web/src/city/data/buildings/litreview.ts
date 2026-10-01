// 建筑配置：litreview
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "litreview",
  num: "07",
  storyLocked: true,
  label: "文学审核部",
  x: -9,
  z: 3,
  shape: "ruins",
  icon: iconSvg(`<path d="M4 20V8l5-4 5 4v8"/><path d="M14 20V12l6-3v11"/><line x1="4" y1="20" x2="20" y2="20"/>`),
  content: {
    name: "文学审核部",
    slogan: "「已废弃」",
    dialog: [
      "你看到一行脚印，顺着它走了过去。脚印越来越杂乱。",
      "一栋古里古气的大房子，门前脚印十分杂乱，管理者似乎匆匆忙忙地离开的。门前挂着褪色的牌匾：文学审核部。",
      "原来所有书进图书馆之前都要经过他们的审核。权力还是蛮大的，或许他们有一部分人员就是管理人员。",
      "真令人痛心，这么气宇轩昂的组织……",
      "「已废弃。」",
      "告示板上的字迹还没干透。",
    ],
  },
});
