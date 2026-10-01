// 建筑配置：culturehall
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "culturehall",
  num: "24",
  label: "文化馆",
  x: 15,
  z: 9,
  shape: "screen",
  // 故意不配 contentQuery：点击已改为打开右侧「物实作家图鉴」面板（见 writerCatalogController）。
  icon: iconSvg(`<path d="M4 5h16v14H4z"/><path d="M8 9h8"/><path d="M8 13h5"/><path d="M6 19l3-4"/><path d="M18 19l-3-4"/>`),
  content: {
    name: "文化馆",
    slogan: "城的记忆在这里被展出。",
    dialog: ["展厅里有模型、照片、手稿，还有一些无法归类的小东西。", "它们不一定重要，但它们共同证明：这座城曾经被很多人认真使用过。", "「文化不是纪念品，是居民留下的痕迹。」"],
  },
});
