const state = {
  csrf: '', actor: '', view: 'overview', houses: [], users: [], houseDraftMembers: [], houseEditingOwnerId: '',
  chatFilter: 'visible', storyFilter: '', npcs: [], npcSelectedId: '', npcRequestFilter: 'pending',
  offsiteEnabled: false, localBackups: [],
  worldWeather: '', worldWeatherAuto: false, worldWeatherDraft: '', worldWeatherAutoDraft: false,
  worldBuildings: [], worldOverrides: {}, worldDraft: {}, worldSelectedId: '',
};
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
const svgNode = (tag, attrs = {}) => {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
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
  $('#actorName').textContent = state.actor; $('#actorName').title = state.actor; $('#loginView').hidden = true; $('#appView').hidden = false;
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
  state.offsiteEnabled = data.offsite?.enabled === true;
  $('#metrics').replaceChildren(
    metric('注册居民', formatNumber(summary.users), `${summary.disabledUsers} 个账号已停用`),
    metric('当前在线', formatNumber(data.online), '实时 WebSocket 会话'),
    metric('已认领住房', formatNumber(summary.houses), `${summary.housingRequests} 个待处理请求`),
    metric('运行时间', formatDuration(data.uptimeSeconds), `数据库 ${formatBytes(summary.databaseBytes)}`),
  );
  const integrity = $('#integrityStatus'); integrity.textContent = data.integrity.ok ? '正常' : '异常'; integrity.className = `status${data.integrity.ok ? '' : ' bad'}`;
  detailRows($('#databaseDetails'), [['完整性检查', data.integrity.message], ['物品记录', formatNumber(summary.inventoryRows)], ['剧情存档', formatNumber(summary.storyParticipants)], ['聊天记录', formatNumber(summary.chatMessages)], ['最近备份', data.backups[0] ? formatDate(data.backups[0].createdAt) : '尚无备份']]);
  detailRows($('#backupPolicy'), [['自动备份', data.backupPolicy.enabled ? '已启用' : '已停用'], ['备份间隔', `${data.backupPolicy.intervalMinutes} 分钟`], ['保留期限', `${data.backupPolicy.retentionDays} 天`], ['现有备份', `${data.backups.length} 个（最近）`], ['异地备份', data.offsite?.enabled ? '已配置' : '未配置']]);
}

