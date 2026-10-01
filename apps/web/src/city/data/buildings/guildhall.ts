// 建筑配置：guildhall
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "guildhall",
  num: "40",
  label: "公会堂",
  x: 33,
  z: -21,
  shape: "clocktower",
  facade: "facade_tower",
  icon: iconSvg(`<path d="M6 20V8h12v12"/><path d="M4 8h16l-2-4H6z"/>`),
  content: {
    name: "公会堂",
    slogan: "一个人走得快，一群人走得远。",
    dialog: ["大堂里挂着各种旗帜，每面代表一个自发组织。", "「加入一个公会，你会发现城市比想象的大。」"],
  },
});
