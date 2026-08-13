const state = { csrf: '', actor: '', view: 'overview', houses: [], chatFilter: 'visible', storyFilter: '' };
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
  detailRows($('#databaseDetails'), [['完整性检查', data.integrity.message], ['物品记录', formatNumber(summary.inventoryRows)], ['剧情存档', formatNumber(summary.storyParticipants)], ['聊天记录', formatNumber(summary.chatMessages)], ['最近备份', data.backups[0] ? formatDate(data.backups[0].createdAt) : '尚无备份']]);
  detailRows($('#backupPolicy'), [['自动备份', data.backupPolicy.enabled ? '已启用' : '已停用'], ['备份间隔', `${data.backupPolicy.intervalMinutes} 分钟`], ['保留期限', `${data.backupPolicy.retentionDays} 天`], ['现有备份', `${data.backups.length} 个（最近）`]]);
}

async function loadUsers() {
  const query = encodeURIComponent($('#userQuery').value.trim()); const data = await api(`/users?q=${query}&limit=100`);
  state.houses = (await api('/houses')).items;
  $('#userCount').textContent = `共 ${formatNumber(data.total)} 人`;
  const rows = data.items.map((user) => {
    const row = node('tr');
    const identity = node('td'); identity.append(node('strong', user.nickname), node('small', user.id));
    const status = node('td', user.disabled ? '已停用' : '正常');
    const houseName = user.houseId ? (state.houses.find((house) => house.buildingId === user.houseId)?.name || user.houseId) : '未入住';
    const actions = node('td', undefined, 'align-right'); const group = node('div', undefined, 'row-actions');
    const edit = node('button', '编辑'); edit.type = 'button'; edit.addEventListener('click', () => openUserEditor(user));
    const revoke = node('button', '撤销会话'); revoke.type = 'button'; revoke.addEventListener('click', () => confirmAction('撤销登录会话', `将强制 ${user.nickname} 重新登录。`, () => mutateUser(user.id, 'revoke-session', {})));
    const toggle = node('button', user.disabled ? '启用' : '停用', user.disabled ? '' : 'warning'); toggle.type = 'button'; toggle.addEventListener('click', () => confirmAction(user.disabled ? '启用居民' : '停用居民', `确认${user.disabled ? '启用' : '停用'} ${user.nickname}？`, () => mutateUser(user.id, 'status', { disabled: !user.disabled }, 'PATCH')));
    group.append(edit, revoke, toggle); actions.append(group);
    row.append(identity, status, node('td', houseName), node('td', formatDate(user.updatedAt)), actions); return row;
  });
  $('#userRows').replaceChildren(...(rows.length ? rows : [emptyRow(5, '没有找到居民')]));
}
async function mutateUser(id, action, body, method = 'POST') {
  await api(`/users/${id}/${action}`, { method, body: JSON.stringify(body) }); showNotice('居民状态已更新', true); await loadUsers();
}

function openUserEditor(user) {
  const dialog = $('#userDialog'); $('#userDialogTitle').textContent = `编辑 ${user.nickname}`;
  $('#userDialogId').value = user.id;
  $('#userDialogNickname').value = user.nickname;
  const houseSelect = $('#userDialogHouse');
  const blank = node('option', '未入住'); blank.value = '';
  houseSelect.replaceChildren(blank);
  if (!user.houseId) blank.selected = true;
  for (const house of state.houses ?? []) { const option = node('option', `${house.name || house.buildingId}（${house.memberCount} 人）`); option.value = house.buildingId; if (house.buildingId === user.houseId) option.selected = true; houseSelect.append(option); }
  dialog.returnValue = ''; dialog.showModal();
}
async function submitUserEditor() {
  const id = $('#userDialogId').value;
  const nickname = $('#userDialogNickname').value.trim();
  const houseValue = $('#userDialogHouse').value;
  const houseId = houseValue === '' ? null : houseValue;
  if (!nickname) { showNotice('昵称不能为空'); return; }
  try {
    await api(`/users/${id}`, { method: 'PATCH', body: JSON.stringify({ nickname, houseId }) });
    showNotice('居民信息已更新', true); $('#userDialog').close(); await loadUsers();
  } catch (error) { showNotice(error.message); }
}