async function loadUsers() {
  const query = encodeURIComponent($('#userQuery').value.trim()); const data = await api(`/users?q=${query}&limit=100`);
  state.users = data.items;
  state.houses = (await api('/houses')).items;
  $('#userCount').textContent = `共 ${formatNumber(data.total)} 人`;
  const rows = data.items.map((user) => {
    const row = node('tr');
    const identity = node('td'); const name = node('strong', user.nickname); name.title = user.nickname; identity.append(name, node('small', user.id));
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
  const [data, users] = await Promise.all([api('/houses'), api('/users?limit=100')]);
  state.houses = data.items;
  state.users = users.items;
  $('#houseCount').textContent = `${data.items.length} 间`;
  const rows = data.items.map((house) => {
    const row = node('tr'); const actions = node('td', undefined, 'align-right'); const group = node('div', undefined, 'row-actions');
    const edit = node('button', '编辑'); edit.type = 'button'; edit.addEventListener('click', () => openHouseEditor(house));
    const remove = node('button', '删除', 'warning'); remove.type = 'button'; remove.addEventListener('click', () => confirmAction('删除住房', `删除「${house.name || house.buildingId}」后，成员会变为未入住。确定继续？`, () => deleteHouse(house.buildingId)));
    group.append(edit, remove); actions.append(group);
    row.append(node('td', house.buildingId), node('td', house.ownerNickname), node('td', house.name || '未命名'), node('td', `${house.members.map((member) => member.nickname).join('、')}（${house.memberCount} 人）`), actions); return row;
  });
  $('#houseRows').replaceChildren(...(rows.length ? rows : [emptyRow(5, '暂无已认领住房')]));
}
function openHouseEditor(house) {
  const dialog = $('#houseDialog');
  $('#houseDialogId').value = house.buildingId;
  $('#houseDialogName').value = house.name || '';
  state.houseDraftMembers = house.members.map((member) => ({ ...member }));
  state.houseEditingOwnerId = house.ownerId;
  renderHouseMembers();
  dialog.returnValue = ''; dialog.showModal();
}
function renderHouseMembers() {
  const memberList = $('#houseDialogMembers');
  const rows = state.houseDraftMembers.map((member) => {
    const item = node('div', undefined, 'member-item');
    const identity = node('span', undefined, 'member-identity'); identity.append(node('strong', member.nickname), node('small', member.userId));
    if (member.userId === state.houseEditingOwnerId) {
      item.append(identity, node('span', '房主', 'member-owner'));
    } else {
      const remove = node('button', '删除', 'member-remove'); remove.type = 'button'; remove.addEventListener('click', () => {
        state.houseDraftMembers = state.houseDraftMembers.filter((candidate) => candidate.userId !== member.userId);
        renderHouseMembers();
      });
      item.append(identity, remove);
    }
    return item;
  });
  memberList.replaceChildren(...rows);

  const selectedIds = new Set(state.houseDraftMembers.map((member) => member.userId));
  const candidates = state.users.filter((user) => !selectedIds.has(user.id) && !user.houseId && !user.disabled);
  const select = $('#houseDialogMemberSelect');
  const placeholder = node('option', candidates.length ? '选择未入住居民' : '暂无可添加居民'); placeholder.value = '';
  select.replaceChildren(placeholder, ...candidates.map((user) => { const option = node('option', `${user.nickname}（${user.id}）`); option.value = user.id; return option; }));
  select.disabled = candidates.length === 0 || state.houseDraftMembers.length >= 10;
  $('#houseDialogMemberAdd').disabled = select.disabled;
  $('#houseDialogMemberHint').textContent = `当前 ${state.houseDraftMembers.length} 人；房主不可删除，最多 10 人。`;
}
function addHouseMember() {
  const userId = $('#houseDialogMemberSelect').value;
  const user = state.users.find((candidate) => candidate.id === userId);
  if (!user || state.houseDraftMembers.some((member) => member.userId === userId) || state.houseDraftMembers.length >= 10) return;
  state.houseDraftMembers.push({ userId: user.id, nickname: user.nickname });
  renderHouseMembers();
}
async function submitHouseEditor() {
  const buildingId = $('#houseDialogId').value;
  const name = $('#houseDialogName').value.trim();
  const memberIds = state.houseDraftMembers.map((member) => member.userId);
  try {
    await api(`/houses/${encodeURIComponent(buildingId)}`, { method: 'PATCH', body: JSON.stringify({ name, memberIds }) });
    showNotice('住房信息已更新', true); $('#houseDialog').close(); await loadHouses();
  } catch (error) { showNotice(error.message); }
}
async function deleteHouse(buildingId) {
  await api(`/houses/${encodeURIComponent(buildingId)}`, { method: 'DELETE' });
  showNotice('住房已删除', true);
  await loadHouses();
}

async function loadBackups() {
  const data = await api('/backups'); state.localBackups = data.items;
  renderBackupRows(data.items);
  if (state.offsiteEnabled) await loadOffsiteBackups();
}
function renderBackupRows(items) {
  const rows = items.map((backup) => {
    const row = node('tr'); const actions = node('td', undefined, 'align-right');
    const group = node('div', undefined, 'row-actions');
    const verify = node('button', '重新校验'); verify.type = 'button'; verify.addEventListener('click', async () => {
      verify.disabled = true;
      try { await api(`/backups/${encodeURIComponent(backup.name)}/verify`, { method: 'POST' }); showNotice('备份完整性校验通过', true); await loadBackups(); }
      catch (error) { showNotice(error.message); }
      finally { verify.disabled = false; }
    });
    const link = node('a', '下载', 'download'); link.href = `/admin/api/backups/${encodeURIComponent(backup.name)}`; link.download = backup.name;
    const restore = node('button', '恢复'); restore.type = 'button'; restore.addEventListener('click', () => confirmAction('恢复备份', `将用 ${backup.name} 覆盖当前数据库，在线居民会全部下线。确定继续？`, () => restoreBackup(backup.name)));
    group.append(verify, link, restore);
    if (state.offsiteEnabled) {
      const offsite = node('button', '上传异地'); offsite.type = 'button';
      offsite.addEventListener('click', async () => {
        offsite.disabled = true;
        try { await api(`/offsite/backups/${encodeURIComponent(backup.name)}/upload`, { method: 'POST' }); showNotice('备份已上传到异地', true); await loadBackups(); }
        catch (error) { showNotice(error.message); }
        finally { offsite.disabled = false; }
      });
      group.append(offsite);
    }
    actions.append(group);
    row.append(node('td', backup.name), node('td', formatDate(backup.createdAt)), node('td', backup.verified ? formatDate(backup.verifiedAt) : '待校验', 'nowrap'), node('td', formatBytes(backup.bytes)), actions); return row;
  });
  $('#backupRows').replaceChildren(...(rows.length ? rows : [emptyRow(5, '尚无数据库备份')]));
}
async function loadOffsiteBackups() {
  let data;
  try { data = await api('/offsite/backups'); }
  catch (error) {
    if (state.offsiteEnabled) { state.offsiteEnabled = false; renderBackupRows(state.localBackups ?? []); }
    $('#offsitePanel').hidden = true;
    return;
  }
  const changed = state.offsiteEnabled !== true;
  state.offsiteEnabled = true; $('#offsitePanel').hidden = false;
  const rows = data.items.map((backup) => {
    const row = node('tr');
    const status = backup.orphan ? '缺失' : backup.inSync ? '一致' : '校验不一致';
    const statusCell = node('td'); const badge = node('span', status, `status nowrap${backup.orphan || !backup.inSync ? ' bad' : ''}`); statusCell.append(badge);
    const actions = node('td', undefined, 'align-right'); const group = node('div', undefined, 'row-actions');
    const link = node('a', '下载', 'download'); link.href = `/admin/api/offsite/backups/${encodeURIComponent(backup.name)}`; link.download = backup.name;
    const restore = node('button', '恢复'); restore.type = 'button';
    restore.addEventListener('click', () => confirmAction('从异地恢复备份', `将用 ${backup.name} 覆盖当前数据库，在线居民会全部下线。确定继续？`, () => restoreOffsiteBackup(backup.name)));
    const del = node('button', '删除', 'warning'); del.type = 'button';
    del.addEventListener('click', () => confirmAction('删除异地备份', `删除 OSS 上的 ${backup.name}，本机备份不受影响。确定继续？`, () => deleteOffsite(backup.name)));
    group.append(link, restore, del); actions.append(group);
    row.append(node('td', backup.name), node('td', formatDate(backup.uploadedAt)), node('td', backup.sha256 ? '已校验' : '—', 'nowrap'), node('td', formatBytes(backup.bytes)), statusCell, actions); return row;
  });
  $('#offsiteRows').replaceChildren(...(rows.length ? rows : [emptyRow(6, '尚无异地备份')]));
  if (changed) renderBackupRows(state.localBackups ?? []);
}
async function deleteOffsite(name) {
  try { await api(`/offsite/backups/${encodeURIComponent(name)}`, { method: 'DELETE' }); showNotice('异地备份已删除', true); await loadBackups(); }
  catch (error) { showNotice(error.message); }
}
async function restoreBackup(name) {
      try { await api(`/backups/${encodeURIComponent(name)}/restore`, { method: 'POST', body: JSON.stringify({ confirm: true }) }); showNotice('备份已恢复', true); await Promise.all([loadBackups(), loadOverview()]); }
  catch (error) { showNotice(error.message); }
}
async function restoreOffsiteBackup(name) {
      try { await api(`/offsite/backups/${encodeURIComponent(name)}/restore`, { method: 'POST', body: JSON.stringify({ confirm: true }) }); showNotice('异地备份已恢复', true); await Promise.all([loadBackups(), loadOverview()]); }
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
    const moderationLabels = { pending: '审核中', approved: '审核通过', rejected: '自动拦截', error: '审核异常', unreviewed: '未审核' };
    const baseStatus = message.hiddenAt ? '已隐藏' : message.flaggedAt ? '已标记' : '正常';
    const moderationStatus = moderationLabels[message.moderationStatus] || '未审核';
    const risks = Array.isArray(message.moderationRiskTypes) && message.moderationRiskTypes.length ? `：${message.moderationRiskTypes.join('、')}` : '';
    const status = node('td', `${baseStatus} · ${moderationStatus}${risks}`);
    if (message.moderationRequestId) status.title = `智谱请求号：${message.moderationRequestId}`;
    else if (message.moderationError) status.title = message.moderationError;
    const actions = node('td', undefined, 'align-right'); const group = node('div', undefined, 'row-actions');
    const hide = node('button', message.hiddenAt ? '显示' : '隐藏', message.hiddenAt ? '' : 'warning'); hide.type = 'button'; hide.addEventListener('click', () => mutateChat(message.id, message.hiddenAt ? 'show' : 'hide'));
    const flagBtn = node('button', '标记'); flagBtn.type = 'button'; flagBtn.addEventListener('click', () => mutateChat(message.id, 'flag'));
    group.append(hide, flagBtn); actions.append(group);
    row.append(identity, meta, status, actions); return row;
  });
  $('#chatRows').replaceChildren(...(rows.length ? rows : [emptyRow(4, '暂无聊天记录')]));
  const authors = await api('/chat/authors?limit=100');
  const authorRows = authors.items.map((author) => {
    const row = node('tr');
    const identity = node('td'); identity.append(node('strong', author.nickname), node('small', author.userId));
    const actions = node('td', undefined, 'align-right'); const group = node('div', undefined, 'row-actions');
    const ban = node('button', author.disabled ? '已封禁' : '封禁用户', author.disabled ? '' : 'warning'); ban.type = 'button'; ban.disabled = author.disabled;
    ban.addEventListener('click', () => confirmAction('封禁用户', `封禁 ${author.nickname} 后将立即下线。确定继续？`, () => disableChatAuthor(author)));
    group.append(ban); actions.append(group);
    row.append(identity, node('td', formatNumber(author.messages)), node('td', formatNumber(author.flagged)), node('td', formatNumber(author.hidden)), node('td', formatDate(author.lastAt)), actions); return row;
  });
  $('#chatAuthorRows').replaceChildren(...(authorRows.length ? authorRows : [emptyRow(6, '暂无发言')]));
}
async function mutateChat(id, action) {
  try { await api(`/chat/${id}/${action}`, { method: 'POST' }); showNotice(action === 'flag' ? '已标记' : '已更新', true); await loadChat(); }
  catch (error) { showNotice(error.message); }
}
async function disableChatAuthor(author) {
  await api(`/users/${author.userId}/status`, { method: 'PATCH', body: JSON.stringify({ disabled: true }) });
  showNotice(`${author.nickname} 已封禁`, true);
  await loadChat();
}

