import './styles/index.css';
import { destroyMiniCity, startMiniCity } from './city/MiniCityApp';

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

// Let the first rendered WebGL frame land before removing the first-paint shell.
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.getElementById('bootScreen')?.classList.add('is-ready'));
});

window.addEventListener('pagehide', destroyMiniCity, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(destroyMiniCity);
}
