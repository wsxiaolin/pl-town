// 建筑配置：mall_south
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "mall_south",
  num: "26",
  // <discussion=654782b83b13265ec0206f9a>五金月饼&一瓶农夫山泉『金月店』</discussion>
  label: "金月店",
  x: 22.5,
  z: -22.5,
  shape: "mall",
  icon: iconSvg(`<path d="M3 9l2-5h14l2 5"/><path d="M3 9v11h18V9"/><path d="M9 20v-5h6v5"/><path d="M3 13h18"/>`),
  content: {
    name: "金月店",
    slogan: "霓虹之下，欲望被精心陈列。",
    dialog: ["自动门\"嗖\"地滑开，空调冷风裹住刚进来的你。", "橱窗里陈列着进口商品、电子玩具、还有那些说不上有用但就是想买的小东西。", "「城市之所以像城市，是因为这里永远有你想买却买不起的东西。」"],
  },
});