async function loadStoryProgress() {
  const query = encodeURIComponent($('#storyQuery').value.trim());
  const [data, catalog] = await Promise.all([api(`/story-progress?q=${query}&limit=100`), api('/stories')]);
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
  const storyList = $('#storyCatalog');
  storyList.replaceChildren(...catalog.items.map((story) => {
    const li = node('li', undefined, 'story-catalog-item');
    const heading = node('div', undefined, 'story-catalog-heading');
    heading.append(node('strong', story.title), node('small', `${story.id} · 定义版本 ${story.definitionVersion} · ${story.nodes.length} 个节点`));
    const nodes = node('div', undefined, 'story-node-grid');
    nodes.append(...story.nodes.map((storyNode) => {
      const entry = node('div', undefined, 'story-node-entry');
      entry.append(node('code', storyNode.id), node('span', storyNode.title || '未命名节点'));
      return entry;
    }));
    if (!story.nodes.length) nodes.append(node('p', '该任务尚未定义节点', 'empty'));
    li.append(heading, nodes);
    return li;
  }));
}

const sparkline = (container, data, color) => {
  container.replaceChildren();
  if (!data.length) { container.append(node('small', '暂无数据')); return; }
  const max = Math.max(1, ...data);
  const bar = node('div', undefined, 'sparkline-bars');
  for (const value of data) {
    const column = node('span', undefined, 'sparkline-bar');
    column.style.height = `${Math.max(2, Math.round((value / max) * 100))}%`;
    column.style.background = color;
    bar.append(column);
  }
  container.append(bar);
};
const shortId = (value) => (value ? `${String(value).slice(0, 8)}…` : '匿名');

