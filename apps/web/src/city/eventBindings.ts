import { setupRenderSettingsController } from '../adapters/ui/renderSettingsController';
import { bindCityUiEvents } from '../adapters/ui/cityEventBindings';

export type EventBindingsOptions = {
  getCanvas: () => HTMLElement;
  getSignal: () => AbortSignal;
  getRenderer: () => { capabilities: { getMaxAnisotropy: () => number; maxTextureSize: number }; setSize: (w: number, h: number) => void };
  onMouseMove: (e: MouseEvent) => void;
  onCanvasClick: (e: MouseEvent) => void;
  clamp: (value: number, min: number, max: number) => number;
  getCameraZoom: () => number;
  setCameraZoom: (value: number) => void;
  updateCameraProjection: (vs: number) => void;
  getConfig: () => { cameraZoomMin: number; cameraZoomMax: number };
  onYouClick: () => void;
  closeRenderSettings: () => void;
  getStatsPanelController: () => { close: () => void; setMode: (mode: any) => void } | null;
  getCommunityPanels: () => {
    closeWorksPanel: () => void;
    closeWorkDetail: () => void;
    toggleWorkStar: () => any;
    loadWorkComments: () => any;
    loadWorkDerivatives: () => any;
    loadWorkSupporters: () => any;
    toggleWorkSupport: () => any;
    postWorkComment: (event: any) => any;
  } | null;
  getMapController: () => { isOpen: () => boolean; updateImage: () => void } | null;
  getWriterCatalogController: () => { open: () => void; close: () => void } | null;
  toggleMapMode: () => void;
  closeModal: () => void;
  closeNpcDialog: () => void;
  getLoginController: () => { login: () => void; validateInput: () => void; showLogin: () => void } | null;
};

export function createEventBindings(options: EventBindingsOptions) {
  function setupRenderSettings(signal: AbortSignal) {
    const renderer = options.getRenderer();
    setupRenderSettingsController({
      signal,
      maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
      maxTextureSize: renderer.capabilities.maxTextureSize,
      close: options.closeRenderSettings,
    });
  }

  function closeRenderSettings() {
    const panel = document.getElementById('renderSettings');
    const toggle = document.getElementById('renderSettingsToggle');
    panel?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  function setupEvents() {
    const canvas = options.getCanvas();
    const signal = options.getSignal();
    canvas.addEventListener('mousemove', options.onMouseMove, { signal });
    canvas.addEventListener('click', options.onCanvasClick, { signal });
    canvas.addEventListener('mouseenter', () => {}, { signal });
    canvas.addEventListener('mouseleave', () => {}, { signal });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      const zoom = options.clamp(options.getCameraZoom() * factor, options.getConfig().cameraZoomMin, options.getConfig().cameraZoomMax);
      options.setCameraZoom(zoom);
      options.updateCameraProjection(zoom);
    }, { passive: false, signal });

    let pinchDist = 0;
    const pinchDistance = (touches: TouchList) => {
      const a = touches[0], b = touches[1];
      if (!a || !b) return 0;
      return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    };
    canvas.addEventListener('touchstart', e => {
      if (e.touches.length === 2) pinchDist = pinchDistance(e.touches);
    }, { passive: true, signal });
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = pinchDistance(e.touches);
        if (pinchDist > 0) {
          const zoom = options.clamp(options.getCameraZoom() * pinchDist / d, options.getConfig().cameraZoomMin, options.getConfig().cameraZoomMax);
          options.setCameraZoom(zoom);
          options.updateCameraProjection(zoom);
        }
        pinchDist = d;
      }
    }, { passive: false, signal });

    setupRenderSettings(signal);
    const communityPanels = options.getCommunityPanels();
    bindCityUiEvents({
      signal, closeRenderSettings, onYouClick: options.onYouClick,
      closeStats: () => options.getStatsPanelController()?.close(),
      setStatsMode: (mode) => options.getStatsPanelController()?.setMode(mode),
      closeWorks: () => communityPanels?.closeWorksPanel(),
      closeWriterCatalog: () => options.getWriterCatalogController()?.close(),
      closeWorkDetail: () => communityPanels?.closeWorkDetail(),
      toggleWorkStar: () => communityPanels?.toggleWorkStar(),
      loadWorkComments: () => communityPanels?.loadWorkComments(),
      loadWorkDerivatives: () => communityPanels?.loadWorkDerivatives(),
      loadWorkSupporters: () => communityPanels?.loadWorkSupporters(),
      toggleWorkSupport: () => communityPanels?.toggleWorkSupport(),
      postWorkComment: (event) => communityPanels?.postWorkComment(event),
      isMapOpen: () => Boolean(options.getMapController()?.isOpen()),
      toggleMap: options.toggleMapMode,
      closeModal: options.closeModal,
      closeNpcDialog: options.closeNpcDialog,
      login: () => options.getLoginController()?.login(),
      loginFeedback: () => options.getLoginController()?.validateInput(),
      showLogin: () => options.getLoginController()?.showLogin(),
      resize: () => {
        options.getRenderer().setSize(window.innerWidth, window.innerHeight);
        options.updateCameraProjection(options.getCameraZoom());
        if (options.getMapController()?.isOpen()) options.getMapController()?.updateImage();
      },
    });
  }

  return { setupEvents, setupRenderSettings, closeRenderSettings };
}
