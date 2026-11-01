// 建筑配置：west_research_dept（西山研究部）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "west_research_dept",
  num: "75",
  label: "西山研究部",
  x: -39,
  z: -45,
  shape: "campus",
  icon: iconSvg(`<path d="M3 20h18M5 20V8l7-4 7 4v12"/><path d="M9 20v-5h6v5"/>`),
  content: {
    name: "西山研究部",
    slogan: "所有人都要招。",
    dialog: [
      "前台后面是一面一百格的名牌墙。",
      "走廊两侧的办公室，门都半开着。",
    ],
  },
});