async function loadTelemetry() {
  const [overview, health, logs, events, errors] = await Promise.all([
    api('/telemetry/overview'), api('/telemetry/health'), api('/telemetry/logs?lines=200'), api('/telemetry/events?limit=50'), api('/telemetry/errors?limit=50'),
  ]);
  $('#telemetryMetrics').replaceChildren(
    metric('事件总数', formatNumber(overview.events.total), `近 24 小时 ${formatNumber(overview.events.last24h)}`),
    metric('错误总数', formatNumber(overview.errors.total), `近 24 小时 ${formatNumber(overview.errors.last24h)}`),
    metric('当前在线', formatNumber(health.online), `运行 ${formatDuration(health.uptimeSeconds)}`),
    metric('HTTP 请求', formatNumber(health.counters.httpRequests), `WS 消息 ${formatNumber(health.counters.wsMessages)}`),
  );
  sparkline($('#eventSparkline'), overview.timeline.map((point) => point.events), '#176b4a');
  sparkline($('#errorSparkline'), overview.timeline.map((point) => point.errors), '#a63737');
  $('#topEvents').replaceChildren(...(overview.events.top.length ? overview.events.top.map((entry) => { const li = node('li'); li.append(node('strong', entry.event), node('small', `${formatNumber(entry.count)} 次`)); return li; }) : [node('li', '暂无事件', 'empty')]));
  $('#topErrors').replaceChildren(...(overview.errors.top.length ? overview.errors.top.map((entry) => { const li = node('li'); li.append(node('strong', `${entry.kind} · ${entry.message}`), node('small', `${formatNumber(entry.count)} 次`)); return li; }) : [node('li', '暂无错误', 'empty')]));
  const healthStatus = $('#serverHealthStatus');
  const ok = health.recentErrors.length === 0;
  healthStatus.textContent = ok ? '正常' : '有近期错误'; healthStatus.className = `status${ok ? '' : ' bad'}`;
  const mb = (bytes) => formatBytes(bytes);
  detailRows($('#serverHealth'), [
    ['启动时间', formatDate(health.startedAt)], ['运行时长', formatDuration(health.uptimeSeconds)], ['在线会话', formatNumber(health.online)],
    ['WebSocket 连接', formatNumber(health.counters.wsConnects)], ['WebSocket 消息', formatNumber(health.counters.wsMessages)], ['聊天消息', formatNumber(health.counters.chatMessages)],
    ['HTTP 请求', formatNumber(health.counters.httpRequests)], ['HTTP 错误', formatNumber(health.counters.httpErrors)], ['前端错误上报', formatNumber(health.counters.clientErrors)],
    ['RSS 内存', mb(health.memory.rss)], ['堆使用', mb(health.memory.heapUsed)], ['堆总量', mb(health.memory.heapTotal)],
    ['近期错误', health.recentErrors.length ? `${health.recentErrors.length} 条` : '无'],
  ]);
  const recentBox = $('#serverLogs'); recentBox.textContent = logs.lines.length ? logs.lines.join('\n') : `日志文件 ${logs.file} 暂无内容`; recentBox.scrollTop = recentBox.scrollHeight;
  const eventRows = events.items.map((entry) => { const row = node('tr'); row.append(node('td', formatDate(entry.createdAt)), node('td', entry.event), node('td', shortId(entry.sessionId)), node('td', entry.ip || '—')); return row; });
  $('#eventRows').replaceChildren(...(eventRows.length ? eventRows : [emptyRow(4, '暂无事件')]));
  const errorRows = errors.items.map((entry) => { const row = node('tr'); const message = node('td'); message.append(node('div', entry.message), node('small', entry.url || '—')); row.append(node('td', formatDate(entry.createdAt)), node('td', entry.kind), message, node('td', shortId(entry.sessionId))); return row; });
  $('#errorRows').replaceChildren(...(errorRows.length ? errorRows : [emptyRow(4, '暂无错误')]));
}

