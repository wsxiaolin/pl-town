import { initStoryTaskGuide } from '../adapters/ui/storyTaskGuide';
import { ECHO_OBSERVATORY_AREA } from './data/cityConfig';
import { ECHO_STORY } from '../gameplay/content/stories/echo/echoStory';
import { YESTERDAY_SONG } from '../gameplay/content/stories/yesterday/yesterdaySong';
import type { BuildingEntity } from './buildingEntity';

type EchoGuideNavigator = {
  story: { state: () => { nodeId: string } };
  teleportFromCabin: () => void;
};

/**
 * 初始化全局唯一的剧情任务指引。点击导航按当前剧情分发：
 * 回声 → 气象观测站（对抗阶段则退出小屋），昨日之歌 → 报摊。
 */
export function initStoryTaskGuideWiring(options: {
  document: Document;
  getBuildings: () => readonly BuildingEntity[];
  navigateTo: (building: BuildingEntity) => void;
  getEchoController: () => EchoGuideNavigator | null;
  getCursor: () => unknown;
  setCameraTarget: (x: number, z: number, instant: boolean) => void;
}): void {
  initStoryTaskGuide(options.document, {
    onNavigate: (storyId) => {
      if (storyId === ECHO_STORY.id) {
        const echo = options.getEchoController();
        if (echo?.story.state().nodeId === 'confrontation-active') echo.teleportFromCabin();
        else if (options.getCursor()) options.setCameraTarget(ECHO_OBSERVATORY_AREA.center[0], ECHO_OBSERVATORY_AREA.center[1], false);
        return;
      }
      if (storyId === YESTERDAY_SONG.id) {
        const building = options.getBuildings().find((item) => item.id === 'newsstand');
        if (building) options.navigateTo(building);
      }
    },
  });
}
