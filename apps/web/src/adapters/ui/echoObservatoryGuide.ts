import type { Camera } from 'three';
import { Vector3 } from 'three';
import type { StoryEvent } from '../../gameplay/stories/types';
import { ECHO_OBSERVATORY_AREA } from '../../city/data/cityConfig';

export function createEchoObservatoryGuide(document: Document, goToObservatory: () => void) {
  const label = document.createElement('a');
  label.className = 'b-label-item echo-location-label';
  label.href = '#';
  label.setAttribute('aria-label', '气象观测站，前往林澈的观测站');
  label.innerHTML = '<span class="bl-icon echo-location-icon" aria-hidden="true">◆</span><span class="bl-name">气象观测站</span>';
  const go = (event: Event) => { event.preventDefault(); goToObservatory(); };
  label.addEventListener('click', go);
  label.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') go(event); });
  document.getElementById('labelsWrap')?.appendChild(label);

  const nav = document.createElement('button');
  nav.className = 'echo-story-nav';
  nav.type = 'button';
  nav.innerHTML = '<span class="echo-guide-mark" aria-hidden="true"></span><span><strong>回声 · 相遇</strong><small>前往气象观测站寻找林澈</small></span>';
  nav.addEventListener('click', goToObservatory);
  document.body.appendChild(nav);
  const position = new Vector3();

  return {
    update(camera: Camera) {
      position.set(ECHO_OBSERVATORY_AREA.linche[0], 1.8, ECHO_OBSERVATORY_AREA.linche[1]).project(camera);
      label.style.transform = `translate3d(${(position.x * .5 + .5) * window.innerWidth}px,${(-position.y * .5 + .5) * window.innerHeight}px,0) translate(-50%,-50%)`;
    },
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
    dispose() { label.remove(); nav.remove(); },
  };
}
