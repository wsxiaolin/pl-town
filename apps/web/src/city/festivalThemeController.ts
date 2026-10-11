// 城市主题控制器：接收服务端下发的 theme（hello 快照 / world.theme 推送），
// 切换春节装饰组可见性并打上 body 级 CSS 钩子。未知主题一律回退默认
// （只隐藏装饰，不报错——旧服务端不会下发 theme 字段）。
import type { SpringFestivalDecor } from '../rendering/springFestivalDecor';

export type CityTheme = { id: string };

export const SPRING_FESTIVAL_THEME_ID = 'spring-festival';

export function createFestivalThemeController(options: {
  createDecor: () => SpringFestivalDecor;
  showToast?: (message: string) => void;
}) {
  let decor: SpringFestivalDecor | null = null;
  let currentId = 'default';

  function apply(theme: CityTheme): void {
    const id = typeof theme?.id === 'string' ? theme.id : 'default';
    const previous = currentId;
    currentId = SPRING_FESTIVAL_THEME_ID === id ? id : 'default';
    if (currentId === SPRING_FESTIVAL_THEME_ID) {
      if (!decor) decor = options.createDecor();
      decor.setVisible(true);
      document.body.dataset.cityTheme = SPRING_FESTIVAL_THEME_ID;
    } else {
      decor?.setVisible(false);
      delete document.body.dataset.cityTheme;
    }
    if (previous !== currentId && options.showToast) {
      options.showToast(currentId === SPRING_FESTIVAL_THEME_ID ? '春节主题已点亮：小城换上新装' : '已切换回默认主题');
    }
  }

  return {
    apply,
    current: () => currentId,
    update: (elapsed: number) => decor?.update(elapsed),
    dispose: () => {
      decor?.dispose();
      decor = null;
      delete document.body.dataset.cityTheme;
    },
  };
}

export type FestivalThemeController = ReturnType<typeof createFestivalThemeController>;