async function loadHouses() {
  const data = await api('/houses'); $('#houseCount').textContent = `${data.items.length} 间`;
  const rows = data.items.map((house) => {
    const row = node('tr'); const actions = node('td', undefined, 'align-right'); const group = node('div', undefined, 'row-actions');
    const edit = node('button', '编辑'); edit.type = 'button'; edit.addEventListener('click', () => openHouseEditor(house));
    group.append(edit); actions.append(group);
    row.append(node('td', house.buildingId), node('td', house.ownerNickname), node('td', house.name || '未命名'), node('td', `${house.members.map((member) => member.nickname).join('、')}（${house.memberCount} 人）`), actions); return row;
  });
  $('#houseRows').replaceChildren(...(rows.length ? rows : [emptyRow(5, '暂无已认领住房')]));
}
function openHouseEditor(house) {
  const dialog = $('#houseDialog');
  $('#houseDialogId').value = house.buildingId;
  $('#houseDialogName').value = house.name || '';
  const memberInput = $('#houseDialogMembers'); memberInput.value = house.members.map((member) => member.userId).join(',');
  $('#houseDialogMemberHint').textContent = `当前 ${house.memberCount} 人；以逗号分隔用户 ID，房主会自动保留（最多 10 人）。`;
  dialog.returnValue = ''; dialog.showModal();
}
async function submitHouseEditor() {
  const buildingId = $('#houseDialogId').value;
  const name = $('#houseDialogName').value.trim();
  const raw = $('#houseDialogMembers').value.split(',').map((item) => item.trim()).filter(Boolean);
  try {
    await api(`/houses/${encodeURIComponent(buildingId)}`, { method: 'PATCH', body: JSON.stringify({ name, memberIds: raw }) });
    showNotice('住房信息已更新', true); $('#houseDialog').close(); await loadHouses();
  } catch (error) { showNotice(error.message); }
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
    const link = node('a', '下载', 'download'); link.href = `/admin/api/backups/${encodeURIComponent(backup.name)}`; link.download = backup.name;
    const restore = node('button', '恢复'); restore.type = 'button'; restore.addEventListener('click', () => confirmAction('恢复备份', `将用 ${backup.name} 覆盖当前数据库，所有在线居民会被强制下线并需重新登录。确定继续？`, () => restoreBackup(backup.name)));
    group.append(verify, link, restore); actions.append(group);
    row.append(node('td', backup.name), node('td', formatDate(backup.createdAt)), node('td', backup.verified ? formatDate(backup.verifiedAt) : '待校验'), node('td', formatBytes(backup.bytes)), actions); return row;
  });
  $('#backupRows').replaceChildren(...(rows.length ? rows : [emptyRow(5, '尚无数据库备份')]));
}
async function restoreBackup(name) {
  try { await api(`/backups/${encodeURIComponent(name)}/restore`, { method: 'POST', body: JSON.stringify({ confirm: true }) }); showNotice('备份已恢复，所有居民会话已撤销', true); await Promise.all([loadBackups(), loadOverview()]); }
  catch (error) { showNotice(error.message); }
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

async function loadChat() {
  const query = encodeURIComponent($('#chatQuery').value.trim());
  const filter = state.chatFilter;
  const flag = filter === 'flagged' ? '&flagged=1' : filter === 'hidden' ? '&hidden=only' : filter === 'all' ? '&hidden=1' : '';
  const data = await api(`/chat?q=${query}${flag}&limit=100`);
  $('#chatCount').textContent = `共 ${formatNumber(data.total)} 条`;
  const rows = data.items.map((message) => {
    const row = node('tr');
    const identity = node('td'); identity.append(node('strong', message.nickname), node('small', message.userId));
    const meta = node('td'); meta.append(node('div', message.text), node('small', formatDate(message.createdAt)));
    const status = node('td', message.hiddenAt ? '已隐藏' : message.flaggedAt ? '已标记' : '正常');
    const actions = node('td', undefined, 'align-right'); const group = node('div', undefined, 'row-actions');
    const hide = node('button', message.hiddenAt ? '显示' : '隐藏', message.hiddenAt ? '' : 'warning'); hide.type = 'button'; hide.addEventListener('click', () => mutateChat(message.id, message.hiddenAt ? 'show' : 'hide'));
    const flagBtn = node('button', '标记'); flagBtn.type = 'button'; flagBtn.addEventListener('click', () => mutateChat(message.id, 'flag'));
    group.append(hide, flagBtn); actions.append(group);
    row.append(identity, meta, status, actions); return row;
  });
  $('#chatRows').replaceChildren(...(rows.length ? rows : [emptyRow(4, '暂无聊天记录')]));
  const authors = await api('/chat/authors?limit=100');
  const authorRows = authors.items.map((author) => { const row = node('tr'); row.append(node('td', author.nickname), node('td', formatNumber(author.messages)), node('td', formatNumber(author.flagged)), node('td', formatNumber(author.hidden)), node('td', formatDate(author.lastAt))); return row; });
  $('#chatAuthorRows').replaceChildren(...(authorRows.length ? authorRows : [emptyRow(5, '暂无发言')]));
}
async function mutateChat(id, action) {
  try { await api(`/chat/${id}/${action}`, { method: 'POST' }); showNotice(action === 'flag' ? '已标记' : '已更新', true); await loadChat(); }
  catch (error) { showNotice(error.message); }
}

async function loadStoryProgress() {
  const query = encodeURIComponent($('#storyQuery').value.trim());
  const data = await api(`/story-progress?q=${query}&limit=100`);
  const catalog = await api('/stories');
  $('#storyProgressCount').textContent = `共 ${formatNumber(data.total)} 条`;
  const rows = data.items.map((row) => {
    const tr = node('tr');
    const identity = node('td'); identity.append(node('strong', row.nickname), node('small', row.userId));
    const storyCell = node('td', row.story?.title || row.storyId);
    const nodeCell = node('td'); nodeCell.append(node('div', row.nodeTitle), node('small', `${row.nodeId}${row.ending ? ` · 结局：${row.ending}` : ''} · 访问 ${row.visitCount} 次`));
    const updated = node('td', formatDate(row.updatedAt));
    const nodesCell = node('td', undefined, 'node-list'); nodesCell.append(node('small', `${row.story?.nodes?.length ?? 0} 个节点：`), node('small', (row.story?.nodes ?? []).slice(0, 12).map((n) => n.title || n.id).join('、') || '—'));
    tr.append(identity, storyCell, nodeCell, updated, nodesCell); return tr;
  });
  $('#storyRows').replaceChildren(...(rows.length ? rows : [emptyRow(5, '暂无剧情存档')]));
  const storyList = $('#storyCatalog'); storyList.replaceChildren(...catalog.items.map((story) => { const li = node('li'); li.append(node('strong', story.title), node('small', `${story.id} · 定义版本 ${story.definitionVersion} · ${story.nodes.length} 个节点`)); return li; }));
}

const loaders = { overview: loadOverview, users: loadUsers, houses: loadHouses, backups: loadBackups, audit: loadAudit, chat: loadChat, story: loadStoryProgress };
const titles = { overview: '运行概览', users: '居民管理', houses: '住房数据', backups: '数据库备份', audit: '审计日志', chat: '聊天审核', story: '剧情与任务' };
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
$('#chatSearch').addEventListener('submit', (event) => { event.preventDefault(); void loadChat(); });
$('#chatFilter').addEventListener('change', (event) => { state.chatFilter = event.target.value; void loadChat(); });
$('#storySearch').addEventListener('submit', (event) => { event.preventDefault(); void loadStoryProgress(); });
$('#userDialogSubmit').addEventListener('click', () => void submitUserEditor());
$('#houseDialogSubmit').addEventListener('click', () => void submitHouseEditor());

try { const session = await api('/session'); session.authenticated ? showApp(session) : showLogin(); } catch { showLogin(); }
