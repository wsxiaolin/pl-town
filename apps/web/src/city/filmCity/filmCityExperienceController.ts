import type { CityDialogController } from '../../adapters/ui/cityDialogController';

export const FILM_CITY_SERVICE_ID = 'film_city_flyover';
export const FILM_CITY_EXPERIENCE_PRICE = 400;

export type FilmCityShot = {
  phase: 'wide' | 'near' | 'closeup';
  x: number;
  z: number;
  zoom: number;
  duration: number;
};

export const FILM_CITY_SHOTS: readonly FilmCityShot[] = Object.freeze([
  { phase: 'wide', x: -9, z: -22.5, zoom: 14, duration: 10 },
  { phase: 'near', x: -9, z: -20.5, zoom: 7, duration: 10 },
  { phase: 'closeup', x: -9, z: -25.2, zoom: 3.8, duration: 10 },
]);

type CameraSnapshot = { x: number; z: number; zoom: number };

export function createFilmCityExperienceController(options: {
  dialogs: () => CityDialogController | null;
  getCurrency: () => number;
  purchase: () => Promise<boolean>;
  getCameraSnapshot: () => CameraSnapshot;
  playShots: (shots: readonly FilmCityShot[], onComplete: () => void) => void;
  stopShots: () => void;
  restoreCamera: (snapshot: CameraSnapshot) => void;
  setCinematicActive: (active: boolean) => void;
  clearPlayerPath: () => void;
  showToast: (message: string) => void;
}) {
  let active = false;
  let purchasing = false;
  let snapshot: CameraSnapshot | null = null;

  function finish(message?: string): void {
    if (!active) return;
    options.stopShots();
    const saved = snapshot;
    snapshot = null;
    active = false;
    options.setCinematicActive(false);
    if (saved) options.restoreCamera(saved);
    if (message) options.showToast(message);
  }

  function start(): void {
    snapshot = options.getCameraSnapshot();
    active = true;
    options.clearPlayerPath();
    options.setCinematicActive(true);
    options.showToast('飞跃地平线即将起飞');
    options.playShots(FILM_CITY_SHOTS, () => finish('飞跃地平线体验结束'));
  }

  async function purchaseAndStart(): Promise<void> {
    if (active || purchasing) return;
    purchasing = true;
    options.dialogs()?.closeNpc();
    const purchased = await options.purchase();
    purchasing = false;
    if (purchased) start();
  }

  function interact(): void {
    if (active || purchasing) {
      options.showToast(active ? '飞跃地平线正在放映' : '正在确认体验订单');
      return;
    }
    const balance = options.getCurrency();
    options.dialogs()?.openStory({
      title: '物实影视城',
      role: `飞跃地平线 · ${FILM_CITY_EXPERIENCE_PRICE} 物实币`,
      text: `航线将以远景、近景和特写掠过物实市，体验约 30 秒。当前余额 ${balance} 物实币。`,
      variant: 'story',
      options: [
        { text: `支付 ${FILM_CITY_EXPERIENCE_PRICE} 物实币并起飞`, onPick: purchaseAndStart },
        { text: '稍后再来', onPick: () => options.dialogs()?.closeNpc() },
      ],
    });
  }

  return {
    interact,
    stop: () => finish('飞跃地平线体验已结束'),
    dispose: () => finish(),
    isActive: () => active,
  };
}