async function loadNpcs() {
  const data = await api('/npcs');
  state.npcs = data.items;
  $('#npcCount').textContent = `${formatNumber(data.items.length)} 个 NPC`;
  const rows = data.items.map((npc) => {
    const row = node('tr');
    row.append(node('td', npc.name), node('td', npc.role), node('td', npc.npcType === 'story' ? '剧情' : '居民'));
    row.addEventListener('click', () => openNpcDialog(npc));
    row.style.cursor = 'pointer';
    return row;
  });
  $('#npcRows').replaceChildren(...(rows.length ? rows : [emptyRow(3, '没有 NPC 数据')]));
  if (state.npcSelectedId) {
    const selected = data.items.find((npc) => npc.id === state.npcSelectedId);
    if (selected) renderNpcDialog(selected);
  }
  await loadNpcRequests();
}
function renderNpcDialog(npc) {
  state.npcSelectedId = npc.id;
  $('#npcDetailTitle').textContent = `${npc.name} · ${npc.role}`;
  $('#npcMeta').textContent = `${npc.id} · ${npc.dialogNodes.length} 节点 · ${npc.dialogEdges.length} 选项 · ${npc.npcType === 'story' ? '剧情' : '居民'}${npc.core ? ' · 核心' : ''}`;
  const container = $('#npcDialog');
  container.replaceChildren();
  const edgesByNode = new Map();
  for (const edge of npc.dialogEdges) {
    const [nodeIndex] = edge.from;
    if (!edgesByNode.has(nodeIndex)) edgesByNode.set(nodeIndex, []);
    edgesByNode.get(nodeIndex).push(edge);
  }
  npc.dialogNodes.forEach((dialogNode) => {
    const block = node('div', undefined, 'npc-dialog-node');
    block.append(node('div', `[${dialogNode.index}] ${dialogNode.text}`, 'npc-dialog-text'));
    const options = edgesByNode.get(dialogNode.index) ?? [];
    if (options.length) {
      const list = node('ul', undefined, 'npc-dialog-options');
      for (const option of options) {
        const item = node('li');
        const target = option.to === null ? '对话结束' : `→ 节点 ${option.to}`;
        item.append(node('span', option.label || '（自动继续）', 'npc-dialog-option-label'), node('small', target));
        list.append(item);
      }
      block.append(list);
    }
    container.append(block);
  });
  if (!npc.dialogNodes.length) container.append(node('p', '该 NPC 没有对话数据。', 'empty'));
}
function openNpcDialog(npc) {
  renderNpcDialog(npc);
  const dialog = $('#npcDetailDialog');
  if (dialog && !dialog.open) dialog.showModal();
}
async function loadNpcRequests() {
  const status = state.npcRequestFilter;
  const data = await api(`/npc-change-requests?status=${encodeURIComponent(status)}&limit=100`);
  const rows = data.items.map((request) => {
    const card = node('article', undefined, 'npc-request-card');
    const header = node('header');
    const isAdd = request.kind === 'add';
    // `add` submissions use the stable `proposal-new` placeholder NPC id; the
    // queue surface should read as a brand-new character, so render it as 新增.
    const metaNpcId = isAdd && request.npcId === 'proposal-new' ? '新增' : request.npcId;
    header.append(node('strong', request.title), node('span', `${isAdd ? '新增' : request.kind === 'edit' ? '编辑' : '对话'} · ${metaNpcId} · ${request.status}`, 'npc-request-meta'));
    card.append(header);
    card.append(node('p', request.summary));
    const changeLines = [];
    if (request.change?.proposedName) changeLines.push(`拟用名称：${request.change.proposedName}`);
    if (request.change?.proposal) changeLines.push(`修改内容：${request.change.proposal}`);
    if (changeLines.length) card.append(node('p', changeLines.join('\n'), 'npc-request-change'));
    const foot = node('footer');
    foot.append(node('small', `提交人：${request.requesterNickname} · ${formatDate(request.createdAt)}${request.reviewedAt ? ` · 已处理 ${formatDate(request.reviewedAt)}` : ''}`));
    if (request.status === 'pending') {
      const actions = node('div', undefined, 'row-actions');
      const approve = node('button', '批准'); approve.type = 'button';
      approve.addEventListener('click', () => confirmAction('批准 NPC 变更申请', `批准「${request.title}」？批准后作为开发者编辑清单处理，不会自动改源码。`, () => reviewNpcRequest(request.id, 'approve')));
      const reject = node('button', '拒绝', 'warning'); reject.type = 'button';
      reject.addEventListener('click', () => confirmAction('拒绝 NPC 变更申请', `拒绝「${request.title}」？`, () => reviewNpcRequest(request.id, 'reject')));
      actions.append(approve, reject);
      foot.append(actions);
    }
    card.append(foot);
    return card;
  });
  $('#npcRequestRows').replaceChildren(...(rows.length ? rows : [node('p', '暂无变更申请', 'empty')]));
}
async function reviewNpcRequest(id, action) {
  try {
    await api(`/npc-change-requests/${id}/${action}`, { method: 'POST', body: JSON.stringify({}) });
    showNotice(action === 'approve' ? '已批准变更申请' : '已拒绝变更申请', true);
    await loadNpcRequests();
  } catch (error) { showNotice(error.message); }
}

