// 建筑配置：residentid
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "residentid",
  num: "14",
  label: "居民证",
  x: -9,
  z: -9,
  shape: "altar",
  icon: iconSvg(`<rect x="3" y="6" width="18" height="12" rx="1"/><circle cx="8" cy="12" r="2"/><line x1="13" y1="11" x2="18" y2="11"/><line x1="13" y1="14" x2="16" y2="14"/>`),
  content: {
    name: "居民证",
    slogan: "请撕下这张纸，作为你的居民证。",
    dialog: [
      "一张纸静静躺在石台上，边角整齐。",
      "——————————————————",
      "{Visitor}",
      "我会遵守《这个城的法则》，我已阅读《居民生存指南》。",
      "——————————————————",
      "如你遇到 Bug 类困难，请联系 turtlesim。",
      "你要参与这个故事的话，就请签上你的名字。",
      "「签名之后，你就是这座城的人了。」",
    ],
  },
});
