const state = { csrf: '', actor: '', view: 'overview' };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value) || 0);
const formatBytes = (value) => {
  const bytes = Number(value) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};
const formatDate = (value) => value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '无';
const formatDuration = (seconds) => {
  const days = Math.floor(seconds / 86400); const hours = Math.floor(seconds % 86400 / 3600); const minutes = Math.floor(seconds % 3600 / 60);
  return days ? `${days} 天 ${hours} 小时` : hours ? `${hours} 小时 ${minutes} 分` : `${minutes} 分钟`;
};
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = String(text);
  if (className) element.className = className;
  return element;
};
const showNotice = (message, success = false) => {
  const box = $('#notice'); box.textContent = message; box.className = `notice${success ? ' success' : ''}`; box.hidden = false;
  window.clearTimeout(showNotice.timer); showNotice.timer = window.setTimeout(() => { box.hidden = true; }, 5000);
};

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (state.csrf && !['GET', 'HEAD'].includes(options.method || 'GET')) headers.set('x-csrf-token', state.csrf);
  const response = await fetch(`/admin/api${path}`, { ...options, headers, credentials: 'same-origin' });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) { showLogin(); throw new Error('登录已过期，请重新登录'); }
  if (!response.ok) throw new Error(payload.error?.message || '请求失败');
  return payload;
}

function showLogin() {
  state.csrf = ''; state.actor = '';
  $('#loginView').hidden = false; $('#appView').hidden = true; $('#loginPassword').value = '';
}
function showApp(session) {
  state.csrf = session.csrf || ''; state.actor = session.actor || '管理员';
  $('#actorName').textContent = state.actor; $('#loginView').hidden = true; $('#appView').hidden = false;
  void switchView(state.view);
}

const metric = (label, value, detail) => {
  const item = node('article', undefined, 'metric'); item.append(node('small', label), node('strong', value), node('span', detail)); return item;
};
const detailRows = (container, rows) => {
  container.replaceChildren(...rows.map(([term, description]) => { const row = node('div'); row.append(node('dt', term), node('dd', description)); return row; }));
};

async function loadOverview() {
  const data = await api('/overview'); const { summary } = data;
  $('#metrics').replaceChildren(
    metric('注册居民', formatNumber(summary.users), `${summary.disabledUsers} 个账号已停用`),
    metric('当前在线', formatNumber(data.online), '实时 WebSocket 会话'),
    metric('已认领住房', formatNumber(summary.houses), `${summary.housingRequests} 个待处理请求`),
    metric('运行时间', formatDuration(data.uptimeSeconds), `数据库 ${formatBytes(summary.databaseBytes)}`),
  );
  const integrity = $('#integrityStatus'); integrity.textContent = data.integrity.ok ? '正常' : '异常'; integrity.className = `status${data.integrity.ok ? '' : ' bad'}`;
  detailRows($('#databaseDetails'), [['完整性检查', data.integrity.message], ['物品记录', formatNumber(summary.inventoryRows)], ['剧情存档', formatNumber(summary.storyRows)], ['最近备份', data.backups[0] ? formatDate(data.backups[0].createdAt) : '尚无备份']]);
  detailRows($('#backupPolicy'), [['自动备份', data.backupPolicy.enabled ? '已启用' : '已停用'], ['备份间隔', `${data.backupPolicy.intervalMinutes} 分钟`], ['保留期限', `${data.backupPolicy.retentionDays} 天`], ['现有备份', `${data.backups.length} 个（最近）`]]);
}

async function loadUsers() {
  const query = encodeURIComponent($('#userQuery').value.trim()); const data = await api(`/users?q=${query}&limit=100`);
  $('#userCount').textContent = `共 ${formatNumber(data.total)} 人`;
  const rows = data.items.map((user) => {
    const row = node('tr');
    const identity = node('td'); identity.append(node('strong', user.nickname), node('small', user.id));
    const status = node('td', user.disabled ? '已停用' : '正常');
    const actions = node('td', undefined, 'align-right'); const group = node('div', undefined, 'row-actions');
    const revoke = node('button', '撤销会话'); revoke.type = 'button'; revoke.addEventListener('click', () => confirmAction('撤销登录会话', `将强制 ${user.nickname} 重新登录。`, () => mutateUser(user.id, 'revoke-session', {})));
    const toggle = node('button', user.disabled ? '启用' : '停用', user.disabled ? '' : 'warning'); toggle.type = 'button'; toggle.addEventListener('click', () => confirmAction(user.disabled ? '启用居民' : '停用居民', `确认${user.disabled ? '启用' : '停用'} ${user.nickname}？`, () => mutateUser(user.id, 'status', { disabled: !user.disabled }, 'PATCH')));
    group.append(revoke, toggle); actions.append(group);
    row.append(identity, status, node('td', user.houseId || '未入住'), node('td', formatDate(user.updatedAt)), actions); return row;
  });
  $('#userRows').replaceChildren(...(rows.length ? rows : [emptyRow(5, '没有找到居民')]));
}
async function mutateUser(id, action, body, method = 'POST') {
  await api(`/users/${id}/${action}`, { method, body: JSON.stringify(body) }); showNotice('居民状态已更新', true); await loadUsers();
}

