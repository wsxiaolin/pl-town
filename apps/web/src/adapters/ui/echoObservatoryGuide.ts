import type { Camera } from 'three';
import { Vector3 } from 'three';

export function createEchoObservatoryGuide(document: Document, goToObservatory: () => void) {
  const label = document.createElement('a');
  label.className = 'b-label-item echo-location-label';
  label.href = '#';
  label.setAttribute('aria-label', '气象观测站，前往林澈的观测站');
  label.innerHTML = '<span class="bl-icon echo-location-icon" aria-hidden="true">◎</span><span class="bl-name">气象观测站</span>';
  const go = (event: Event) => { event.preventDefault(); goToObservatory(); };
  label.addEventListener('click', go);
  label.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') go(event); });
  document.getElementById('labelsWrap')?.appendChild(label);

  const nav = document.createElement('button');
  nav.className = 'echo-story-nav';
  nav.type = 'button';
  nav.innerHTML = '<span aria-hidden="true">◎</span><span><strong>林澈</strong><small>前往气象观测站</small></span>';
  nav.addEventListener('click', goToObservatory);
  document.body.appendChild(nav);
  const position = new Vector3();
  return {
    update(camera: Camera) {
      position.set(0, 1.8, 55).project(camera);
      label.style.transform = `translate3d(${(position.x * .5 + .5) * window.innerWidth}px,${(-position.y * .5 + .5) * window.innerHeight}px,0) translate(-50%,-50%)`;
    },
    dispose() { label.remove(); nav.remove(); },
  };
}
