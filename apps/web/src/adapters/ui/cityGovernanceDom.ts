export const money = (value: number) => `${value.toLocaleString()} 金币`;

let restoringPanelFocus = false;

// The modal restores a safe fallback while its controls are rebuilt. That
// programmatic focus move is not a resident choosing to leave a pending action.
export function withPanelFocusRestoration(render: () => void): void {
  const wasRestoring = restoringPanelFocus;
  restoringPanelFocus = true;
  try { render(); } finally { restoringPanelFocus = wasRestoring; }
}

// Rebuilding a disabled action loses focus. Restore it after a response only if
// the user has not since focused, clicked or typed elsewhere in the page.
export function trackPendingActionFocus(focusKey: string) {
  let uninterrupted = document.activeElement instanceof HTMLElement
    && document.activeElement.dataset.cityFocus === focusKey;
  let renderedFallback: EventTarget | null = null;
  const controller = new AbortController();
  const movedOn = (event: Event) => {
    if (event.type === 'focusin' && restoringPanelFocus) renderedFallback = event.target;
    else uninterrupted = false;
  };
  for (const event of ['focusin', 'pointerdown', 'keydown']) {
    document.addEventListener(event, movedOn, { capture: true, signal: controller.signal });
  }
  return {
    shouldRestore: (failed = false) => uninterrupted
      && (failed || document.activeElement === document.body || document.activeElement === renderedFallback),
    dispose: () => controller.abort(),
  };
}

export function card(title: string, description: string): HTMLElement {
  const item = document.createElement('article');
  item.className = 'city-governance-card';
  const heading = document.createElement('h3');
  heading.textContent = title;
  const copy = document.createElement('p');
  copy.textContent = description;
  item.append(heading, copy);
  return item;
}

export function actionButton(label: string, action?: () => void, disabled = false, focusKey = ''): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = label;
  element.disabled = disabled;
  if (focusKey) element.dataset.cityFocus = focusKey;
  if (action) element.addEventListener('click', action);
  return element;
}
