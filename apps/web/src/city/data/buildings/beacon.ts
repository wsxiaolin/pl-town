// 建筑配置：beacon
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "beacon",
  num: "46",
  label: "灯塔",
  x: 9,
  z: 31.5,
  shape: "tower",
  facade: "facade_darktower",
  icon: iconSvg(`<path d="M8 21V5l4-3 4 3v16"/><path d="M8 21h8"/>`),
  content: {
    name: "灯塔",
    slogan: "为还没到的人亮着。",
    dialog: ["塔顶的灯日夜不灭。", "「总有人在路上。总有人需要一盏灯。」", "这座灯塔也照亮着社区伙伴的努力——pl light，一个由社区成员辰寅开发维护的服务平台，提供社区作品评审、社区编辑器等配套服务。"],
  },
});
