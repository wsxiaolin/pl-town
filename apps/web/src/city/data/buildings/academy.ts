// 建筑配置：academy
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "academy",
  num: "09",
  label: "物实学院",
  x: 4,
  z: 9,
  shape: "campus",
  icon: iconSvg(`<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1 2.5 3 6 3s6-2 6-3v-5"/>`),
  content: {
    name: "物实学院",
    slogan: "文化一条街。",
    dialog: ["现代化的大楼立在老街尽头，玻璃幕墙反着光。", "这貌似是一个学校，不知道里面是什么样子。咦，这里面的课程好像对我们的生存很有帮助。", "面前出现了一个五角星。这里可以收藏吗？拿着这些课，以后或许有用。", "「知识不是必需品，是奢侈品——但在物实，它两者都是。」"],
  },
});
