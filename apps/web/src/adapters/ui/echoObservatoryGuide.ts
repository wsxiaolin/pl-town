import type { StoryEvent } from '../../gameplay/stories/types';

export function createEchoObservatoryGuide(document: Document, goToObservatory: () => void) {
  const nav = document.createElement('button');
  nav.className = 'echo-story-nav';
  nav.type = 'button';
  nav.innerHTML = '<span class="echo-guide-mark" aria-hidden="true"></span><span><strong>回声 · 相遇</strong><small>前往气象观测站寻找林澈</small></span>';
  nav.addEventListener('click', goToObservatory);
  document.body.appendChild(nav);

  return {
    update(_camera: unknown) {},
    applyEvent(event: StoryEvent) {
      if (event.type === 'story.guide.cleared') {
        nav.hidden = true;
        return;
      }
      if (event.type !== 'story.guide.updated') return;
      nav.hidden = false;
      const title = event.payload?.title;
      const objective = event.payload?.objective;
      if (typeof title === 'string') nav.querySelector('strong')!.textContent = title;
      if (typeof objective === 'string') nav.querySelector('small')!.textContent = objective;
    },
    dispose() { nav.remove(); },
  };
}
