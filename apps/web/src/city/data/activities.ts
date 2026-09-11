export type ActivityBackgroundKey = 'star-voyage' | 'aurora-festival' | 'meteor-market';

export interface ActivityEntry {
  id: string;
  name: string;
  kicker: string;
  badge?: string;
  title: string;
  subtitle?: string;
  description: string;
  backgroundKey: ActivityBackgroundKey;
}

// 活动为静态配置，新增活动时在此追加条目，并在 controller 的
// ACTIVITY_BACKGROUND_URLS 中登记对应的背景图。
export const ACTIVITY_ENTRIES: readonly ActivityEntry[] = [
  {
    id: 'star-voyage',
    name: '巡星之礼',
    kicker: '限时活动',
    badge: '新',
    title: '巡星归程',
    subtitle: '第一幕 · 星海旅情',
    description: '跟随归航的星舰走完小城的夏日航线，收集沿途散落的星屑，兑换限定纪念。',
    backgroundKey: 'star-voyage',
  },
  {
    id: 'aurora-festival',
    name: '极光庆典',
    kicker: '节日活动',
    badge: '新',
    title: '极光之下，城与长夜同醒',
    subtitle: '第二幕 · 永夜庆典',
    description: '极光笼罩的小城会亮起灯海，完成庆典任务即可点亮属于自己的那一盏灯。',
    backgroundKey: 'aurora-festival',
  },
  {
    id: 'meteor-market',
    name: '流星夜市',
    kicker: '社区活动',
    title: '流星夜市，三日不打烊',
    subtitle: '第三幕 · 烟火人间',
    description: '在流星坠落的街区摆摊、交换与留言，把这一夜的烟火收进回忆。',
    backgroundKey: 'meteor-market',
  },
];
