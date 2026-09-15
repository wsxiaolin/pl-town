import type { Weather } from './weather';

type WellPhase = 'idle' | 'focus' | 'engulf' | 'recede';
type BeachPhase = 'hidden' | 'revealed' | 'reward';

export function createIceKingCityHooks(options: {
  defaultZoom: number;
  wellZoom: number;
  beachZoom: number;
  iceZoom: (mobile: boolean) => number;
  isMobile: () => boolean;
  canAdjustCamera: () => boolean;
  getZoom: () => number;
  setZoom: (zoom: number) => void;
  captureIceZoom: () => void;
  restoreIceZoom: () => void;
  setWellVision: (phase: string | null) => void;
  closeMapIfOpen: () => void;
  closeHud: () => void;
  clearTravel: () => void;
  setWeather: (weather: Weather) => void;
  invalidateMap: () => void;
  setCameraTarget: (x: number, z: number, instant?: boolean) => void;
  focusCamera: (x: number, z: number) => void;
  sendLocalPosition: (x: number, z: number, rotation?: number) => void;
  getCursor: () => { position: { x: number; z: number }; rotation: { y: number } } | null;
  setWellPhaseVisual: (phase: WellPhase) => void;
  setBeachEncounterPhase: (phase: BeachPhase) => void;
}) {
  return {
    onEnter() {
      options.closeMapIfOpen();
      options.closeHud();
      options.captureIceZoom();
      options.setZoom(options.iceZoom(options.isMobile()));
      options.clearTravel();
    },
    onReturn(weather: string) {
      options.setWeather(weather === 'rain' ? 'rain' : 'clear');
      options.restoreIceZoom();
      options.invalidateMap();
      const cursor = options.getCursor();
      const x = cursor?.position.x ?? 20;
      const z = cursor?.position.z ?? 26;
      options.setCameraTarget(x, z, true);
      options.sendLocalPosition(x, z, cursor?.rotation.y);
    },
    setWellPhase(phase: WellPhase) {
      options.setWellPhaseVisual(phase);
      if (!options.canAdjustCamera()) return;
      if (phase === 'focus' || phase === 'engulf') {
        options.setZoom(Math.min(options.getZoom(), options.wellZoom));
        options.setWellVision(phase);
        return;
      }
      options.setZoom(options.defaultZoom);
      options.setWellVision(null);
    },
    setBeachEncounterPhase(phase: BeachPhase) {
      options.setBeachEncounterPhase(phase);
    },
    focusBeachEncounter() {
      options.setZoom(options.beachZoom);
      options.focusCamera(-41.2, 11.5);
    },
  };
}

export type IceKingCityHooks = ReturnType<typeof createIceKingCityHooks>;
