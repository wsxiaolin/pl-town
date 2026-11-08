// 建筑配置：liberation_keyshop（钥匙铺）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "liberation_keyshop",
  num: "94",
  label: "钥匙铺",
  x: 28,
  z: 25,
  shape: "kiosk",
  icon: iconSvg(`<path d="M4 20h16M6 20V10h12v10"/><path d="M4 10l8-5 8 5"/>`),
  content: {
    name: "钥匙铺",
    slogan: "本店从不放鸽子。本店只是随潮。",
    dialog: [
      "城门边一间挂木牌的小铺，货架上摆满旧钥匙。",
      "涨潮的时候，店主会回来。",
    ],
  },
});
