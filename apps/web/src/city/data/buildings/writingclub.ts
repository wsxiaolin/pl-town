// 建筑配置：writingclub
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "writingclub",
  num: "22",
  label: "文训社",
  x: -15,
  z: 15,
  shape: "factory",
  icon: iconSvg(`<path d="M4 20l4-1 10-10a3 3 0 0 0-4-4L4 15z"/><path d="M13 6l5 5"/>`),
  content: {
    name: "文训社",
    slogan: "字是城的声音，写下来才不散。",
    dialog: ["木桌木椅，墨迹未干。", "「别怕写不好。先写下来，再改。」"],
  },
});
