import type { NpcQuestAction, QuestTransition } from '../../gameplay/quests/types';

export interface LegacyDialogueOption {
  text: string;
  next: number | null;
  onPick?: () => void;
  action?: string;
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
  dialogTree?: readonly LegacyDialogueNode[];
  dialogAvatar?: readonly [number, number];
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
  title?: string | null;
  role?: string | null;
  text: string;
  tone?: 'default' | 'green';
  variant?: 'default' | 'story' | 'cg' | 'blackout';
  image?: string;
  options?: readonly StoryDialogOption[];
  onAdvance?: () => void;
  onClose?: () => void;
}

export interface LyricsLineLike {
  kind: 'verse' | 'chorus' | 'quote' | 'note' | 'gap';
  text: string;
}

export interface MusicHallLyricsLike {
  title: string;
  subtitle: string;
  dedication: string;
  lines: readonly LyricsLineLike[];
}

export interface CityDialogControllerOptions {
  document: Document;
  buildingContent: Readonly<Record<string, BuildingContentLike>>;
  getQuestAction: (npcId: string) => NpcQuestAction | null;
  performQuestAction: (action: NpcQuestAction, at: number) => QuestTransition;
  onNpcInteracted: (npcId: string) => void;
  onDialogueAction?: (action: string, sourceId: string) => void;
  pauseNpcs: () => void;
  resumeNpcs: () => void;
  showToast: (message: string) => void;
  musicHallLyrics?: MusicHallLyricsLike;
  signal?: AbortSignal;
}

export interface CityDialogController {
  setup(): void;
  isOpen(): boolean;
  openBuilding(building: BuildingLike): void;
  closeBuilding(): void;
  closeLyrics(): void;
  openNpc(npc: NpcEntityLike, playerPosition?: { x: number; z: number }): void;
  openStory(story: StoryDialogModel): void;
  closeNpc(): void;
}

function getElement<T extends HTMLElement>(document: Document, id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing city dialog element #${id}`);
  return element as T;
}

function setIdentityField(document: Document, id: string, value: string | null | undefined): void {
  const element = getElement<HTMLElement>(document, id);
  const text = value ?? '';
  element.textContent = text;
  element.hidden = text.trim().length === 0;
}

