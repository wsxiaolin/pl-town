// 建筑配置：north_genshin_institute（星语北城 · 原神研究院）
// 彩蛋体验建筑：致敬 miHoYo《原神》的启动页复刻（参考
// github.com/alphardex/genshin-replica，外部只读参考，非官方、非商用）。
// 点击建筑走 genshinInstituteController 的打字机对话，选择「好想玩原神！」
// 后经「云原神」预热（预取的启动页 chunk + shader 预编译），再全屏播放
// 程序化启动页（渲染/音频见 city/genshin/genshinLaunchOverlay.ts，动态
// import 拆分，闲置时仅预下载源码、不运行渲染逻辑）。
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: "north_genshin_institute",
  num: "66",
  label: "原神研究院",
  x: 30.5,
  z: -49.5,
  shape: "genshin_institute",  plot: { tex: 'ground5', size: 4.4, color: 0xE8E2CE },

  icon: iconSvg(`<path d="M12 3l2.2 4.6L19 8.4l-3.5 3.4.8 4.9L12 14.4l-4.3 2.3.8-4.9L5 8.4l4.8-.8z"/><path d="M12 17.5v3.5"/>`),
  content: {
    name: "原神研究院",
    slogan: "这里的学者毕生只研究一个课题——原神，怎么启动。",
    dialog: [
      "原神研究院，星语北城最小也最执着的研究机构。七年来只研究一个课题：原神的启动页。",
      "据说只要对着大门说出那句话，研究院就会为你连接「云原神」，启动页将在云端为你展开。",
    ],
  },
});
