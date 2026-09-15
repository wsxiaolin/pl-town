import type { StoryEvent } from '../../gameplay/stories/types';

/**
 * 左上角剧情任务指引（HUD）。
 *
 * 全局只有一个 `.echo-story-nav` 元素，供所有剧情共用。每条剧情通过
 * `story.guide.updated` / `story.guide.cleared`（payload 携带 `storyId`）
 * 更新或清除指引；由于同一时间只允许一条剧情处于进行中，指引只展示
 * 当前进行中剧情的内容，其它剧情的 cleared 事件不会误清除它。
 *
 * 指引在玩家真正进入剧情前保持隐藏，剧情结束后自动隐藏。
 */
export function createStoryTaskGuide(
  document: Document,
  options: { onNavigate?: (storyId: string | null) => void } = {},
) {
  const nav = document.createElement('button');
  nav.className = 'echo-story-nav';
  nav.type = 'button';
  // 初始隐藏；首个 story.guide.updated 才会填充内容并显示。
  nav.hidden = true;
  nav.innerHTML = '<span class="echo-guide-mark" aria-hidden="true"></span><span><strong></strong><small></small></span>';
  let currentStoryId: string | null = null;
  nav.addEventListener('click', () => options.onNavigate?.(currentStoryId));
  document.body.appendChild(nav);

  const payloadStoryId = (event: StoryEvent): string | null =>
    typeof event.payload?.storyId === 'string' ? event.payload.storyId : null;

  return {
    update(_camera: unknown) {},
    applyEvent(event: StoryEvent) {
      if (event.type === 'story.guide.cleared') {
        const storyId = payloadStoryId(event);
        // 忽略其它剧情发出的 cleared，避免正在进行中的指引被误清除。
        if (storyId !== null && currentStoryId !== null && storyId !== currentStoryId) return;
        nav.hidden = true;
        currentStoryId = null;
        return;
      }
      if (event.type !== 'story.guide.updated') return;
      currentStoryId = payloadStoryId(event);
      nav.hidden = false;
      const title = event.payload?.title;
      const objective = event.payload?.objective;
      if (typeof title === 'string') nav.querySelector('strong')!.textContent = title;
      if (typeof objective === 'string') nav.querySelector('small')!.textContent = objective;
    },
    dispose() { nav.remove(); },
  };
}

let activeGuide: ReturnType<typeof createStoryTaskGuide> | null = null;

/** 初始化全局唯一的剧情任务指引（应用启动时调用一次）。 */
export function initStoryTaskGuide(
  document: Document,
  options: { onNavigate?: (storyId: string | null) => void } = {},
): void {
  activeGuide?.dispose();
  activeGuide = createStoryTaskGuide(document, options);
}

/** 供剧情流程转发的指引事件入口。 */
export function publishStoryGuideEvent(event: StoryEvent): void {
  activeGuide?.applyEvent(event);
}