export function createCityDialogController(options: CityDialogControllerOptions): CityDialogController {
  const { document } = options;
  let npcOpen = false;
  let activeNpc: NpcEntityLike | null = null;
  let activeStoryClose: (() => void) | undefined;
  let activeStoryAdvance: (() => void) | undefined;
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
    const dialogOptions = node.options.map((option) => ({
      text: option.text,
      onPick: () => {
        if (option.action) options.onDialogueAction?.(option.action, activeNpc?.profile.id ?? '');
        option.onPick?.();
        if (!activeNpc) return;
        if (option.next === null) controller.closeNpc();
        else renderNode(activeNpc.profile.dialog[option.next] ?? firstNode(activeNpc));
      },
    }));
    if (node === activeNpc.profile.dialog[0]) {
      const action = optionsForQuest(activeNpc.profile.id);
      if (action) {
        dialogOptions.unshift({
          text: action.kind === 'offer' ? action.quest.offer.optionLabel : action.quest.completion.optionLabel,
          onPick: () => renderQuestAction(action),
        });
      }
    }
    renderOptions(dialogOptions);
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

  const openDialogue = (npc: NpcEntityLike, recordInteraction: boolean, playerPosition?: { x: number; z: number }): void => {
    options.pauseNpcs();
    npcOpen = true;
    activeNpc = npc;
    activeStoryAdvance = undefined;
    if (recordInteraction) options.onNpcInteracted(npc.profile.id);
    if (playerPosition) {
      npc.mesh.rotation.y = Math.atan2(playerPosition.x - npc.mesh.position.x, playerPosition.z - npc.mesh.position.z);
    }
    setIdentityField(document, 'npcName', npc.profile.name);
    setIdentityField(document, 'npcRole', npc.profile.role);
    getElement<HTMLElement>(document, 'npcAvatar').style.background = `linear-gradient(135deg,#${npc.profile.head.toString(16).padStart(6, '0')},#${npc.profile.body.toString(16).padStart(6, '0')})`;
    const overlay = getElement<HTMLDivElement>(document, 'npcOverlay');
    overlay.classList.remove('story-mode', 'cg-mode', 'blackout-mode');
    overlay.style.removeProperty('--story-cg-image');
    overlay.classList.add('open');
    const npcLine = getElement<HTMLParagraphElement>(document, 'npcLine');
    npcLine.onclick = null;
    npcLine.style.cursor = '';
    renderNode(firstNode(npc));
  };

  const openLyrics = (): void => {
    const lyrics = options.musicHallLyrics;
    if (!lyrics) return;
    setIdentityField(document, 'lyricsTitle', lyrics.title);
    setIdentityField(document, 'lyricsSubtitle', lyrics.subtitle);
    setIdentityField(document, 'lyricsDedication', lyrics.dedication);
    const scroll = getElement<HTMLDivElement>(document, 'lyricsScroll');
    scroll.replaceChildren();
    let rowIndex = 0;
    lyrics.lines.forEach((line) => {
      if (line.kind === 'gap') {
        const gap = document.createElement('div');
        gap.className = 'lyrics-gap';
        scroll.appendChild(gap);
        return;
      }
      const paragraph = document.createElement('p');
      paragraph.className = `lyrics-line lyrics-${line.kind}`;
      paragraph.textContent = line.text;
      paragraph.style.animationDelay = `${Math.min(rowIndex, 14) * 0.09}s`;
      scroll.appendChild(paragraph);
      rowIndex += 1;
    });
    getElement<HTMLDivElement>(document, 'lyricsOverlay').classList.add('open');
  };

  const controller: CityDialogController = {
    setup() {
      getElement<HTMLButtonElement>(document, 'modalClose').addEventListener('click', controller.closeBuilding, { signal: options.signal });
      getElement<HTMLDivElement>(document, 'modalOverlay').addEventListener('click', (event) => {
        if (event.target === getElement<HTMLDivElement>(document, 'modalOverlay')) controller.closeBuilding();
      }, { signal: options.signal });
      getElement<HTMLButtonElement>(document, 'lyricsClose').addEventListener('click', controller.closeLyrics, { signal: options.signal });
      getElement<HTMLDivElement>(document, 'lyricsOverlay').addEventListener('click', (event) => {
        if (event.target === getElement<HTMLDivElement>(document, 'lyricsOverlay')) controller.closeLyrics();
      }, { signal: options.signal });
      getElement<HTMLButtonElement>(document, 'npcClose').addEventListener('click', controller.closeNpc, { signal: options.signal });
      getElement<HTMLDivElement>(document, 'npcOverlay').addEventListener('click', (event) => {
        const target = event.target as HTMLElement;
        if (activeStoryAdvance && !target.closest('button')) {
          activeStoryAdvance();
          return;
        }
        if (!activeStoryAdvance && event.target === getElement<HTMLDivElement>(document, 'npcOverlay')) controller.closeNpc();
      }, { signal: options.signal });
    },
    isOpen: () => npcOpen,
    openBuilding(building) {
      if (building.id === 'musichall' && options.musicHallLyrics?.lines.length) {
        openLyrics();
        return;
      }
      const content = options.buildingContent[building.id] ?? {
        name: building.label || '小城建筑',
        slogan: '这座小城的一角。',
        dialog: ['这里还没有完整的介绍。', '先进去看看吧。'],
      };
      if (content.dialogTree?.length) {
        const [head, bodyColor] = content.dialogAvatar ?? [0xe6c59c, 0x9b633b];
        openDialogue({
          profile: { id: `building:${building.id}`, name: content.name, role: content.slogan, head, body: bodyColor, dialog: content.dialogTree },
          mesh: { rotation: { y: 0 }, position: { x: 0, z: 0 } },
        }, false);
        return;
      }
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
    closeLyrics() {
      getElement<HTMLDivElement>(document, 'lyricsOverlay').classList.remove('open');
    },
    openNpc(npc, playerPosition) {
      openDialogue(npc, true, playerPosition);
    },
    openStory(story) {
      options.pauseNpcs();
      npcOpen = true;
      activeNpc = null;
      activeStoryClose = story.onClose;
      activeStoryAdvance = story.onAdvance;
      setIdentityField(document, 'npcName', story.title);
      setIdentityField(document, 'npcRole', story.role);
      getElement<HTMLElement>(document, 'npcAvatar').style.background = story.tone === 'green'
        ? 'linear-gradient(135deg,#8bbf78,#315f49)'
        : 'linear-gradient(135deg,#e9dfc9,#a9a295)';
      const overlay = getElement<HTMLDivElement>(document, 'npcOverlay');
      overlay.classList.toggle('story-mode', story.variant === 'story' || story.variant === 'cg' || story.variant === 'blackout');
      overlay.classList.toggle('cg-mode', story.variant === 'cg');
      overlay.classList.toggle('blackout-mode', story.variant === 'blackout');
      overlay.style.setProperty('--story-cg-image', story.image ? `url("${story.image}")` : 'none');
      overlay.classList.add('open');
      renderLine(story.text, story.tone);
      const storyLine = getElement<HTMLParagraphElement>(document, 'npcLine');
      storyLine.onclick = null;
      storyLine.style.cursor = story.onAdvance ? 'pointer' : '';
      renderOptions((story.options ?? []).map((item) => ({
        text: item.text,
        onPick: () => { void item.onPick(); },
      })));
    },
    closeNpc() {
      if (!npcOpen) return;
      npcOpen = false;
      activeNpc = null;
      activeStoryAdvance = undefined;
      activeStoryClose?.();
      activeStoryClose = undefined;
      getElement<HTMLDivElement>(document, 'npcOverlay').classList.remove('open');
      options.resumeNpcs();
    },
  };

  return controller;
}
