// 建筑配置：stats
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "stats",
  num: "15",
  label: "STATS",
  x: -5.5,
  z: -5.5,
  shape: "observatory",
  isStats: true,
  icon: iconSvg(`<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>`),
});
