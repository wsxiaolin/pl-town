import type { NpcQuestAction, QuestTransition } from '../../gameplay/quests/types';

export interface LegacyDialogueOption {
  text: string;
  next: number | null;
  onPick?: () => void;
}

export interface LegacyDialogueNode {
  text: string;
  options: readonly LegacyDialogueOption[];
}

export interface NpcEntityLike {
  profile: {
    id: string;
    name: string;
    role: string;
    head: number;
    body: number;
    dialog: readonly LegacyDialogueNode[];
  };
  mesh: { rotation: { y: number }; position: { x: number; z: number } };
}

export interface BuildingContentLike {
  name: string;
  slogan: string;
  dialog: readonly string[];
}

export interface BuildingLike {
  id: string;
  num: string;
  label?: string;
}

export interface StoryDialogOption {
  text: string;
  onPick: () => void | Promise<void>;
}

export interface StoryDialogModel {
  title: string;
  role?: string;
  text: string;
  tone?: 'default' | 'green';
  options?: readonly StoryDialogOption[];
  onClose?: () => void;
}

export interface CityDialogControllerOptions {
  document: Document;
  buildingContent: Readonly<Record<string, BuildingContentLike>>;
  getQuestAction: (npcId: string) => NpcQuestAction | null;
  performQuestAction: (action: NpcQuestAction, at: number) => QuestTransition;
  onNpcInteracted: (npcId: string) => void;
  pauseNpcs: () => void;
  resumeNpcs: () => void;
  showToast: (message: string) => void;
  signal?: AbortSignal;
}

export interface CityDialogController {
  setup(): void;
  isOpen(): boolean;
  openBuilding(building: BuildingLike): void;
  closeBuilding(): void;
  openNpc(npc: NpcEntityLike, playerPosition?: { x: number; z: number }): void;
  openStory(story: StoryDialogModel): void;
  closeNpc(): void;
}

function getElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing city dialog element #${id}`);
  return element as T;
}

