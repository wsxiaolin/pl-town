// 建筑配置：film_city
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "film_city",
  num: "50",
  label: "物实影视城",
  x: -9,
  z: -21,
  shape: "film_city",
  icon: iconSvg(`<rect x="3" y="7" width="14" height="12" rx="2"/><path d="m17 11 4-2v8l-4-2z"/><path d="M6 7 8 3h4l2 4"/>`),
});
