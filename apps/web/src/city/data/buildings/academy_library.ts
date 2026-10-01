// 建筑配置：academy_library
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "academy_library",
  num: "书院",
  label: "书院",
  x: 3,
  z: -15,
  shape: "academy",
  icon: iconSvg(`<path d="M4 19V8l8-4 8 4v11"/><path d="M8 19v-6h8v6"/><path d="M9 9h6"/><path d="M12 4v5"/>`),
});
