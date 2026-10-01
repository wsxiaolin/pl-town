// 建筑配置：mall_west
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "mall_west",
  num: "28",
  // <discussion=6738a487ce449cb493cd6349>小店</discussion>
  label: "断星玄",
  x: -22.5,
  z: 22.5,
  shape: "mall",
  icon: iconSvg(`<path d="M3 9l2-5h14l2 5"/><path d="M3 9v11h18V9"/><path d="M9 20v-5h6v5"/><path d="M3 13h18"/>`),
  content: {
    name: "断星玄",
    slogan: "旧街坊与霓虹的交界处。",
    dialog: ["这间商场比南门那家旧些，但人却不显得少。", "楼下菜场、楼上服饰，再往上是个改造过的电影院，只放老片。", "「商业的层次，就是城市的层次。这里能买到全部日常。」"],
  },
});
