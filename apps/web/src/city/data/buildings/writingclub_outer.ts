// 建筑配置：writingclub_outer
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "writingclub_outer",
  num: "36",
  label: "野生菌餐馆",
  x: -31.5,
  z: -15.125,
  shape: "wild_mushroom_restaurant",
  icon: iconSvg(`<path d="M4 10h16v10H4z"/><path d="M3 10h18"/><path d="M6 6v4M12 6v4M18 6v4"/><path d="M8 14h8v6H8z"/>`),
  content: {
    name: "野生菌餐馆",
    slogan: "一年总要吃两次野生菌火锅。",
    dialog: ["门头挂着几串风干的菌子，锅底翻滚着奶白色的汤。", "老板笑眯眯地说：「吃完保准看见点新东西。」"],
  },
});
