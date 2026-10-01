import { initStoryTaskGuide } from '../adapters/ui/storyTaskGuide';
import { ECHO_OBSERVATORY_AREA } from './data/cityConfig';
import { ECHO_STORY } from '../gameplay/content/stories/echo/echoStory';
import { YESTERDAY_SONG } from '../gameplay/content/stories/yesterday/yesterdaySong';
import { MAGI_STORY } from '../gameplay/content/stories/magi/magiStory';
import { OVERCOAT_STORY } from '../gameplay/content/stories/overcoat/overcoatStory';
import type { BuildingEntity } from './buildingEntity';

type EchoGuideNavigator = {
  story: { state: () => { nodeId: string } };
  teleportFromCabin: () => void;
};

/**
 * 初始化全局唯一的剧情任务指引。点击导航只移动相机（回声对抗阶段例外），
 * 绝不会替玩家触发建筑 / NPC 交互——玩家必须亲自走到目标处才能推进剧情。
 * 回声 → 气象观测站（对抗阶段则退出小屋）；昨日之歌 → 报摊；
 * 麦琪的礼物 → 客栈；外套 → 阿卡基所在。
 */
export function initStoryTaskGuideWiring(options: {
  document: Document;
  getBuildings: () => readonly BuildingEntity[];
  getEchoController: () => EchoGuideNavigator | null;
  getCursor: () => unknown;
  getNpcPosition: (npcId: string) => { x: number; z: number } | null;
  setCameraTarget: (x: number, z: number, instant: boolean) => void;
  isConstructionPending: (buildingId: string) => boolean;
  showToast: (message: string) => void;
}): void {
  const panTo = (x: number, z: number): void => {
    if (options.getCursor()) options.setCameraTarget(x, z, false);
  };
  const panToBuilding = (buildingId: string): void => {
    const building = options.getBuildings().find((item) => item.id === buildingId);
    if (!building) return;
    if (options.isConstructionPending(buildingId)) {
      options.showToast(`「${building.label ?? building.id}」尚未建成，请前往众议院参与募捐，建成后再继续任务。`);
      return;
    }
    panTo(building.x, building.z);
  };

  initStoryTaskGuide(options.document, {
    onNavigate: (storyId) => {
      if (storyId === ECHO_STORY.id) {
        const echo = options.getEchoController();
        if (echo?.story.state().nodeId === 'confrontation-active') echo.teleportFromCabin();
        else panTo(ECHO_OBSERVATORY_AREA.center[0], ECHO_OBSERVATORY_AREA.center[1]);
        return;
      }
      if (storyId === YESTERDAY_SONG.id) { panToBuilding('newsstand'); return; }
      if (storyId === MAGI_STORY.id) { panToBuilding('guesthouse'); return; }
      if (storyId === OVERCOAT_STORY.id) {
        const akaki = options.getNpcPosition('akaki');
        if (akaki) panTo(akaki.x, akaki.z);
      }
    },
  });
}
