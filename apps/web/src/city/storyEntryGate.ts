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
    for (const [id, controller] of listControllers()) {
      if (id !== storyId && controller?.phase() === 'active') return false;
    }
    return true;
  };
}
