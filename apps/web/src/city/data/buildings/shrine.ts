// 建筑配置：shrine
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "shrine",
  num: "45",
  label: "神社",
  x: 9,
  z: -33,
  shape: "altar",
  facade: "facade_temple",
  icon: iconSvg(`<path d="M4 20h16"/><path d="M6 20V8h12v12"/>`),
  content: {
    name: "神社",
    slogan: "安静地站着，也是一种参与。",
    dialog: ["石阶尽头是一座小小的殿宇。"],
    dialogTree: [
      {
        text: "听说神社正在举办一个拔刀的活动，只有天选之人才能把刀从石头中拔出来。",
        options: [
          { text: "让我试试！", next: 1 },
          { text: "这不对吧？", next: 1 },
        ],
      },
      {
        text: "不知道为什么，你情不自禁地接受了这个挑战。",
        options: [
          { text: "用力拔", next: 2 },
          { text: "轻轻的拔", next: 2 },
        ],
      },
      {
        text: "宝刀就在眼前，决定命运的时刻到了。",
        options: [
          {
            text: "继续",
            next: 3,
            nextByVisitor: {
              includes: ["有地", "将臣"],
              maxLength: 5,
              next: 4,
            },
          },
        ],
      },
      {
        text: "宝刀纹丝不动，可能是你的用户名起的不对吧。",
        options: [
          { text: "告辞", next: null },
        ],
      },
      {
        text: "你竟然把它拔出来了！",
        options: [
          { text: "然后呢？", next: null, action: "open-url:https://store.steampowered.com/app/1144400/_?l=schinese" },
        ],
      },
    ],
  },
});
