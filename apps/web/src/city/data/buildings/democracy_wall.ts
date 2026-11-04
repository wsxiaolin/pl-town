// 建筑配置：democracy_wall（民主墙）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "democracy_wall",
  num: "85",
  label: "民主墙",
  x: -30,
  z: 12,
  shape: "board",
  icon: iconSvg(`<path d="M4 5h16v11H4z"/><path d="M8 16v4M16 16v4"/>`),
  content: {
    name: "民主墙",
    slogan: "墙只数票。",
    dialog: [
      "一面砌好了、还没接上服务端的墙。",
      "软木板上钉着票笺，一人一票，不可撤回。",
    ],
  },
});