async function loadWorld() {
  const world = await api('/world');
  const weather = world.weather || {};
  state.worldWeather = weather.value || '';
  state.worldWeatherAuto = Boolean(weather.autoBroadcast);
  state.worldWeatherDraft = state.worldWeather;
  state.worldWeatherAutoDraft = state.worldWeatherAuto;
  state.worldBuildings = world.states || [];
  state.worldOverrides = {};
  state.worldBuildings.forEach((building) => { if (building.override) state.worldOverrides[building.id] = building.override; });
  state.worldDraft = { ...state.worldOverrides };
  if (!state.worldBuildings.some((building) => building.id === state.worldSelectedId)) state.worldSelectedId = state.worldBuildings[0]?.id || '';
  renderWorldWeatherOptions();
  renderWorldWeather();
  renderWorldBuildingOptions();
  renderWorldMap();
  renderWorldSelected();
  renderWorldDirty();
}
function renderWorldBuildingOptions() {
  const select = $('#worldBuildingSelect');
  select.replaceChildren(...state.worldBuildings.map((building) => {
    const option = node('option', `${building.label || building.id}（${building.num || building.id}）`);
    option.value = building.id;
    return option;
  }));
  select.value = state.worldSelectedId;
}
function selectWorldBuilding(buildingId) {
  state.worldSelectedId = buildingId;
  const select = $('#worldBuildingSelect');
  if (select) select.value = buildingId;
  renderWorldMap();
  renderWorldSelected();
}
const WEATHER_LABELS = { clear: '晴天', rain: '下雨', snow: '下雪', 'snow-deep': '大雪' };
function renderWorldWeatherOptions() {
  const select = $('#worldWeatherSelect');
  const values = Object.keys(WEATHER_LABELS);
  const current = state.worldWeatherDraft;
  if (current && !values.includes(current)) values.unshift(current);
  select.replaceChildren(...values.map((value) => { const option = node('option', WEATHER_LABELS[value] || value); option.value = value; return option; }));
  select.value = current;
  $('#worldWeatherAuto').checked = state.worldWeatherAutoDraft;
}
function renderWorldWeather() {
  const select = $('#worldWeatherSelect'); if (select) select.value = state.worldWeatherDraft;
  $('#worldWeatherAuto').checked = state.worldWeatherAutoDraft;
  $('#worldWeatherState').textContent = state.worldWeather || '未设置';
  const dirty = state.worldWeatherDraft !== state.worldWeather || state.worldWeatherAutoDraft !== state.worldWeatherAuto;
  $('#worldWeatherDirty').textContent = dirty ? '有未保存的更改' : '';
}
function worldEffectiveState(building) {
  const override = Object.prototype.hasOwnProperty.call(state.worldDraft, building.id) ? state.worldDraft[building.id] : null;
  if (override === 'open') return 'open';
  if (override === 'locked') return 'locked';
  return building.defaultState === 'unlockable' ? 'unlockable' : 'locked';
}
const WORLD_MAP_ROADS = Object.freeze([-36, -27, -18, -12, -6, 0, 6, 12, 18, 27, 36]);
const WORLD_MAP_LIMIT = 42;
function worldMapFrame(buildings) {
  const xs = buildings.map((building) => building.x);
  const zs = buildings.map((building) => building.z);
  const minX = Math.min(-WORLD_MAP_LIMIT, ...xs);
  const maxX = Math.max(WORLD_MAP_LIMIT, ...xs);
  const minZ = Math.min(-WORLD_MAP_LIMIT, ...zs);
  const maxZ = Math.max(WORLD_MAP_LIMIT, ...zs);
  const span = Math.max(maxX - minX, maxZ - minZ, 1) * 1.08;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const project = (x, z) => ({
    x: 50 + ((x - centerX) / span) * 100,
    y: 50 + ((z - centerZ) / span) * 100,
  });
  return { project, span };
}
function renderWorldMap() {
  const svg = $('#worldMap');
  if (!state.worldBuildings.length) { svg.replaceChildren(); return; }
  const { project, span } = worldMapFrame(state.worldBuildings);
  const roadWidth = Math.max(0.72, 1.2 / span * 100);
  const layers = [];
  const ground = svgNode('rect', { class: 'world-map-ground', x: 0, y: 0, width: 100, height: 100, rx: 1.4 });
  layers.push(ground);
  const grid = svgNode('g', { class: 'world-map-grid' });
  for (let step = -36; step <= 36; step += 6) {
    const vertical = project(step, 0);
    const horizontal = project(0, step);
    grid.append(
      svgNode('line', { x1: vertical.x.toFixed(2), y1: '2', x2: vertical.x.toFixed(2), y2: '98' }),
      svgNode('line', { x1: '2', y1: horizontal.y.toFixed(2), x2: '98', y2: horizontal.y.toFixed(2) }),
    );
  }
  layers.push(grid);
  const roads = svgNode('g', { class: 'world-map-roads' });
  const start = project(-WORLD_MAP_LIMIT, 0);
  const end = project(WORLD_MAP_LIMIT, 0);
  const north = project(0, -WORLD_MAP_LIMIT);
  const south = project(0, WORLD_MAP_LIMIT);
  roads.append(
    svgNode('line', { class: 'world-map-axis', x1: start.x.toFixed(2), y1: start.y.toFixed(2), x2: end.x.toFixed(2), y2: end.y.toFixed(2) }),
    svgNode('line', { class: 'world-map-axis', x1: north.x.toFixed(2), y1: north.y.toFixed(2), x2: south.x.toFixed(2), y2: south.y.toFixed(2) }),
  );
  for (const coord of WORLD_MAP_ROADS) {
    if (coord === 0) continue;
    const west = project(-WORLD_MAP_LIMIT, coord);
    const east = project(WORLD_MAP_LIMIT, coord);
    const northEnd = project(coord, -WORLD_MAP_LIMIT);
    const southEnd = project(coord, WORLD_MAP_LIMIT);
    roads.append(
      svgNode('line', { x1: west.x.toFixed(2), y1: west.y.toFixed(2), x2: east.x.toFixed(2), y2: east.y.toFixed(2), 'stroke-width': roadWidth.toFixed(2) }),
      svgNode('line', { x1: northEnd.x.toFixed(2), y1: northEnd.y.toFixed(2), x2: southEnd.x.toFixed(2), y2: southEnd.y.toFixed(2), 'stroke-width': roadWidth.toFixed(2) }),
    );
  }
  layers.push(roads);
  const plaza = project(0, 0);
  layers.push(svgNode('circle', { class: 'world-map-plaza', cx: plaza.x.toFixed(2), cy: plaza.y.toFixed(2), r: Math.max(1.8, 4.2 / span * 100).toFixed(2) }));
  const selected = state.worldBuildings.find((building) => building.id === state.worldSelectedId);
  if (selected) {
    const point = project(selected.x, selected.z);
    layers.push(svgNode('circle', { class: 'world-map-halo', cx: point.x.toFixed(2), cy: point.y.toFixed(2), r: '4.8' }));
  }
  const marks = state.worldBuildings.map((building) => {
    const point = project(building.x, building.z);
    const group = svgNode('g', {
      class: `world-marker world-marker--${worldEffectiveState(building)}${building.id === state.worldSelectedId ? ' is-selected' : ''}`,
      tabindex: '0',
      role: 'button',
      'aria-label': `${building.label || building.id}（${building.id}）`,
      transform: `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`,
    });
    const pin = svgNode('rect', { class: 'world-marker-pin', x: '-1.7', y: '-1.7', width: '3.4', height: '3.4', rx: '0.7' });
    const title = svgNode('title');
    title.textContent = `${building.label || building.id}（${building.id}）`;
    group.append(pin, title);
    if (building.id === state.worldSelectedId) {
      const label = svgNode('text', { class: 'world-marker-label', x: '2.8', y: '-0.2' });
      label.textContent = building.label || building.id;
      group.append(label);
    }
    group.addEventListener('click', () => selectWorldBuilding(building.id));
    group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); selectWorldBuilding(building.id); } });
    return group;
  });
  svg.replaceChildren(...layers, ...marks);
}
function renderWorldSelected() {
  const container = $('#worldSelected');
  const building = state.worldBuildings.find((candidate) => candidate.id === state.worldSelectedId);
  if (!building) { container.replaceChildren(node('p', '点击地图上的建筑进行配置', 'empty')); return; }
  const heading = node('div', undefined, 'world-selected-heading');
  heading.append(node('strong', building.label || building.id), node('small', building.id));
  const effective = worldEffectiveState(building);
  const override = Object.prototype.hasOwnProperty.call(state.worldDraft, building.id) ? state.worldDraft[building.id] : null;
  const meta = node('p', undefined, 'world-selected-meta');
  meta.textContent = `剧情默认：${building.storyLocked ? '剧情锁定' : '按剧情可解锁'}　当前生效：${{ open: '全局解锁', locked: '已锁定', unlockable: '可解锁' }[effective]}`;
  const chooser = node('div', undefined, 'world-chooser');
  [['default', '恢复默认'], ['locked', '强制锁定'], ['open', '全局解锁']].forEach(([value, label]) => {
    const button = node('button', label, value === 'open' ? 'primary' : 'secondary'); button.type = 'button';
    button.classList.toggle('is-active', (value === 'default' && override === null) || override === value);
    button.addEventListener('click', () => {
      if (value === 'default') delete state.worldDraft[building.id]; else state.worldDraft[building.id] = value;
      renderWorldMap(); renderWorldSelected(); renderWorldDirty();
    });
    chooser.append(button);
  });
  container.replaceChildren(heading, meta, chooser);
}
function renderWorldDirty() {
  const count = Object.keys(state.worldDraft).length;
  const dirty = JSON.stringify(sortedEntries(state.worldDraft)) !== JSON.stringify(sortedEntries(state.worldOverrides));
  $('#worldBuildingSummary').textContent = count ? `${count} 项自定义` : '全部默认';
  $('#worldBuildingsDirty').textContent = dirty ? '有未保存的更改' : '';
}
function sortedEntries(map) {
  return Object.keys(map).sort().map((key) => [key, map[key]]);
}
async function saveWorldBuildings() {
  const button = $('#worldBuildingsSave'); button.disabled = true;
  try {
    const overrides = {};
    state.worldBuildings.forEach((building) => {
      const override = state.worldDraft[building.id];
      if (override === 'open' || override === 'locked') overrides[building.id] = override;
    });
    const data = await api('/world/buildings', { method: 'POST', body: JSON.stringify({ overrides }) });
    state.worldOverrides = {};
    (data.states || []).forEach((building) => { if (building.override) state.worldOverrides[building.id] = building.override; });
    state.worldDraft = { ...state.worldOverrides };
    renderWorldMap(); renderWorldSelected(); renderWorldDirty();
    showNotice('建筑解锁配置已保存', true);
  } catch (error) { showNotice(error.message); } finally { button.disabled = false; }
}
function resetWorldBuildings() {
  state.worldDraft = { ...state.worldOverrides };
  renderWorldMap(); renderWorldSelected(); renderWorldDirty();
}
async function applyWorldWeather() {
  const button = $('#worldWeatherApply'); button.disabled = true;
  try {
    const data = await api('/world/weather', { method: 'POST', body: JSON.stringify({ weather: state.worldWeatherDraft, autoBroadcast: state.worldWeatherAutoDraft }) });
    state.worldWeather = data.weather?.value ?? state.worldWeatherDraft;
    state.worldWeatherAuto = Boolean(data.weather?.autoBroadcast ?? state.worldWeatherAutoDraft);
    renderWorldWeather();
    showNotice('天气配置已保存并广播', true);
  } catch (error) { showNotice(error.message); } finally { button.disabled = false; }
}

