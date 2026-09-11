export function renderVerifiedName(
  element: HTMLElement,
  nickname: string,
  verified: boolean,
  options: { prefix?: string; suffix?: string } = {},
): void {
  element.classList.add('verified-name');
  const name = document.createElement('span');
  name.className = 'verified-name-text';
  name.textContent = `${options.prefix ?? ''}${nickname}`;
  element.replaceChildren(name);
  const badge = document.createElement('i');
  if (verified) {
    badge.className = 'verified-badge';
    badge.title = '已认证';
    badge.setAttribute('aria-label', '已认证');
    element.appendChild(badge);
  }
  if (options.suffix) {
    const suffix = document.createElement('span');
    suffix.className = 'verified-name-suffix';
    suffix.textContent = options.suffix;
    element.appendChild(suffix);
  }
}
