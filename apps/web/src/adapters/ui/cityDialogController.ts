import type { NpcQuestAction, QuestTransition } from '../../gameplay/quests/types';

export interface LegacyDialogueOption {
  text: string;
  next: number | null;
  onPick?: () => void;
  action?: string;
  nextByVisitor?: {
    includes: readonly string[];
    maxLength?: number;
    next: number;
  };
}

export interface LegacyDialogueNode {
  speaker?: string;
  text: string;
  options: readonly LegacyDialogueOption[];
}

export interface NpcEntityLike {
  profile: {
    id: string;
    name: string;
    role?: string;
    head: number;
    body: number;
    transitionDelayMs?: number;
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
  presentation?: {
    typewriter?: boolean;
    optionStaggerMs?: number;
    selectionDelayMs?: number;
  };
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

export interface MemorialRosterLike {
  title: string;
  subtitle: readonly string[];
  names: readonly string[];
}

export interface CityDialogControllerOptions {
  document: Document;
  buildingContent: Readonly<Record<string, BuildingContentLike>>;
  getQuestAction: (npcId: string) => NpcQuestAction | null;
  performQuestAction: (action: NpcQuestAction, at: number) => QuestTransition;
  isConstructionPending?: (buildingId: string) => boolean;
  onNpcInteracted: (npcId: string) => void;
  onDialogueAction?: (action: string, sourceId: string) => void;
  pauseNpcs: () => void;
  resumeNpcs: () => void;
  showToast: (message: string) => void;
  musicHallLyrics?: MusicHallLyricsLike;
  memorialRoster?: MemorialRosterLike;
  signal?: AbortSignal;
}

export interface CityDialogController {
  setup(): void;
  isOpen(): boolean;
  openBuilding(building: BuildingLike): void;
  closeBuilding(): void;
  closeLyrics(): void;
  openMemorial(beforeOpen?: () => void): void;
  closeMemorial(): void;
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

// Story CG backgrounds are interpolated into a CSS url() custom property, so
// the raw string must be validated before it reaches the style engine: quotes,
// parentheses, backslashes or whitespace could break out of the url() token
// and inject arbitrary CSS (CSS injection, CWE-79). Allowed shapes are https
// URLs, same-origin relative/absolute paths (never protocol-relative
// "//host/…") and base64 data: images; any other URL scheme is rejected and
// everything else falls back to `none`.
const storyCgImage = (image: string | undefined): string => {
  const value = image?.trim() ?? '';
  if (value.length === 0 || value.length > 8192) return 'none';
  if (/[\s"'()\\]/.test(value)) return 'none';
  if (value.startsWith('//')) return 'none';
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=]+$/i.test(value)) return `url("${value}")`;
  if (/^https:\/\//i.test(value)) return `url("${value}")`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return 'none';
  return `url("${value}")`;
};

export function createCityDialogController(options: CityDialogControllerOptions): CityDialogController {
  const { document } = options;
  let npcOpen = false;
  let activeNpc: NpcEntityLike | null = null;
  let activeStoryClose: (() => void) | undefined;
  let activeStoryAdvance: (() => void) | undefined;
  let optionRevealTimer: number | undefined;
  const firstNode = (npc: NpcEntityLike): LegacyDialogueNode => npc.profile.dialog[0] ?? { text: '……', options: [] };

  const clearOptionRevealTimer = (): void => {
    if (optionRevealTimer === undefined) return;
    window.clearTimeout(optionRevealTimer);
    optionRevealTimer = undefined;
  };

  const renderOptions = (
    items: readonly { text: string; onPick: (button: HTMLButtonElement) => void }[],
    revealAfterMs = 0,
    staggerMs = 0,
  ): void => {
    const wrapper = getElement<HTMLDivElement>(document, 'npcOptions');
    clearOptionRevealTimer();
    wrapper.replaceChildren();
    if (revealAfterMs > 0 && items.length > 0) {
      wrapper.classList.add('npc-options-waiting');
      optionRevealTimer = window.setTimeout(() => {
        optionRevealTimer = undefined;
        renderOptions(items, 0, staggerMs);
      }, revealAfterMs);
      return;
    }
    wrapper.classList.remove('npc-options-waiting');
    items.forEach((item, index) => {
      const button = document.createElement('button');
      button.className = staggerMs > 0 ? 'npc-opt npc-opt-revealing' : 'npc-opt';
      button.textContent = item.text;
      if (staggerMs > 0) button.style.animationDelay = `${index * staggerMs}ms`;
      button.addEventListener('click', () => item.onPick(button));
      wrapper.appendChild(button);
    });
  };

  const renderLine = (text: string, tone: StoryDialogModel['tone'] = 'default', typewriter = false): number => {
    const line = getElement<HTMLParagraphElement>(document, 'npcLine');
    line.style.color = tone === 'green' ? '#3f8a4f' : '';
    if (!typewriter) {
      line.textContent = text;
      return 0;
    }
    const characters = Array.from(text);
    const stepMs = Math.min(90, 3600 / Math.max(characters.length - 1, 1)) * 1.5;
    line.replaceChildren(...characters.map((character, index) => {
      if (character === '\n') return document.createElement('br');
      const span = document.createElement('span');
      span.className = 'npc-line-char';
      span.textContent = character;
      span.style.animationDelay = `${index * stepMs}ms`;
      return span;
    }));
    if (characters.length === 0) return 0;
    return (characters.length - 1) * stepMs + 975;
  };

  const renderNode = (node: LegacyDialogueNode): void => {
    if (!activeNpc) return;
    setIdentityField(document, 'npcName', node.speaker ?? activeNpc.profile.name);
    renderLine(node.text);
    const visitor = options.document.defaultView?.localStorage.getItem('minicityUser') || '旅人';
    const dialogOptions = node.options.map((option) => ({
      text: option.text,
      onPick: (selectedButton: HTMLButtonElement) => {
        const sourceNpc = activeNpc;
        if (!sourceNpc) return;
        const advance = () => {
          if (activeNpc !== sourceNpc) return;
          if (option.action) options.onDialogueAction?.(option.action, sourceNpc.profile.id);
          option.onPick?.();
          if (activeNpc !== sourceNpc) return;
          const visitorBranch = option.nextByVisitor;
          const visitorMatches = visitorBranch
            && visitorBranch.includes.some((name) => visitor.includes(name))
            && (visitorBranch.maxLength === undefined || visitor.length <= visitorBranch.maxLength);
          const next = visitorMatches ? visitorBranch.next : option.next;
          if (next === null) controller.closeNpc();
          else renderNode(sourceNpc.profile.dialog[next] ?? firstNode(sourceNpc));
        };
        const transitionDelayMs = sourceNpc.profile.transitionDelayMs ?? 0;
        if (transitionDelayMs > 0) {
          selectedButton.classList.add('npc-opt-selected');
          selectedButton.parentElement?.classList.add('npc-options-waiting');
          window.setTimeout(advance, transitionDelayMs);
        } else advance();
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

  const questConstructionHint = (action: NpcQuestAction): string => {
    if (action.kind !== 'offer') return '';
    // An offer describes the first actionable stage, not later objectives that
    // may only become relevant after the resident advances the quest.
    const pendingNames = new Set<string>();
    for (const objective of action.quest.stages[0]?.objectives ?? []) {
      const target = objective.target;
      if (target.type !== 'building.visited' || !options.isConstructionPending?.(target.buildingId)) continue;
      pendingNames.add(options.buildingContent[target.buildingId]?.name ?? target.buildingId);
    }
    return pendingNames.size > 0
      ? `\n\n${[...pendingNames].map((name) => `「${name}」`).join('、')}尚未建成，请前往众议院参与募捐，建成后再继续任务。`
      : '';
  };

  const renderQuestAction = (action: NpcQuestAction): void => {
    const copy = action.kind === 'offer' ? action.quest.offer : action.quest.completion;
    renderLine(copy.text + questConstructionHint(action));
    renderOptions([
      {
        text: copy.confirmLabel,
        onPick: () => {
          const transition = options.performQuestAction(action, Date.now());
          if (transition.changes.length > 0) {
            options.showToast(`${action.kind === 'offer' ? '任务已接受' : '任务已完成'} · ${action.quest.title}`);
          }
          // Retain an offer's construction guidance after acceptance; completed
          // quests intentionally have no pending first-stage guidance.
          renderLine(copy.confirmedText + questConstructionHint(action));
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
    getElement<HTMLDivElement>(document, 'lyricsOverlay').classList.add('open');
  };

  const MEMORIAL_NAMES_PER_PAGE = 30;
  let memorialIndex = 0;
  let memorialPageCount = 1;
  let memorialOpen = false;
  let memorialReturnFocus: HTMLElement | null = null;
  const memorialBackground = new Map<HTMLElement, boolean>();

  const restoreMemorialBackground = (): void => {
    memorialBackground.forEach((inert, element) => { element.inert = inert; });
    memorialBackground.clear();
  };

  const renderMemorialPage = (roster: MemorialRosterLike): void => {
    const body = getElement<HTMLDivElement>(document, 'memorialBody');
    const start = memorialIndex * MEMORIAL_NAMES_PER_PAGE;
    const slice = roster.names.slice(start, start + MEMORIAL_NAMES_PER_PAGE);
    body.replaceChildren(
      ...slice.map((name) => {
        const entry = document.createElement('p');
        entry.className = 'memorial-name';
        entry.textContent = name;
        return entry;
      }),
    );
    getElement<HTMLButtonElement>(document, 'memorialPrev').disabled = memorialIndex <= 0;
    getElement<HTMLButtonElement>(document, 'memorialNext').disabled = memorialIndex >= memorialPageCount - 1;
    getElement<HTMLSpanElement>(document, 'memorialPager').textContent = `${memorialIndex + 1} / ${memorialPageCount}`;
  };

  const openMemorial = (beforeOpen?: () => void): void => {
    const roster = options.memorialRoster;
    if (!roster || memorialOpen) return;
    // Close the source panel only when this destination exists, before capturing
    // its restored focus so closing the memorial returns to the archive button.
    beforeOpen?.();
    memorialReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    memorialPageCount = Math.max(1, Math.ceil(roster.names.length / MEMORIAL_NAMES_PER_PAGE));
    memorialIndex = 0;
    setIdentityField(document, 'memorialTitle', roster.title);
    getElement<HTMLDivElement>(document, 'memorialSubtitle').replaceChildren(
      ...roster.subtitle.map((line) => {
        const node = document.createElement('p');
        node.className = 'memorial-subtitle-line';
        node.textContent = line;
        return node;
      }),
    );
    renderMemorialPage(roster);
    const overlay = getElement<HTMLDivElement>(document, 'memorialOverlay');
    // Keep the existing overlay, but make its modal semantics real for pointer,
    // keyboard and assistive technology users. Preserve pre-existing inert state.
    for (const sibling of overlay.parentElement?.children ?? []) {
      if (!(sibling instanceof HTMLElement) || sibling === overlay) continue;
      memorialBackground.set(sibling, sibling.inert);
      sibling.inert = true;
    }
    memorialOpen = true;
    overlay.inert = false;
    overlay.classList.add('open');
    getElement<HTMLButtonElement>(document, 'memorialClose').focus();
  };

  const controller: CityDialogController = {
    setup() {
      getElement<HTMLButtonElement>(document, 'modalClose').addEventListener('click', controller.closeBuilding, { signal: options.signal });
      getElement<HTMLDivElement>(document, 'modalOverlay').addEventListener('click', (event) => {
        if (event.target === getElement<HTMLDivElement>(document, 'modalOverlay')) controller.closeBuilding();
      }, { signal: options.signal });
      getElement<HTMLDivElement>(document, 'lyricsOverlay').addEventListener('click', (event) => {
        if (event.target === getElement<HTMLDivElement>(document, 'lyricsOverlay')) controller.closeLyrics();
      }, { signal: options.signal });
      getElement<HTMLDivElement>(document, 'memorialOverlay').addEventListener('click', (event) => {
        if (event.target === getElement<HTMLDivElement>(document, 'memorialOverlay')) controller.closeMemorial();
      }, { signal: options.signal });
      getElement<HTMLButtonElement>(document, 'memorialClose').addEventListener('click', controller.closeMemorial, { signal: options.signal });
      const memorialOverlay = getElement<HTMLDivElement>(document, 'memorialOverlay');
      document.addEventListener('keydown', (event) => {
        if (!memorialOpen) return;
        // Keep every key away from global city shortcuts. Memorial controls use
        // native button defaults, not target keydown handlers; defaults still run.
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          controller.closeMemorial();
          return;
        }
        if (event.key !== 'Tab') return;
        // Paging can disable the focused navigation button. Recompute the
        // enabled controls so both boundary pages keep focus inside the dialog.
        const controls = [...memorialOverlay.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')];
        const index = controls.indexOf(document.activeElement as HTMLElement);
        const destination = event.shiftKey ? controls.at(-1) : controls[0];
        if (destination && (index < 0 || (event.shiftKey ? index === 0 : index === controls.length - 1))) {
          event.preventDefault();
          destination.focus();
        }
      }, { signal: options.signal, capture: true });
      document.addEventListener('focusin', (event) => {
        if (memorialOpen && !memorialOverlay.contains(event.target as Node)) {
          getElement<HTMLButtonElement>(document, 'memorialClose').focus();
        }
      }, { signal: options.signal });
      options.signal?.addEventListener('abort', () => {
        memorialOpen = false;
        memorialOverlay.classList.remove('open');
        memorialOverlay.inert = true;
        restoreMemorialBackground();
        memorialReturnFocus = null;
      }, { once: true });
      getElement<HTMLButtonElement>(document, 'memorialPrev').addEventListener('click', () => {
        const roster = options.memorialRoster;
        if (!roster || memorialIndex <= 0) return;
        memorialIndex -= 1;
        renderMemorialPage(roster);
      }, { signal: options.signal });
      getElement<HTMLButtonElement>(document, 'memorialNext').addEventListener('click', () => {
        const roster = options.memorialRoster;
        if (!roster || memorialIndex >= memorialPageCount - 1) return;
        memorialIndex += 1;
        renderMemorialPage(roster);
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
    isOpen: () => npcOpen || memorialOpen,
    openBuilding(building) {
      if (building.id === 'musichall' && options.musicHallLyrics) {
        openLyrics();
        return;
      }
      if (building.id === 'elevator' && options.memorialRoster) {
        openMemorial();
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
    openMemorial,
    closeMemorial() {
      memorialOpen = false;
      const overlay = getElement<HTMLDivElement>(document, 'memorialOverlay');
      overlay.classList.remove('open');
      overlay.inert = true;
      restoreMemorialBackground();
      if (memorialReturnFocus?.isConnected) memorialReturnFocus.focus();
      memorialReturnFocus = null;
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
      overlay.style.setProperty('--story-cg-image', storyCgImage(story.image));
      overlay.classList.add('open');
      const lineRevealMs = renderLine(story.text, story.tone, story.presentation?.typewriter);
      const storyLine = getElement<HTMLParagraphElement>(document, 'npcLine');
      storyLine.onclick = null;
      storyLine.style.cursor = story.onAdvance ? 'pointer' : '';
      renderOptions((story.options ?? []).map((item) => ({
        text: item.text,
        onPick: (selectedButton: HTMLButtonElement) => {
          const selectionDelayMs = story.presentation?.selectionDelayMs ?? 0;
          if (selectionDelayMs <= 0) { void item.onPick(); return; }
          selectedButton.classList.add('npc-opt-selected');
          selectedButton.parentElement?.classList.add('npc-options-waiting');
          window.setTimeout(() => { void item.onPick(); }, selectionDelayMs);
        },
      })), story.presentation?.typewriter ? lineRevealMs : 0, story.presentation?.optionStaggerMs ?? 0);
    },
    closeNpc() {
      if (!npcOpen) return;
      clearOptionRevealTimer();
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
