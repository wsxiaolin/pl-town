// 建筑配置：painting_ai（绘画+AI 画室）
import { defineBuilding, iconSvg } from './_types';

export default defineBuilding({
  id: 'painting_ai',
  num: '52A',
  label: '绘画+AI',
  x: 9,
  z: 24,
  shape: 'painting_ai',
  icon: iconSvg(`<path d="M12 3a8.6 8.6 0 0 0-.55 17.19c1.5.1 2.27-.76 1.79-2.02-.5-1.28.35-2.42 1.9-2.42h2.11A3.75 3.75 0 0 0 21 12C21 6.9 17 3 12 3Z"/><circle cx="7.6" cy="10.4" r="1.05"/><circle cx="10.6" cy="7.4" r="1.05"/><circle cx="14.8" cy="8" r="1.05"/><path d="m16.9 15.1 3.3 3.3"/><path d="m18.5 16.7 1.7-1.7"/>`),
  content: {
    name: '绘画+AI 画室',
    slogan: '无论画什么，笔画总会变成一座小城。',
    dialog: [
      '门口的画架自己摆正了画板，一支画笔悬在半空，笔尖闪着微光。',
      '「需要快速学习绘画吗？」AI 小画童眨了眨眼，「在这里，随手一笔就是一座城。」',
    ],
    dialogAvatar: [0xf2e6cf, 0x3b6fe0],
  },
});
