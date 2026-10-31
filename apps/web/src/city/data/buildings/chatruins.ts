// 建筑配置：chatruins（第一聊天室遗迹）
// 支线剧情 S001「聊天室世代史·会沉的城」场景建筑（题设：会沉的城，不散的人）。
// 半埋入坡地的遗迹：门楣与「真·第一聊天室」木牌露出地面，地层剖面即剧情本体。
// 政策（2026-10-31.chatruins.1）：剧情场景建筑，boot 时赠礼补全直接建成
// （DEFAULT_COMPLETED_BUILDING_IDS），不设众筹项目；玩家个人可访问。
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "chatruins",
  num: "60",
  label: "第一聊天室遗迹",
  x: -26,
  z: -40,
  shape: "ruins",
  plot: { tex: 'ground2', size: 4.6, color: 0xB9BCA6 },
  icon: iconSvg(`<path d="M5 20v-8l7-6 7 6v8"/><path d="M9 20v-5h6v5"/><path d="M8 6h8"/><line x1="6" y1="9" x2="18" y2="9"/>`),
  content: {
    name: "第一聊天室遗迹",
    slogan: "「真·第一聊天室（鸽叽与黑纸勿进）」",
    dialog: [
      "半埋在坡地里的门楣。木牌上的字迹被风雨磨过很多遍，还认得出：真·第一聊天室（鸽叽与黑纸勿进）。",
      "木牌背后没有门——只有一级一级往下沉的地层。每一层都压着一段日子。",
      "拾级而下的人留下过两万六千五百三十二条痕迹。后来的人把记得这里，叫作「考古」。",
    ],
  },
});
