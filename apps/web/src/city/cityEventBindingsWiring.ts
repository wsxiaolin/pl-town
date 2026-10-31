// 事件绑定接线：画布指针/点击、顶栏与面板开关、地图/行走模式切换、
// 登录入口与设置抽屉的全局事件装配，从组合根抽出。
// 组合根只负责在 setup 阶段调用 eventBindings.setupEvents()。
import type { EventBindingsOptions } from './eventBindings';
import { createEventBindings } from './eventBindings';

export type CityEventBindingsWiringOptions = Omit<EventBindingsOptions, 'closeRenderSettings'>;

export function createCityEventBindingsWiring(options: CityEventBindingsWiringOptions) {
  const eventBindings = createEventBindings({
    ...options,
    // 自引用收口：设置抽屉关闭按钮/冰冠 hooks 都走这一份实现。
    closeRenderSettings: () => eventBindings.closeRenderSettings(),
  });
  return { eventBindings };
}
