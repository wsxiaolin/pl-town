import { gsap } from 'gsap';
import { destroyCG, initCG } from './cg';
import { destroyMusterCG } from './musterCg';
import { stopInvasionCG } from './invasionCg';
import { preloadTextureResources } from './textureResourcePreloader';
import { readRenderSettings } from '../rendering/createRenderer';
import { showUnlockToast } from './toast';

export function createCityRuntimeLifecycle(options: {
  reduced: boolean;
  isNight: () => boolean;
  initCity: () => void;
  startTutorial: () => void;
  proceedToCity: () => void;
  showLogin: () => void;
  disposeSession: () => void;
}) {
  let started = false;
  let eventController = new AbortController();

  function start() {
    if (started) return;
    started = true;
    eventController = new AbortController();
    const boot = () => {
      if (!started) return;
      try { options.initCity(); } catch (error) { console.error('City initialization failed', error); }
      window.dispatchEvent(new CustomEvent('minicity:city-ready'));
      options.startTutorial();
    };
    void preloadTextureResources(readRenderSettings().textureRendering, eventController.signal).then(boot).catch(boot);
    initCG({
      onFinish: () => {
        showUnlockToast('全屏效果更好哦');
        if (localStorage.getItem('minicityUser')) options.proceedToCity();
        else options.showLogin();
      },
      reduced: options.reduced,
    });
    document.body.classList.remove('day', 'night');
    document.body.classList.add(options.isNight() ? 'night' : 'day');
  }

  function destroy() {
    if (!started) return;
    started = false;
    options.disposeSession();
    destroyCG();
    stopInvasionCG();
    destroyMusterCG();
    eventController.abort();
    gsap.globalTimeline.clear();
    document.getElementById('labelsWrap')?.replaceChildren();
    document.getElementById('mapIcons')?.replaceChildren();
  }

  return {
    get started() { return started; },
    get signal() { return eventController.signal; },
    start,
    destroy,
  };
}
