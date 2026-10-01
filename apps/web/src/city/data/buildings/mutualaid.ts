// 建筑配置：mutualaid
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "mutualaid",
  num: "11",
  label: "互助团",
  x: -9,
  z: 9,
  shape: "kiosk",
  icon: iconSvg(`<path d="M12 21s-7-5-7-11a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 6-7 11-7 11z"/>`),
  content: {
    name: "互助团",
    slogan: "你有什么需要吗？",
    dialog: [
      "一张广告贴在墙上，边角被风掀起。",
      "互助团成立了！你有什么需要吗？快来这里投稿吧，我们会尽所可能的帮助你！",
      "你对着空气说：\"我怎么能离开这里？\"",
      "「抱歉，我们属于这里，无法帮你离开。」",
      "不要灰心。这个组织还是很有用的。",
      "「能帮的，他们都会帮。不能帮的，只有你自己。」",
    ],
  },
});
