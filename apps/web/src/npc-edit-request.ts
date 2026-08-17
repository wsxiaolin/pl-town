type Npc = { id: string; name: string; role: string; npcType: string };
type Session = { token: string; user: { nickname: string } };

const SESSION_KEY = 'minicityNpcEditSession';
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const loginPanel = $('loginPanel');
const requestPanel = $('requestPanel');
const loginStatus = $('loginStatus');
const requestStatus = $('requestStatus');
let session: Session | null = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');

function setStatus(element: HTMLElement, message: string, success = false): void {
  element.textContent = message;
  element.className = `status${success ? ' success' : ''}`;
  element.hidden = !message;
}

async function loadCatalog(): Promise<void> {
  const response = await fetch('/town-api/npc-edit-catalog', { cache: 'no-store' });
  if (!response.ok) throw new Error('NPC 列表暂时无法加载');
  const payload = await response.json() as { items: Npc[] };
  const select = $('requestNpc') as HTMLSelectElement;
  select.replaceChildren(new Option('请选择 NPC', ''), ...payload.items.map((npc) => new Option(`${npc.name} · ${npc.role}（${npc.id}）`, npc.id)));
}

function showRequestPage(): void {
  loginPanel.hidden = Boolean(session);
  requestPanel.hidden = !session;
  if (session) $('signedInAs').textContent = `已登录：${session.user.nickname}`;
}

async function login(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  setStatus(loginStatus, '');
  try {
    const response = await fetch('/town-api/npc-edit-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nickname: ($('loginNickname') as HTMLInputElement).value.trim(), password: ($('loginPassword') as HTMLInputElement).value }) });
    const payload = await response.json() as { error?: string; token?: string; user?: { nickname: string } };
    if (!response.ok || !payload.token || !payload.user) throw new Error(payload.error || '登录失败');
    session = { token: payload.token, user: payload.user };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    showRequestPage();
    await loadCatalog();
  } catch (error) { setStatus(loginStatus, error instanceof Error ? error.message : '登录失败'); }
}

async function submitRequest(event: SubmitEvent): Promise<void> {
  event.preventDefault();
  if (!session) return;
  const submit = $('requestSubmit') as HTMLButtonElement;
  const npcId = ($('requestNpc') as HTMLSelectElement).value;
  const kind = ($('requestKind') as HTMLSelectElement).value;
  const title = ($('requestTitle') as HTMLInputElement).value.trim();
  const summary = ($('requestSummary') as HTMLTextAreaElement).value.trim();
  const changeText = ($('requestChange') as HTMLTextAreaElement).value.trim();
  if (!npcId && kind !== 'add') return setStatus(requestStatus, '请选择目标 NPC');
  if (!title || !summary) return setStatus(requestStatus, '请填写标题和详细说明');
  submit.disabled = true;
  try {
    const response = await fetch('/town-api/npc-change-requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: session.token, npcId: npcId || `proposal:${title}`, kind, title, summary, change: changeText ? { proposal: changeText } : {} }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) throw new Error(payload.error || '提交失败');
    setStatus(requestStatus, '申请已提交，等待开发者审批。', true);
    ($('requestForm') as HTMLFormElement).reset();
  } catch (error) { setStatus(requestStatus, error instanceof Error ? error.message : '提交失败'); }
  finally { submit.disabled = false; }
}

$('loginForm').addEventListener('submit', (event) => void login(event as SubmitEvent));
$('requestForm').addEventListener('submit', (event) => void submitRequest(event as SubmitEvent));
$('logoutButton').addEventListener('click', () => { session = null; localStorage.removeItem(SESSION_KEY); showRequestPage(); });
showRequestPage();
if (session) void loadCatalog().catch((error) => setStatus(requestStatus, error instanceof Error ? error.message : 'NPC 列表加载失败'));
