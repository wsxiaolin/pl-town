import { createCertifyController } from './certifyController';
import { createLoginController } from './loginController';
import type { LegacyStats } from '../../city/progression/legacyStats';

export type AccountSessionOptions = {
  getStats: () => LegacyStats;
  saveStats: (stats: LegacyStats) => void;
  ensureUserId: () => void;
  showUnlockToast: (message: string) => void;
  getLocalUser: () => { verified?: boolean } | null;
  /** Kick off the auth-gated city boot. */
  beginBoot: () => void;
  /** Play the city entrance and connect the multiplayer socket. */
  onEnterCity: () => void;
  signal: AbortSignal;
};

/**
 * Owns the email/password + 居民证 account lifecycle. Registration/login runs
 * over HTTP before the city assets download; the display name is signed on the
 * 居民证 once the download and the opening CG finish. Only touches the DOM and
 * the injected callbacks, so it stays out of the composition root.
 */
export function createAccountSessionController(options: AccountSessionOptions) {
  let cityDownloaded = false;
  let introFinished = false;

  const loginController = createLoginController({
    getStats: options.getStats,
    saveStats: options.saveStats,
    ensureUserId: options.ensureUserId,
    submitCredentials: (email, password) => { void loginWithCredentials(email, password); },
    submitResidentName: (name) => { void signResidentCard(name); },
    beginDownload: beginCityDownload,
  });
  const certifyController = createCertifyController({
    onVerified: (verified) => {
      const client = options.getLocalUser();
      if (client) client.verified = verified;
      const name = localStorage.getItem('minicityUser') ?? '';
      if (name) loginController.applyUsername(name, verified);
    },
    showUnlockToast: options.showUnlockToast,
  });

  document.getElementById('certifySubmit')?.addEventListener('click', () => { void certifyController.submit(); }, { signal: options.signal });
  document.getElementById('certifyClose')?.addEventListener('click', () => certifyController.hide(), { signal: options.signal });
  document.getElementById('certifyLogin')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') void certifyController.submit(); }, { signal: options.signal });
  document.getElementById('certifyPassword')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') void certifyController.submit(); }, { signal: options.signal });
  // The account overlays are shown before the city downloads, so their controls
  // must be wired here rather than in the post-boot city event bindings.
  document.getElementById('loginBtn')?.addEventListener('click', () => loginController.login(), { signal: options.signal });
  document.getElementById('loginEmail')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') loginController.login(); }, { signal: options.signal });
  document.getElementById('loginPassword')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') loginController.login(); }, { signal: options.signal });
  document.getElementById('residentCardSign')?.addEventListener('click', () => loginController.signResidentCard(), { signal: options.signal });
  document.getElementById('residentCardName')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') loginController.signResidentCard(); }, { signal: options.signal });

  async function loginWithCredentials(email: string, password: string): Promise<void> {
    try {
      const response = await fetch('/town-api/account/login', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({})) as { token?: string; user?: { nickname?: string; verified?: boolean }; error?: string };
      if (!response.ok || !payload.token) throw new Error(payload.error || '登录失败，请稍后重试');
      localStorage.setItem('minicityServerToken', payload.token);
      const nickname = payload.user?.nickname?.trim() ?? '';
      if (nickname) localStorage.setItem('minicityUser', nickname);
      else localStorage.removeItem('minicityUser');
      loginController.hideLogin();
      if (nickname) loginController.applyUsername(nickname, Boolean(payload.user?.verified));
      beginCityDownload();
    } catch (error) {
      loginController.showLoginError(error instanceof Error ? error.message : '登录失败，请稍后重试');
    }
  }

  async function signResidentCard(name: string): Promise<void> {
    const token = localStorage.getItem('minicityServerToken') ?? '';
    try {
      const response = await fetch('/town-api/account/name', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, name }),
      });
      const payload = await response.json().catch(() => ({})) as { user?: { nickname?: string }; error?: string };
      if (!response.ok) throw new Error(payload.error || '签署失败，请稍后重试');
      const displayName = payload.user?.nickname?.trim() || name;
      localStorage.setItem('minicityUser', displayName);
      loginController.applyUsername(displayName);
      loginController.hideResidentCard();
      maybeEnterCity();
    } catch (error) {
      loginController.showResidentCardError(error instanceof Error ? error.message : '签署失败，请稍后重试');
    }
  }

  function beginCityDownload(): void {
    cityDownloaded = false;
    introFinished = false;
    options.beginBoot();
    maybeEnterCity();
  }

  function maybeEnterCity(): void {
    if (!cityDownloaded || !introFinished) return;
    if (!localStorage.getItem('minicityUser')) loginController.showResidentCard();
    else options.onEnterCity();
  }

  return {
    loginController,
    certifyController,
    /** The city assets finished booting. */
    markCityReady: () => { cityDownloaded = true; maybeEnterCity(); },
    /** The opening CG finished. */
    markIntroFinished: () => { introFinished = true; maybeEnterCity(); },
  };
}
