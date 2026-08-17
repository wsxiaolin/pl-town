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
  let nicknameFeedbackTimer = 0;

  function setError(message: string): void {
    const error = document.getElementById('loginError');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

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
    const name = input?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';
    if (name.length < 2) return setError('Nickname must contain at least two characters.');
    if (!/^[\p{L}\p{N}]{2,40}$/u.test(name)) return setError('Use only letters or numbers in your nickname.');
    if (!password) return setError('Enter a password.');
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

  function validateInput(): void {
    const input = document.getElementById('loginInput') as HTMLInputElement | null;
    if (!input) return;
    const name = input.value.trim();
    window.clearTimeout(nicknameFeedbackTimer);
    if (name && !/^[\p{L}\p{N}]{2,40}$/u.test(name)) return setError('Use only letters or numbers in your nickname.');
    if (name.length === 1) {
      nicknameFeedbackTimer = window.setTimeout(() => {
        const current = (document.getElementById('loginInput') as HTMLInputElement | null)?.value.trim() ?? '';
        if (current === name && current.length < 2) setError('Nickname must contain at least two characters.');
      }, 700);
      return;
    }
    setError('');
  }

  return { checkLogin, showLogin, showLoginEntry, login, validateInput };
}
