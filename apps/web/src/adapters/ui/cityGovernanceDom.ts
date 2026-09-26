export const money = (value: number) => `${value.toLocaleString()} 金币`;

// Rebuilding a disabled action loses focus. Restore it after a response only if
// the user has not since focused, clicked or typed elsewhere in the page.
export function trackPendingActionFocus(focusKey: string) {
  let uninterrupted = document.activeElement instanceof HTMLElement
    && document.activeElement.dataset.focusKey === focusKey;
  const controller = new AbortController();
  const movedOn = () => { uninterrupted = false; };
  for (const event of ['focusin', 'pointerdown', 'keydown']) {
    document.addEventListener(event, movedOn, { capture: true, signal: controller.signal });
  }
  return {
    shouldRestore: (failed = false) => uninterrupted && (failed || document.activeElement === document.body),
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
  if (focusKey) element.dataset.focusKey = focusKey;
  if (action) element.addEventListener('click', action);
  return element;
}
