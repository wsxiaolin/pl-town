// 建筑配置：techhalf
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "techhalf",
  num: "03",
  label: "技术半城",
  x: 9,
  z: -3,
  shape: "tower",
  icon: iconSvg(`<polyline points="8 6 4 12 8 18"/><polyline points="16 6 20 12 16 18"/>`),
  content: {
    name: "技术半城",
    slogan: "你完全可以相信这里。",
    dialog: [
      "这里的所有居民都是知识居民，都是很友善的。",
      "但它对你没有那么友好——在你真正成为居民之前，也就是当你不再需要这本手册时，你才会体会到这里的乐趣。",
      "也就是说，在别的地方，可能会有危险。",
      "也有一些新居民偏偏喜欢这里，我们称他们为\"新知者\"。总有一些另一个半城的居民混进来，管理人员的部分工作，就是把他们请回去。他们居住的房子，我们叫\"水实验\"。",
      "「建议：熟悉这里之前，少接触这个区。」",
    ],
  },
});
