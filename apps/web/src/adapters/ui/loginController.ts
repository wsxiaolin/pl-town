export type LoginControllerOptions = {
  getStats: () => { joinDate?: number };
  saveStats: (stats: { joinDate?: number }) => void;
  ensureUserId: () => void;
  checkAchievements: () => void;
  shouldShowIntro: () => boolean;
  startIntro: () => void;
  proceed: (nickname?: string, password?: string) => void;
};

export function createLoginController(options: LoginControllerOptions) {
  function applyUsername(name: string): void {
    const element = document.getElementById('logoUser');
    if (!element) return;
    element.textContent = `- ${name}`;
    element.classList.remove('login-required');
    element.setAttribute('aria-label', `${name}, logged in`);
    element.setAttribute('tabindex', '-1');
  }

  function showLoginEntry(): void {
    const element = document.getElementById('logoUser');
    if (!element) return;
    element.textContent = 'Login';
    element.classList.add('login-required');
    element.setAttribute('aria-label', 'Login');
    element.removeAttribute('tabindex');
  }

  function showLogin(): void {
    const overlay = document.getElementById('loginOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.remove('hidden')));
    window.setTimeout(() => document.getElementById('loginInput')?.focus(), 300);
  }

  function checkLogin(): void {
    const overlay = document.getElementById('loginOverlay');
    const name = localStorage.getItem('minicityUser');
    if (overlay) overlay.style.display = 'none';
    if (name) applyUsername(name);
    else showLoginEntry();
    if (options.shouldShowIntro()) options.startIntro();
    else if (name) options.proceed();
    else showLogin();
  }

  function login(): void {
    const input = document.getElementById('loginInput') as HTMLInputElement | null;
    const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;
    const error = document.getElementById('loginError');
    const name = input?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';
    const showError = (message: string) => {
      if (!error) return;
      error.textContent = message;
      error.hidden = !message;
    };
    if (name.length < 2) return showError('Nickname must contain at least two characters.');
    if (!/^[\p{L}\p{N}]{2,40}$/u.test(name)) return showError('Use only letters or numbers in your nickname.');
    if (!password) return showError('Enter a password.');
    localStorage.setItem('minicityUser', name);
    const stats = options.getStats();
    if (!stats.joinDate) {
      stats.joinDate = Date.now();
      options.saveStats(stats);
    }
    options.ensureUserId();
    applyUsername(name);
    options.checkAchievements();
    const overlay = document.getElementById('loginOverlay');
    overlay?.classList.add('hidden');
    window.setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
      options.proceed(name, password);
    }, 550);
  }

  return { checkLogin, showLogin, showLoginEntry, login };
}
