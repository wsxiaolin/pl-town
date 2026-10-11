// Optional city certification building: prove ownership of a Physics Lab
// account whose nickname matches the resident's current display name. On
// success the resident's name gains the 认证徽标.
export function createCertifyController(options: {
  onVerified: (verified: boolean) => void;
  showUnlockToast: (message: string) => void;
}) {
  function setError(message: string): void {
    const error = document.getElementById('certifyError');
    if (!error) return;
    error.textContent = message;
    error.hidden = !message;
  }

  function show(): void {
    setError('');
    const login = document.getElementById('certifyLogin') as HTMLInputElement | null;
    const password = document.getElementById('certifyPassword') as HTMLInputElement | null;
    if (login) login.value = '';
    if (password) password.value = '';
    const overlay = document.getElementById('certifyOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    void overlay.offsetWidth;
    overlay.classList.remove('hidden');
    window.setTimeout(() => login?.focus(), 300);
  }

  function hide(): void {
    const overlay = document.getElementById('certifyOverlay');
    overlay?.classList.add('hidden');
    window.setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 550);
  }

  async function submit(): Promise<void> {
    const login = (document.getElementById('certifyLogin') as HTMLInputElement | null)?.value.trim() ?? '';
    const password = (document.getElementById('certifyPassword') as HTMLInputElement | null)?.value ?? '';
    const token = localStorage.getItem('minicityServerToken') ?? '';
    const button = document.getElementById('certifySubmit') as HTMLButtonElement | null;
    if (!token) { setError('请先登录小城账号。'); return; }
    if (!login || !password) { setError('请填写物实账号和密码。'); return; }
    if (button) { button.disabled = true; button.textContent = '正在验证…'; }
    setError('');
    try {
      const response = await fetch('/town-api/account/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, login, password }),
      });
      const payload = await response.json().catch(() => ({})) as { verified?: boolean; error?: string };
      if (!response.ok) throw new Error(payload.error || '认证失败，请稍后重试');
      options.onVerified(true);
      options.showUnlockToast('认证成功，名字旁已出现认证徽标');
      hide();
    } catch (error) {
      setError(error instanceof Error ? error.message : '认证失败，请稍后重试');
    } finally {
      if (button) { button.disabled = false; button.textContent = '提交认证'; }
    }
  }

  return { show, hide, submit };
}
