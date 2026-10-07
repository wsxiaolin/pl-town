// 建筑配置：fireworks_shop（烟花铺）
// 海滩南侧的节庆小店：居民在这里设计自己的烟花并存入云端
// （30 金币/次），设计成品在海边观景台轮播燃放。几何在
// rendering/fireworksShopBuilding.ts 单独建模。
import { defineBuilding, iconSvg } from './_types';
import { FIREWORKS_SHOP_FEATURE_ID } from '../../fireworks/fireworksFeatureIds';

export default defineBuilding({
  id: "fireworks_shop",
  num: "69",
  label: "烟花铺",
  x: -37.5,
  z: 20,
  shape: "fireworks_shop",  hasPlot: false,  decorationClearance: 3,

  icon: iconSvg(`<path d="M12 3v3"/><path d="M8 6h8l1.5 4h-11L8 6z"/><path d="M7 10l5 10 5-10"/><path d="M9.5 13.5h5"/><path d="M12 20v1.5"/>`),
  content: {
    name: "烟花铺",
    slogan: "把一整晚的心事，装进一支烟花里。",
    dialog: [
      "柜台后摆满了卷紧的纸筒和一排排配色的药粉罐。老板娘说，烟花是把光先存起来，等到晚上再还给天空。",
      "设计一支烟花完全由你做主：升多高、什么颜色、开成什么花形——甚至可以在网格上一格一格画出你想让它在夜空拼出的图案。",
      "把设计存进云端的账本要 30 金币；存好之后，去北边的海边观景台，所有人的烟花都会在那片海上依次升起。",
    ],
  },
  featureIds: [FIREWORKS_SHOP_FEATURE_ID],
});
