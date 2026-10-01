// 建筑配置：news
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "news",
  num: "10",
  label: "星尘报社",
  x: -4,
  z: 9,
  shape: "kiosk",
  icon: iconSvg(`<rect x="3" y="5" width="18" height="14" rx="1"/><line x1="7" y1="9" x2="17" y2="9"/><line x1="7" y1="13" x2="13" y2="13"/><line x1="7" y1="17" x2="13" y2="17"/>`),
  content: {
    name: "星尘报社",
    slogan: "隶属于 SNO.星尘报社总部。",
    dialog: [
      "\"拿着这份报纸吧！\"",
      "你抬起头，想问他是哪个报社的。可那个人已经消失了。",
      "你看了看手中的报纸。报纸上写着：",
      "「隶属于 SNO.星尘报社总部」",
      "真有意思，连这都有。看起来，要在这里待一段时间了。",
      "「新闻是这座城里唯一比法则跑得更快的东西。」",
    ],
  },
});
