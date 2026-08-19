import { StoryRuntime, createInitialStoryState } from '../../gameplay/stories/StoryRuntime';
import type { StoryDefinition, StoryFlagValue, StoryState } from '../../gameplay/stories/types';
import type { CityDialogController, StoryDialogModel } from './cityDialogController';

export type ServerStoryState = {
  storyId: string;
  definitionVersion: number;
  nodeId: string;
  flags: Record<string, StoryFlagValue | null>;
  ending: string | null;
  visitCount: number;
  updatedAt: string;
};

export type StoryCommand =
  | { type: 'story.get'; storyId: string }
  | { type: 'story.update'; storyId: string; definitionVersion: number; nodeId: string; flags: Record<string, StoryFlagValue>; ending?: string; visit?: boolean };

type Options = {
  definition: StoryDefinition;
  send: (command: StoryCommand) => boolean;
  isOnline: () => boolean;
  showToast: (message: string) => void;
  awardAchievement: (achievementId: string) => boolean;
  hasItem?: (itemId: string) => boolean;
};

/**
 * Bridges a pure, client-authored StoryRuntime to the server-owned progress
 * record. It deliberately keeps no durable client state: text and rules belong
 * to the definition; only the compact current node/flags live on the server.
 */
export function createCloudStoryController(options: Options) {
  let snapshot: StoryState | null = null;
  let dialogs: CityDialogController | null = null;
  let requested = false;
  let opened = false;
  const awarded = new Set<string>();

  const repository = {
    get: (storyId: string): StoryState | null => storyId === options.definition.id ? snapshot : null,
    update: (_storyId: string, _patch: never): StoryState | null => null,
  };
  const runtime = new StoryRuntime(options.definition, repository);
  let verbatimPage: number | null = null;
  const verbatimPages: readonly string[] = [];

  /* The source file is editorial material only. Runtime must traverse nodes. */
  const renderVerbatim = (): void => {
    return;
    /* legacy source viewer intentionally unreachable */
    if (!dialogs || !opened || verbatimPage === null) return;
    const storyDialogs = dialogs;
    const page = Math.max(0, Math.min(verbatimPage ?? 0, verbatimPages.length - 1));
    const optionsList: Array<NonNullable<StoryDialogModel['options']>[number]> = [];
    if (page > 0) optionsList.push({ text: '上一页', onPick: () => { verbatimPage = page - 1; renderVerbatim(); } });
    if (page < verbatimPages.length - 1) optionsList.push({ text: '下一页', onPick: () => { verbatimPage = page + 1; renderVerbatim(); } });
    optionsList.push({ text: '返回剧情', onPick: () => { verbatimPage = null; render(); } });
    storyDialogs!.openStory({
      title: `${options.definition.title} · 完整原稿`,
      variant: 'story',
      role: `逐字原稿 ${page + 1}/${verbatimPages.length}`,
      text: verbatimPages[page] ?? '',
      options: optionsList,
      onClose: () => { opened = false; verbatimPage = null; },
    });
  };

  const render = (): void => {
    if (!dialogs || !opened) return;
    const node = runtime.node();
    if (node.achievement && !awarded.has(node.achievement.id)) {
      if (options.awardAchievement(node.achievement.id)) awarded.add(node.achievement.id);
    }
    const advanceChoice = node.choices?.find((choice) => choice.id.startsWith('continue-'));
    const model: StoryDialogModel = {
      title: options.definition.title,
      variant: node.presentation === 'cg' ? 'cg' : 'story',
      role: node.role,
      text: /^(请选择|选择)$/.test(node.text.trim()) ? '' : node.text,
      tone: node.tone,
      onAdvance: advanceChoice
        ? () => choose(advanceChoice.id)
        : undefined,
      options: node.choices?.filter((choice) => !choice.id.startsWith('continue-') && (!choice.requiresItem || options.hasItem?.(choice.requiresItem) === true)).map((choice) => ({
        text: choice.label,
        onPick: () => choose(choice.id),
      })) ?? [],
      onClose: () => { opened = false; },
    };
    dialogs.openStory(model);
  };

  const request = (): boolean => {
    if (requested || !options.isOnline()) return false;
    requested = options.send({ type: 'story.get', storyId: options.definition.id });
    return requested;
  };

  const choose = (choiceId: string): void => {
    if (!options.isOnline()) {
      options.showToast('剧情需要连接服务器来保存进度');
      return;
    }
    const transition = runtime.choose(choiceId);
    if (!transition) return;
    const { choice, state, resumptionNodeId } = transition;
    const sent = options.send({
      type: 'story.update',
      storyId: options.definition.id,
      definitionVersion: options.definition.definitionVersion,
      nodeId: resumptionNodeId,
      flags: { ...state.flags },
      ...(choice.ending ? { ending: choice.ending } : {}),
      ...(choice.visit ? { visit: true } : {}),
    });
    if (!sent) {
      options.showToast('故事进度未能保存，请稍后重试');
      return;
    }
    // The server remains authoritative, but rendering the deterministic next
    // node immediately keeps a choice responsive while its snapshot is in flight.
    // Keep the server snapshot at the savepoint while the runtime renders the
    // live transient node immediately.
    snapshot = { ...state, nodeId: resumptionNodeId };
    render();
  };

  const applyServerState = (state: ServerStoryState): void => {
    if (state.storyId !== options.definition.id) return;
    const fallback = createInitialStoryState(options.definition);
    snapshot = {
      storyId: state.storyId,
      definitionVersion: options.definition.definitionVersion,
      nodeId: options.definition.nodes[state.nodeId] ? state.nodeId : fallback.nodeId,
      flags: Object.fromEntries(Object.entries(state.flags).filter((entry): entry is [string, StoryFlagValue] => entry[1] !== null)),
      ending: state.ending ?? undefined,
      visitCount: Number.isInteger(state.visitCount) && state.visitCount >= 0 ? state.visitCount : 0,
      updatedAt: Number.isFinite(Date.parse(state.updatedAt)) ? Date.parse(state.updatedAt) : Date.now(),
    };
    requested = true;
    render();
  };

  return {
    open(controller: CityDialogController): void {
      dialogs = controller;
      opened = true;
      if (!options.isOnline()) {
        options.showToast('剧情需要连接服务器来保存进度');
        return;
      }
      if (!snapshot) {
        controller.openStory({
          title: options.definition.title,
          variant: 'story',
          role: options.definition.title,
          text: '正在读取故事进度……',
          onClose: () => { opened = false; },
        });
        request();
        return;
      }
      render();
    },
    applyServerState,
    resetConnection(): void {
      snapshot = null;
      requested = false;
    },
    getState: (): StoryState | null => snapshot,
  };
}
