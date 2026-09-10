import type { LegacyStats } from '../../city/progression/legacyStats';

/**
 * Bridges the WebSocket auth lifecycle into the login-overlay state machine:
 * the city entrance is held back and the button stays busy until the server
 * confirms the resident, and every failure branch hands control back.
 */
export interface LoginGate {
  isWaiting: () => boolean;
  onAuthorized: () => void;
  onAuthFailed: () => void;
  onConnectionLost: () => void;
}

export type LoginControllerOptions = {
  getStats: () => LegacyStats;
  saveStats: (stats: LegacyStats) => void;
  ensureUserId: () => void;
  checkAchievements: () => void;
  shouldShowIntro: () => boolean;
  startIntro: () => void;
  proceed: (nickname?: string, password?: string, pl?: { login: string; password: string }) => void;
};

export function createLoginController(options: LoginControllerOptions) {
  let nicknameFeedbackTimer = 0;
  let verifying = false;
  let loginButtonLabel = '';
  let pendingCityEntrance: (() => void) | null = null;

  function setError(message: string): void {
    const error = document.getElementById('loginError');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

  /** Hold the overlay with a busy button while the server verifies identity. */
  function beginVerifying(): void {
    const button = document.getElementById('loginBtn') as HTMLButtonElement | null;
    if (verifying) return;
    verifying = true;
    if (button) {
      loginButtonLabel = button.textContent ?? '';
      button.textContent = '正在核实身份…';
      button.disabled = true;
    }
  }

  function endVerifying(): void {
    const button = document.getElementById('loginBtn') as HTMLButtonElement | null;
    verifying = false;
    if (button) {
      if (loginButtonLabel) button.textContent = loginButtonLabel;
      button.disabled = false;
    }
  }

  /** Close the overlay only after the server has confirmed the resident. */
  function closeAfterAuth(): void {
    const overlay = document.getElementById('loginOverlay');
    endVerifying();
    hidePlVerification();
    overlay?.classList.add('hidden');
    window.setTimeout(() => {
      if (overlay) overlay.style.display = 'none';
    }, 550);
  }

  /** Called by proceedToCity for fresh sign-ins: run the entrance on success. */
  function holdCityEntrance(entrance: () => void): void {
    pendingCityEntrance = entrance;
  }

  function asLoginGate(): LoginGate {
    return {
      isWaiting: () => verifying,
      onAuthorized: () => {
        const entrance = pendingCityEntrance;
        pendingCityEntrance = null;
        if (entrance) entrance();
        closeAfterAuth();
      },
      onAuthFailed: () => endVerifying(),
      onConnectionLost: () => { endVerifying(); setError('暂时无法连接小城服务器，请稍后重试'); },
    };
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

  /** Read the Physics Lab ownership-verification fields when they are shown. */
  function collectPlCredentials(): { login: string; password: string } | undefined | null {
    const section = document.getElementById('plVerifySection');
    if (!section || section.hidden) return undefined;
    const login = (document.getElementById('plLoginInput') as HTMLInputElement | null)?.value.trim() ?? '';
    const password = (document.getElementById('plPasswordInput') as HTMLInputElement | null)?.value ?? '';
    if (!login || !password) return null;
    return { login, password };
  }

  function hidePlVerification(): void {
    const section = document.getElementById('plVerifySection');
    if (section) section.hidden = true;
    const login = document.getElementById('plLoginInput') as HTMLInputElement | null;
    const password = document.getElementById('plPasswordInput') as HTMLInputElement | null;
    if (login) login.value = '';
    if (password) password.value = '';
  }

  function login(): void {
    if (verifying) return;
    const input = document.getElementById('loginInput') as HTMLInputElement | null;
    const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;
    const name = input?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';
    if (name.length < 2) return setError('Nickname must contain at least two characters.');
    if (!/^[\p{L}\p{N}]{2,40}$/u.test(name)) return setError('Use only letters or numbers in your nickname.');
    if (!password) return setError('Enter a password.');
    const pl = collectPlCredentials();
    if (pl === null) return setError('请填写物实账号和密码完成身份验证，或换一个昵称。');
    localStorage.setItem('minicityUser', name);
    const stats = options.getStats();
    if (!stats.joinDate) {
      stats.joinDate = Date.now();
      options.saveStats(stats);
    }
    options.ensureUserId();
    applyUsername(name);
    options.checkAchievements();
    // Keep the overlay up and hold the button in a waiting state until the
    // server confirms the resident; the city opens on the `hello` success
    // callback (closeAfterAuth), so verification always completes first.
    beginVerifying();
    setError('');
    options.proceed(name, password, pl);
  }

  function validateInput(): void {
    const input = document.getElementById('loginInput') as HTMLInputElement | null;
    if (!input) return;
    const name = input.value.trim();
    window.clearTimeout(nicknameFeedbackTimer);
    // The verification request is nickname-specific: editing the nickname
    // invalidates it, so put the form back into its plain state.
    hidePlVerification();
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

  return { checkLogin, showLogin, showLoginEntry, login, validateInput, hidePlVerification, setError, endVerifying, holdCityEntrance, asLoginGate };
}