async function loadHouses() {
  const data = await api('/houses'); $('#houseCount').textContent = `${data.items.length} 间`;
  const rows = data.items.map((house) => { const row = node('tr'); row.append(node('td', house.buildingId), node('td', house.ownerNickname), node('td', house.name || '未命名'), node('td', house.members.map((member) => member.nickname).join('、'))); return row; });
  $('#houseRows').replaceChildren(...(rows.length ? rows : [emptyRow(4, '暂无已认领住房')]));
}

async function loadBackups() {
  const data = await api('/backups'); const rows = data.items.map((backup) => {
    const row = node('tr'); const actions = node('td', undefined, 'align-right');
    const group = node('div', undefined, 'row-actions');
    const verify = node('button', '重新校验'); verify.type = 'button'; verify.addEventListener('click', async () => {
      verify.disabled = true;
      try { await api(`/backups/${encodeURIComponent(backup.name)}/verify`, { method: 'POST' }); showNotice('备份完整性校验通过', true); await loadBackups(); }
      catch (error) { showNotice(error.message); }
      finally { verify.disabled = false; }
    });
    const link = node('a', '下载', 'download'); link.href = `/admin/api/backups/${encodeURIComponent(backup.name)}`;
    group.append(verify, link); actions.append(group);
    row.append(node('td', backup.name), node('td', formatDate(backup.createdAt)), node('td', backup.verified ? formatDate(backup.verifiedAt) : '待校验'), node('td', formatBytes(backup.bytes)), actions); return row;
  });
  $('#backupRows').replaceChildren(...(rows.length ? rows : [emptyRow(5, '尚无数据库备份')]));
}
async function createBackup() {
  const buttons = [$('#backupButton'), $('#overviewBackupButton')]; buttons.forEach((button) => { button.disabled = true; });
  try { await api('/backups', { method: 'POST' }); showNotice('数据库备份已创建', true); await Promise.all([loadBackups(), loadOverview()]); }
  finally { buttons.forEach((button) => { button.disabled = false; }); }
}

async function loadAudit() {
  const data = await api('/audit?limit=100'); const rows = data.items.map((entry) => { const row = node('tr'); row.append(node('td', formatDate(entry.createdAt)), node('td', entry.actor), node('td', entry.action), node('td', entry.target || '全局')); return row; });
  $('#auditRows').replaceChildren(...(rows.length ? rows : [emptyRow(4, '暂无审计记录')]));
}
function emptyRow(columns, text) { const row = node('tr'); const cell = node('td', text, 'empty'); cell.colSpan = columns; row.append(cell); return row; }

const loaders = { overview: loadOverview, users: loadUsers, houses: loadHouses, backups: loadBackups, audit: loadAudit };
const titles = { overview: '运行概览', users: '居民管理', houses: '住房数据', backups: '数据库备份', audit: '审计日志' };
async function switchView(view) {
  state.view = view; $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $$('.view').forEach((page) => { const active = page.dataset.page === view; page.hidden = !active; page.classList.toggle('active', active); });
  $('#viewTitle').textContent = titles[view];
  try { await loaders[view](); } catch (error) { showNotice(error.message); }
}

function confirmAction(title, copy, action) {
  const dialog = $('#confirmDialog'); $('#confirmTitle').textContent = title; $('#confirmCopy').textContent = copy;
  dialog.returnValue = ''; dialog.showModal(); dialog.addEventListener('close', async function handle() { dialog.removeEventListener('close', handle); if (dialog.returnValue === 'confirm') try { await action(); } catch (error) { showNotice(error.message); } });
}

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const button = $('#loginButton'); const error = $('#loginError'); button.disabled = true; error.hidden = true;
  try { const session = await api('/login', { method: 'POST', body: JSON.stringify({ username: $('#loginUsername').value, password: $('#loginPassword').value }) }); showApp(session); }
  catch (caught) { error.textContent = caught.message; error.hidden = false; }
  finally { button.disabled = false; }
});
$('#navigation').addEventListener('click', (event) => { const button = event.target.closest('[data-view]'); if (button) void switchView(button.dataset.view); });
$('#refreshButton').addEventListener('click', () => void switchView(state.view));
$('#userSearch').addEventListener('submit', (event) => { event.preventDefault(); void loadUsers(); });
$('#backupButton').addEventListener('click', () => void createBackup()); $('#overviewBackupButton').addEventListener('click', () => void createBackup());
$('#checkpointButton').addEventListener('click', async () => { try { await api('/database/checkpoint', { method: 'POST' }); showNotice('WAL 检查点已执行', true); await loadOverview(); } catch (error) { showNotice(error.message); } });
$('#logoutButton').addEventListener('click', async () => { try { await api('/logout', { method: 'POST' }); } finally { showLogin(); } });

try { const session = await api('/session'); session.authenticated ? showApp(session) : showLogin(); } catch { showLogin(); }