export function createCityDialogController(options: CityDialogControllerOptions): CityDialogController {
  const { document } = options;
  let npcOpen = false;
  let activeNpc: NpcEntityLike | null = null;
  let activeStoryClose: (() => void) | undefined;
  const firstNode = (npc: NpcEntityLike): LegacyDialogueNode => npc.profile.dialog[0] ?? { text: '……', options: [] };

  const renderOptions = (items: readonly { text: string; onPick: () => void }[]): void => {
    const wrapper = getElement<HTMLDivElement>(document, 'npcOptions');
    wrapper.replaceChildren();
    items.forEach((item) => {
      const button = document.createElement('button');
      button.className = 'npc-opt';
      button.textContent = item.text;
      button.addEventListener('click', item.onPick);
      wrapper.appendChild(button);
    });
  };

  const renderLine = (text: string, tone: StoryDialogModel['tone'] = 'default'): void => {
    const line = getElement<HTMLParagraphElement>(document, 'npcLine');
    line.textContent = text;
    line.style.color = tone === 'green' ? '#3f8a4f' : '';
    line.style.animation = 'none';
    void line.offsetWidth;
    line.style.animation = '';
  };

  const renderNode = (node: LegacyDialogueNode): void => {
    if (!activeNpc) return;
    renderLine(node.text);
    const options = node.options.map((option) => ({
      text: option.text,
      onPick: () => {
        option.onPick?.();
        if (!activeNpc) return;
        if (option.next === null) controller.closeNpc();
        else renderNode(activeNpc.profile.dialog[option.next] ?? firstNode(activeNpc));
      },
    }));
    if (node === activeNpc.profile.dialog[0]) {
      const action = optionsForQuest(activeNpc.profile.id);
      if (action) {
        options.unshift({
          text: action.kind === 'offer' ? action.quest.offer.optionLabel : action.quest.completion.optionLabel,
          onPick: () => renderQuestAction(action),
        });
      }
    }
    renderOptions(options);
  };

  const renderQuestAction = (action: NpcQuestAction): void => {
    const copy = action.kind === 'offer' ? action.quest.offer : action.quest.completion;
    renderLine(copy.text);
    renderOptions([
      {
        text: copy.confirmLabel,
        onPick: () => {
          const transition = options.performQuestAction(action, Date.now());
          if (transition.changes.length > 0) {
            options.showToast(`${action.kind === 'offer' ? '任务已接受' : '任务已完成'} · ${action.quest.title}`);
          }
          renderLine(copy.confirmedText);
          renderOptions([
            { text: '继续交谈', onPick: () => activeNpc && renderNode(firstNode(activeNpc)) },
            { text: '告辞', onPick: () => controller.closeNpc() },
          ]);
        },
      },
      { text: '先谈别的', onPick: () => activeNpc && renderNode(firstNode(activeNpc)) },
    ]);
  };

  const optionsForQuest = (npcId: string): NpcQuestAction | null => options.getQuestAction(npcId);

  const controller: CityDialogController = {
    setup() {
      getElement<HTMLButtonElement>(document, 'modalClose').addEventListener('click', controller.closeBuilding, { signal: options.signal });
      getElement<HTMLDivElement>(document, 'modalOverlay').addEventListener('click', (event) => {
        if (event.target === getElement<HTMLDivElement>(document, 'modalOverlay')) controller.closeBuilding();
      }, { signal: options.signal });
      getElement<HTMLButtonElement>(document, 'npcClose').addEventListener('click', controller.closeNpc, { signal: options.signal });
      getElement<HTMLDivElement>(document, 'npcOverlay').addEventListener('click', (event) => {
        if (event.target === getElement<HTMLDivElement>(document, 'npcOverlay')) controller.closeNpc();
      }, { signal: options.signal });
    },
    isOpen: () => npcOpen,
    openBuilding(building) {
      const content = options.buildingContent[building.id] ?? {
        name: building.label || '小城建筑',
        slogan: '这座小城的一角。',
        dialog: ['这里还没有完整的介绍。', '先进去看看吧。'],
      };
      const visitor = options.document.defaultView?.localStorage.getItem('minicityUser') || '旅人';
      getElement<HTMLElement>(document, 'modalNum').textContent = building.num;
      getElement<HTMLElement>(document, 'modalTitle').textContent = content.name;
      getElement<HTMLElement>(document, 'modalSlogan').textContent = content.slogan;
      const body = getElement<HTMLDivElement>(document, 'modalBody');
      body.replaceChildren(...content.dialog.map((line, index) => {
        const paragraph = document.createElement('p');
        paragraph.className = 'modal-line';
        paragraph.textContent = line.replace(/\{Visitor\}/g, visitor);
        paragraph.style.animationDelay = `${0.35 + index * 0.22}s`;
        return paragraph;
      }));
      getElement<HTMLDivElement>(document, 'modalOverlay').classList.add('open');
    },
    closeBuilding() {
      getElement<HTMLDivElement>(document, 'modalOverlay').classList.remove('open');
    },
    openNpc(npc, playerPosition) {
      options.pauseNpcs();
      npcOpen = true;
      activeNpc = npc;
      options.onNpcInteracted(npc.profile.id);
      if (playerPosition) {
        npc.mesh.rotation.y = Math.atan2(playerPosition.x - npc.mesh.position.x, playerPosition.z - npc.mesh.position.z);
      }
      getElement<HTMLElement>(document, 'npcName').textContent = npc.profile.name;
      getElement<HTMLElement>(document, 'npcRole').textContent = npc.profile.role;
      getElement<HTMLElement>(document, 'npcAvatar').style.background = `linear-gradient(135deg,#${npc.profile.head.toString(16).padStart(6, '0')},#${npc.profile.body.toString(16).padStart(6, '0')})`;
      getElement<HTMLDivElement>(document, 'npcOverlay').classList.add('open');
      renderNode(firstNode(npc));
    },
    openStory(story) {
      options.pauseNpcs();
      npcOpen = true;
      activeNpc = null;
      activeStoryClose = story.onClose;
      getElement<HTMLElement>(document, 'npcName').textContent = story.title;
      getElement<HTMLElement>(document, 'npcRole').textContent = story.role ?? '城市见闻';
      getElement<HTMLElement>(document, 'npcAvatar').style.background = story.tone === 'green'
        ? 'linear-gradient(135deg,#8bbf78,#315f49)'
        : 'linear-gradient(135deg,#e9dfc9,#a9a295)';
      getElement<HTMLDivElement>(document, 'npcOverlay').classList.add('open');
      renderLine(story.text, story.tone);
      renderOptions((story.options ?? []).map((item) => ({
        text: item.text,
        onPick: () => { void item.onPick(); },
      })));
    },
    closeNpc() {
      if (!npcOpen) return;
      npcOpen = false;
      activeNpc = null;
      activeStoryClose?.();
      activeStoryClose = undefined;
      getElement<HTMLDivElement>(document, 'npcOverlay').classList.remove('open');
      options.resumeNpcs();
    },
  };

  return controller;
}
