import { gsap } from 'gsap';
import { destroyCG, initCG } from './cg';
import { destroyMusterCG } from './musterCg';
import { stopInvasionCG } from './invasionCg';
import { preloadTextureResources } from './textureResourcePreloader';
import { readRenderSettings } from '../rendering/createRenderer';
import { disposeCityGovernance, loadCityGovernance } from './cityGovernanceClient';
import { closeCityGovernancePanel, disposeCityGovernancePanel } from '../adapters/ui/cityGovernancePanel';

export function createCityRuntimeLifecycle(options: {
  reduced: boolean;
  isNight: () => boolean;
  initCity: () => void;
  showLogin: () => void;
  disposeSession: () => void;
  onIntroFinished: () => void;
}) {
  let started = false;
  let downloadStarted = false;
  let eventController = new AbortController();

  /** Mount the runtime shell and wait for the resident to register or log in. */
  function start() {
    if (started) return;
    started = true;
    eventController = new AbortController();
    window.addEventListener('minicity:login-required', options.showLogin, { signal: eventController.signal });
    document.body.classList.remove('day', 'night');
    document.body.classList.add(options.isNight() ? 'night' : 'day');
  }

  /**
   * Begin downloading the city assets and play the opening CG. Only called
   * after the identity is confirmed, so unauthenticated visitors never spend
   * bandwidth on the city resources.
   */
  function startDownload() {
    if (!started || downloadStarted) return;
    downloadStarted = true;
    const boot = () => {
      if (!started) return;
      void loadCityGovernance(eventController.signal).finally(() => {
        if (!started) return;
        try { options.initCity(); } catch (error) { console.error('City initialization failed', error); }
        window.dispatchEvent(new CustomEvent('minicity:city-ready'));
      });
    };
    void preloadTextureResources(readRenderSettings().textureRendering, eventController.signal).then(boot).catch(boot);
    initCG({
      onFinish: () => { if (started) options.onIntroFinished(); },
      reduced: options.reduced,
    });
  }

  function destroy() {
    if (!started) return;
    started = false;
    downloadStarted = false;
    options.disposeSession();
    closeCityGovernancePanel();
    disposeCityGovernancePanel();
    disposeCityGovernance();
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
    startDownload,
    destroy,
  };
}
