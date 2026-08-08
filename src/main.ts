import '../style.css';
import { destroyMiniCity, startMiniCity } from './city/MiniCityApp';

startMiniCity();

// Let the first rendered WebGL frame land before removing the first-paint shell.
requestAnimationFrame(() => {
  requestAnimationFrame(() => document.getElementById('bootScreen')?.classList.add('is-ready'));
});

window.addEventListener('pagehide', destroyMiniCity, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(destroyMiniCity);
}