const loaders = { overview: loadOverview, users: loadUsers, houses: loadHouses, world: loadWorld, npc: loadNpcs, backups: loadBackups, audit: loadAudit, chat: loadChat, story: loadStoryProgress, telemetry: loadTelemetry };
const titles = { overview: '运行概览', users: '居民管理', houses: '住房数据', world: '世界配置', npc: 'NPC 管理', backups: '数据库备份', audit: '审计日志', chat: '聊天审核', story: '剧情与任务', telemetry: '运行监控' };
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
$('#chatFilter').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  state.chatFilter = button.dataset.filter;
  $$('#chatFilter [data-filter]').forEach((item) => {
    const active = item.dataset.filter === state.chatFilter;
    item.classList.toggle('is-active', active);
    item.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  void loadChat();
});
$('#npcRequestFilter').addEventListener('change', (event) => { state.npcRequestFilter = event.target.value; void loadNpcRequests(); });
$('#storySearch').addEventListener('submit', (event) => { event.preventDefault(); void loadStoryProgress(); });
$('#userDialogSubmit').addEventListener('click', () => void submitUserEditor());
$('#houseDialogSubmit').addEventListener('click', () => void submitHouseEditor());
$('#houseDialogMemberAdd').addEventListener('click', addHouseMember);
$('#refreshLogsButton').addEventListener('click', () => void loadTelemetry());
$('#clearTelemetryButton').addEventListener('click', () => confirmAction('清空监控数据', '将删除全部用户事件与错误报告记录，不可恢复。', async () => { await api('/telemetry/clear', { method: 'POST' }); showNotice('监控数据已清空', true); await loadTelemetry(); }));
$('#worldWeatherSelect').addEventListener('change', (event) => { state.worldWeatherDraft = event.target.value; renderWorldWeather(); });
$('#worldWeatherAuto').addEventListener('change', (event) => { state.worldWeatherAutoDraft = event.target.checked; renderWorldWeather(); });
$('#worldBuildingSelect').addEventListener('change', (event) => selectWorldBuilding(event.target.value));
$('#worldWeatherApply').addEventListener('click', () => void applyWorldWeather());
$('#worldBuildingsSave').addEventListener('click', () => void saveWorldBuildings());
$('#worldBuildingsReset').addEventListener('click', resetWorldBuildings);

try { const session = await api('/session'); session.authenticated ? showApp(session) : showLogin(); } catch { showLogin(); }
