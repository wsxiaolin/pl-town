// Player-side panel that lets residents submit NPC dialog/setting change
// requests to the server. Requests are persisted as tickets and surfaced to
// admins in the NPC management console for approval. Submitting does NOT
// mutate game runtime or override the catalog — it only opens a ticket.

const TOKEN_KEY = 'minicityServerToken';
const FORM_ID = 'npcChangeForm';
const STATUS_ID = 'npcChangeStatus';
const SUBMIT_ID = 'npcChangeSubmit';

type NpcChangeKind = 'add' | 'edit' | 'dialog';

function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

function setStatus(message: string, success = false): void {
  const el = document.getElementById(STATUS_ID);
  if (!el) return;
  el.textContent = message;
  el.className = `npc-change-status${success ? ' success' : ''}`;
  el.hidden = !message;
}

async function submitChangeRequest(event: Event): Promise<void> {
  event.preventDefault();
  const form = event.target as HTMLFormElement;
  const kind = (document.getElementById('npcChangeKind') as HTMLSelectElement)?.value as NpcChangeKind;
  const npcId = (document.getElementById('npcChangeNpcId') as HTMLInputElement)?.value.trim() ?? '';
  const title = (document.getElementById('npcChangeTitle') as HTMLInputElement)?.value.trim() ?? '';
  const summary = (document.getElementById('npcChangeSummary') as HTMLTextAreaElement)?.value.trim() ?? '';
  const submit = document.getElementById(SUBMIT_ID) as HTMLButtonElement | null;
  const token = getToken();

  if (!token) { setStatus('需要先登录服务器账号才能提交。'); return; }
  if (!npcId) { setStatus('请填写 NPC 名称或 ID。'); return; }
  if (!title) { setStatus('请填写标题。'); return; }
  if (!summary) { setStatus('请填写详细说明。'); return; }

  if (submit) submit.disabled = true;
  try {
    const response = await fetch('/town-api/npc-change-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, npcId, kind, title, summary, change: {} }),
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) { setStatus('登录已过期，请重新进入城市。'); return; }
    if (response.status === 429) { setStatus('提交过于频繁，请稍后再试。'); return; }
    if (!response.ok) throw new Error(payload.error || '提交失败');
    setStatus('已提交，等待开发者审批。', true);
    form.reset();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '提交失败');
  } finally {
    if (submit) submit.disabled = false;
  }
}

export function attachNpcChangePanel(): void {
  const form = document.getElementById(FORM_ID);
  form?.addEventListener('submit', (event) => void submitChangeRequest(event));
}
