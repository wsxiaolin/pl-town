export const money = (value: number) => `${value.toLocaleString()} 金币`;

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
  element.dataset.cityFocus = focusKey;
  if (action) element.addEventListener('click', action);
  return element;
}
