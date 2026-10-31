/**
 * Page-level zoom guard. MiniCity is a full-viewport WebGL app whose DOM
 * chrome (boot splash, phone, chat, panels) deforms when the browser
 * page-zooms, and the canvas already implements its own pinch/wheel camera
 * zoom — so every remaining zoom channel is blocked here:
 *
 * - `gesturestart/change/end`: iOS Safari ignores `user-scalable=no` for the
 *   pinch gesture; only preventDefault on these proprietary events stops it.
 *   Desktop Safari trackpad pinch emits the same events.
 * - `touchmove` with 2+ touches: page pinch on any DOM surface above the
 *   canvas (overlays carry no `touch-action` of their own). Single-finger
 *   panning — chat log, house list, stats body — is untouched, and the
 *   canvas camera-pinch handler is a separate listener that still runs.
 * - `wheel` with ctrlKey: desktop Ctrl+wheel / trackpad-pinch browser zoom
 *   over DOM UI. Plain wheel is left alone.
 *
 * Double-tap zoom is handled by CSS (`touch-action: pan-x pan-y` on body)
 * and the iOS input-focus auto-zoom by the `maximum-scale=1` viewport meta.
 */
export function installViewportZoomGuard(signal: AbortSignal): void {
  const prevent = (event: Event) => { event.preventDefault(); };
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, prevent, { passive: false, signal });
  }
  document.addEventListener('touchmove', (event) => {
    if (event.touches.length >= 2) event.preventDefault();
  }, { passive: false, signal });
  document.addEventListener('wheel', (event) => {
    if (event.ctrlKey) event.preventDefault();
  }, { passive: false, signal });
}
