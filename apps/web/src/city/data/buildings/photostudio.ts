// 建筑配置：photostudio
// ── New city-life buildings (malls & schools) ──
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "photostudio",
  num: "26A",
  label: "照相馆",
  x: 21,
  z: 15,
  shape: "kiosk",
  facade: "facade_market",
  icon: iconSvg(`<rect x="3" y="7" width="18" height="12" rx="1"/><circle cx="12" cy="13" r="3"/><path d="M7 7l2-3h6l2 3"/>`),
});
