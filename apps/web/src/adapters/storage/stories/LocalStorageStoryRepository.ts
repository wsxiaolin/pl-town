import { createInitialStoryState } from '../../../gameplay/stories/StoryRuntime';
import type { StoryDefinition, StoryFlagValue, StoryGuide, StoryRepository, StoryState } from '../../../gameplay/stories/types';
import { townGameDay } from '../../../gameplay/time/townClock';

export class LocalStorageStoryRepository implements StoryRepository {
  constructor(
    private readonly definition: StoryDefinition,
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage,
  ) {}

  get(storyId: string): StoryState | null {
    if (storyId !== this.definition.id) return null;
    try {
      const value = JSON.parse(this.storage.getItem(this.key()) ?? 'null') as Partial<StoryState> | null;
      const nodeId = typeof value?.nodeId === 'string' && this.definition.nodes[value.nodeId]
        ? value.nodeId
        : undefined;
      if (!value || value.storyId !== storyId || !nodeId || !this.definition.nodes[nodeId]) return null;
      const updatedAt = typeof value.updatedAt === 'number' ? value.updatedAt : Date.now();
      const nodeGuide = this.definition.nodes[nodeId]?.guide;
      return {
        ...createInitialStoryState(this.definition),
        nodeId,
        flags: this.readFlags(value.flags),
        ending: typeof value.ending === 'string' ? value.ending : undefined,
        visitCount: Number.isInteger(value.visitCount) && (value.visitCount ?? -1) >= 0 ? value.visitCount! : 0,
        nodeEnteredGameDay: Number.isInteger(value.nodeEnteredGameDay) ? value.nodeEnteredGameDay : townGameDay(updatedAt),
        activeGuide: this.readGuide(value.activeGuide) ?? (nodeGuide && typeof nodeGuide === 'object' ? nodeGuide : undefined),
        updatedAt,
      };
    } catch {
      return null;
    }
  }

  update(storyId: string, patch: { nodeId: string; flags?: Readonly<Record<string, StoryFlagValue>>; ending?: string; visit?: boolean; nodeEnteredGameDay?: number; activeGuide?: StoryGuide | null }): StoryState | null {
    if (storyId !== this.definition.id || !this.definition.nodes[patch.nodeId]) return null;
    const current = this.get(storyId) ?? createInitialStoryState(this.definition);
    const next: StoryState = {
      ...current,
      nodeId: patch.nodeId,
      flags: patch.flags ?? current.flags,
      ending: patch.ending ?? current.ending,
      visitCount: current.visitCount + (patch.visit ? 1 : 0),
      nodeEnteredGameDay: patch.nodeEnteredGameDay ?? current.nodeEnteredGameDay,
      activeGuide: patch.activeGuide === null ? undefined : patch.activeGuide ?? current.activeGuide,
      updatedAt: Date.now(),
    };
    this.storage.setItem(this.key(), JSON.stringify(next));
    return next;
  }

  private key(): string { return `minicityStory.${this.definition.id}.v1`; }

  private readFlags(value: unknown): Record<string, StoryFlagValue> {
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, StoryFlagValue] =>
      typeof entry[1] === 'boolean' || typeof entry[1] === 'number' || typeof entry[1] === 'string'));
  }

  private readGuide(value: unknown): StoryGuide | undefined {
    if (!value || typeof value !== 'object') return undefined;
    const guide = value as Partial<StoryGuide>;
    return typeof guide.title === 'string' && typeof guide.objective === 'string'
      ? { title: guide.title, objective: guide.objective }
      : undefined;
  }
}
