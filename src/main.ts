import '../style.css';
import { destroyMiniCity, startMiniCity } from './city/MiniCityApp';

startMiniCity();

window.addEventListener('pagehide', destroyMiniCity, { once: true });

if (import.meta.hot) {
  import.meta.hot.dispose(destroyMiniCity);
}
