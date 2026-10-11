import type { LegacyStats } from '../../city/progression/legacyStats';
import { renderVerifiedName } from './verifiedBadge';

/**
 * Bridges the account lifecycle into the login/居民证 overlays. Residents sign
 * up or log in with an email + password before the city assets download, then
 * sign a display name on the 居民证 once the download completes.
 */
export interface LoginGate {
  isWaiting: () => boolean;
  onAuthorized: (user: { nickname: string; verified?: boolean }) => void;
  onAuthFailed: (message: string) => void;
  onConnectionLost: () => void;
}

export type LoginControllerOptions = {
  getStats: () => LegacyStats;
  saveStats: (stats: LegacyStats) => void;
  ensureUserId: () => void;
  /** Register or log in over HTTP with the given credentials. */
  submitCredentials: (email: string, password: string) => void;
  /** Sign the display name on the 居民证. */
  submitResidentName: (name: string) => void;
  /** Identity confirmed (login or token restore): begin downloading the city. */
  beginDownload: () => void;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createLoginController(options: LoginControllerOptions) {
  let verifying = false;

  function setError(message: string): void {
    const error = document.getElementById('loginError');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

  function setResidentCardError(message: string): void {
    const error = document.getElementById('residentCardError');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

  function beginVerifying(): void {
    const button = document.getElementById('loginBtn') as HTMLButtonElement | null;
    if (verifying) return;
    verifying = true;
    if (button) {
      button.textContent = '正在核实身份…';
      button.disabled = true;
    }
  }

  function endVerifying(): void {
    const button = document.getElementById('loginBtn') as HTMLButtonElement | null;
    verifying = false;
    if (button) {
      button.textContent = '注册 / 登录，进入小城';
      button.disabled = false;
    }
  }

  function applyUsername(name: string, verified = false): void {
    const element = document.getElementById('logoUser');
    if (!element) return;
    renderVerifiedName(element, name, verified, { prefix: '- ' });
    element.classList.remove('login-required');
    element.setAttribute('aria-label', `${name}, logged in`);
    element.setAttribute('tabindex', '-1');
  }

  function showLoginEntry(): void {
    const element = document.getElementById('logoUser');
    if (!element) return;
    element.textContent = 'Login';
    element.classList.remove('verified-name');
    element.classList.add('login-required');
    element.setAttribute('aria-label', 'Login');
    element.removeAttribute('tabindex');
  }

  function showLogin(): void {
    const overlay = document.getElementById('loginOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    // Force a reflow while `.hidden` still applies so removing it animates in;
    // a bare double-rAF can be throttled and leave the overlay click-blocking.
    void overlay.offsetWidth;
    overlay.classList.remove('hidden');
    window.setTimeout(() => document.getElementById('loginEmail')?.focus(), 300);
  }

  function hideLogin(): void {
    endVerifying();
    const overlay = document.getElementById('loginOverlay');
    overlay?.classList.add('hidden');
    window.setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 550);
  }

  function showResidentCard(): void {
    const overlay = document.getElementById('residentCardOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    void overlay.offsetWidth;
    overlay.classList.remove('hidden');
    window.setTimeout(() => document.getElementById('residentCardName')?.focus(), 300);
  }

  function hideResidentCard(): void {
    const overlay = document.getElementById('residentCardOverlay');
    overlay?.classList.add('hidden');
    window.setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 550);
  }

  /**
   * Entry point at boot: a stored session token skips the login overlay and
   * starts the download; otherwise the resident must register or log in first.
   */
  function startAuth(): void {
    if (localStorage.getItem('minicityServerToken')) options.beginDownload();
    else showLogin();
  }

  function login(): void {
    if (verifying) return;
    const emailInput = document.getElementById('loginEmail') as HTMLInputElement | null;
    const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;
    const email = emailInput?.value.trim() ?? '';
    const password = passwordInput?.value ?? '';
    if (!email) return setError('请输入邮箱。');
    if (!EMAIL_PATTERN.test(email)) return setError('邮箱格式不正确。');
    if (!password) return setError('请输入密码。');
    const stats = options.getStats();
    if (!stats.joinDate) {
      stats.joinDate = Date.now();
      options.saveStats(stats);
    }
    options.ensureUserId();
    beginVerifying();
    setError('');
    options.submitCredentials(email, password);
  }

  function signResidentCard(): void {
    const input = document.getElementById('residentCardName') as HTMLInputElement | null;
    const name = input?.value.trim() ?? '';
    if (!name) return setResidentCardError('请签上你的名字。');
    if (name.length > 40) return setResidentCardError('名字最多 40 个字符。');
    setResidentCardError('');
    options.submitResidentName(name);
  }

  function asLoginGate(): LoginGate {
    return {
      isWaiting: () => verifying,
      onAuthorized: (user) => {
        const name = user.nickname?.trim();
        if (name) {
          localStorage.setItem('minicityUser', name);
          applyUsername(name, Boolean(user.verified));
        }
      },
      onAuthFailed: (message) => {
        endVerifying();
        localStorage.removeItem('minicityServerToken');
        showLoginEntry();
        showLogin();
        setError(message);
      },
      onConnectionLost: () => { endVerifying(); setError('暂时无法连接小城服务器，请稍后重试'); },
    };
  }

  return {
    startAuth, showLogin, hideLogin, login, signResidentCard, showResidentCard, hideResidentCard,
    showLoginError: (message: string) => {
      endVerifying();
      const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;
      if (passwordInput) passwordInput.value = '';
      setError(message);
    },
    showResidentCardError: setResidentCardError,
    applyUsername, showLoginEntry, asLoginGate, endVerifying,
  };
}
