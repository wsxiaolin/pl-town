import './styles/index.css';
import { destroyMiniCity, startMiniCity } from './city/MiniCityApp';
import { initTelemetry } from './core/telemetryClient';
import { subscribeTextureResourceProgress } from './city/textureResourcePreloader';
import { finishTextureLoadUi, updateTextureLoadUi } from './adapters/ui/textureLoadUi';
import { notifyCityReady, stopMomentPresentation, whenBootRevealAllowed } from './city/momentSplash';

void initTelemetry();
subscribeTextureResourceProgress(updateTextureLoadUi);

async function requestLandscape(): Promise<void> {
  if (window.innerHeight <= window.innerWidth) return;
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape') => Promise<void>;
    };
    await orientation.lock?.('landscape');
  } catch {
    // Browsers may require fullscreen or a user gesture; CSS keeps portrait blocked.
  }
}

void requestLandscape();
window.addEventListener('pointerdown', requestLandscape, { once: true });

startMiniCity();

window.addEventListener('minicity:city-ready', () => {
  finishTextureLoadUi();
  notifyCityReady();
}, { once: true });

// The boot screen fades only when the city is ready AND the moment splash has
// had its breath (or the visitor clicked through it).
void whenBootRevealAllowed().then(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('bootScreen')?.classList.add('is-ready');
      window.setTimeout(stopMomentPresentation, 1200);
    });
  });
});

window.addEventListener('pagehide', destroyMiniCity, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(destroyMiniCity);
}
