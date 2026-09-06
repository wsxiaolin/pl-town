import type { StoryPhase } from '../gameplay/stories/StoryRuntime';

type PhaseReporter = { phase: () => StoryPhase };

export type StoryEntryGate = (storyId: string) => boolean;

/**
 * 剧情互斥门：任一剧情处于进行中（已触发且未到达终局节点）时，其余剧情的
 * NPC / 建筑入口一律不放行，避免并行推进多条剧情；进行中的剧情自身入口保持可用。
 */
export function createStoryEntryGate(
  listControllers: () => readonly (readonly [string, PhaseReporter | null | undefined])[],
): StoryEntryGate {
  return (storyId: string): boolean => {
    let anyActive = false;
    let selfActive = false;
    for (const [id, controller] of listControllers()) {
      if (controller?.phase() !== 'active') continue;
      anyActive = true;
      if (id === storyId) selfActive = true;
    }
    // 收集全部 active 后再判定：已进入的剧情自身入口始终放行（存量并行存档的逃生通道）。
    return !anyActive || selfActive;
  };
}
