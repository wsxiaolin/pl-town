// Multiplayer presence, chat, and housing UI state.
// @ts-nocheck
import * as THREE from 'three';
import { MultiplayerClient } from '../../network/MultiplayerClient';
import { createCloudProgressionController } from './cloudProgressionController';

export function createMultiplayerHousingController(options) {
  const {
    scene, signal, residences, getCursorChar, makeCharacter, showLoginEntry,
    showUnlockToast, movePlayerTo, pointInAnyBuilding, fountainClear: FOUNTAIN_CLEAR,
    getMapIconsBuilt, mapShotSpan, getMapMode, toggleMapMode, communityPanels,
    getLegacyAchievements = () => [],
  } = options;
  const {
    loadPhoneMessages, openWorksPanel, openPhoneBinding, bindPhysicsLabAccount,
    updatePhoneBindingState, loadPhoneSocial,
  } = communityPanels;
  let multiplayer = null;
  const remotePlayers = new Map();
  let lastNetworkPosition = 0;
  let onlinePlayers = [];
  let currentHouses = [];
  let currentHousingRequests = [];
  let selectedResidenceId = null;
  let unreadChats = 0;
  let pendingHousingRequests = 0;
  let residenceClaimId = null;
  let housePanelState = { houseId: null, mode: null };
  const progression = createCloudProgressionController({
    document,
    signal,
    showToast: showUnlockToast,
    send: (command) => multiplayer?.send(command) ?? false,
    openPhoneView: (view) => {
      setPhoneOpen(true);
      activatePhoneTab(view);
    },
  });
  const HOUSE_ICON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5"/><path d="M6.5 10.5V20h11v-9.5"/><path d="M10.2 20v-5h3.6v5"/></svg>';

  function setupMultiplayerUI() {
    progression.setup();
    const toggle = document.getElementById('onlinePanelToggle');
    const panel = document.getElementById('onlinePanel');
    const closeBtn = document.getElementById('phoneClose');
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    if (!toggle || !panel || !form || !input) return;
    const claimClose = document.getElementById('residenceClaimClose');
    const claimCancel = document.getElementById('residenceClaimCancel');
    const claimSubmit = document.getElementById('residenceClaimSubmit');
    const applyButton = document.getElementById('residenceApply');
    const navigateButton = document.getElementById('residenceNavigate');
    const claimInput = document.getElementById('residenceNameInput');
    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      setPhoneOpen(!panel.classList.contains('open'));
    }, { signal: signal });
    closeBtn?.addEventListener('click', () => setPhoneOpen(false), { signal: signal });
    document.addEventListener('click', (event) => {
      if (panel.classList.contains('open') && !panel.contains(event.target) && !toggle.contains(event.target)) setPhoneOpen(false);
    }, { signal: signal });
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      multiplayer?.chat(text);
      input.value = '';
    }, { signal: signal });
    document.querySelectorAll('[data-online-tab]').forEach((tab) => tab.addEventListener('click', () => {
      const target = tab.dataset.onlineTab;
      activatePhoneTab(target);
      if (target === 'inventory') progression.openInventory();
      if (target === 'chat') clearUnreadChats();
    }, { signal: signal }));
    document.getElementById('phoneKnowledge')?.addEventListener('click',()=>{setPhoneOpen(false);openWorksPanel('knowledgebase');},{signal:signal});
    document.getElementById('phoneSenate')?.addEventListener('click',()=>{setPhoneOpen(false);openWorksPanel('senate');},{signal:signal});
    document.getElementById('phoneDiscussions')?.addEventListener('click',()=>{setPhoneOpen(false);openWorksPanel('discussion');},{signal:signal});
    document.getElementById('phoneBindFromSocial')?.addEventListener('click',()=>openPhoneBinding(),{signal:signal});
    document.getElementById('phoneBindForm')?.addEventListener('submit',bindPhysicsLabAccount,{signal:signal});
    updatePhoneBindingState();
    document.getElementById('phoneOpenWorks')?.addEventListener('click',()=>{setPhoneOpen(false);openWorksPanel('all');},{signal:signal});
    document.querySelectorAll('[data-pl-social]').forEach(button=>button.addEventListener('click',()=>loadPhoneSocial(button.dataset.plSocial),{signal:signal}));
    claimClose?.addEventListener('click', closeResidencePanel, { signal: signal });
    claimCancel?.addEventListener('click', closeResidencePanel, { signal: signal });
    claimSubmit?.addEventListener('click', () => {
      if (!residenceClaimId) return;
      const name = claimInput?.value.trim() || '';
      if (!name) { claimInput?.focus(); return; }
      if (multiplayer?.user) {
        claimSubmit.setAttribute('disabled', 'true');
        multiplayer.housing('claim', { buildingId: residenceClaimId, name });
      } else {
        showUnlockToast('联机后才能认领住宅');
      }
    }, { signal: signal });
    navigateButton?.addEventListener('click', () => {
      if (residenceClaimId) navigateToResidence(residenceClaimId);
    }, { signal: signal });
    applyButton?.addEventListener('click', () => {
      if (!residenceClaimId || applyButton.hasAttribute('disabled')) return;
      multiplayer?.housing('apply', { buildingId: residenceClaimId });
      applyButton.setAttribute('disabled', 'true');
      applyButton.textContent = '申请中';
      showUnlockToast('入住申请已发送');
    }, { signal: signal });
    document.getElementById('residenceClaim')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) closeResidencePanel();
    }, { signal: signal });
  }
  
  // 打开/收起“居民手机”，并同步悬浮按钮状态与未读角标
  function setPhoneOpen(open) {
    const panel = document.getElementById('onlinePanel');
    const toggle = document.getElementById('onlinePanelToggle');
    if (!panel || !toggle) return;
    panel.classList.toggle('open', open);
    toggle.classList.toggle('active', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open && document.querySelector('[data-online-tab="chat"]')?.classList.contains('active')) clearUnreadChats();
  }
  
  function bumpUnreadChats() {
    unreadChats += 1;
    updatePhoneBadge();
  }
  
  function updatePhoneBadge() {
    const badge = document.getElementById('phoneBadge');
    if (!badge) return;
    const total = unreadChats + pendingHousingRequests;
    badge.hidden = total === 0;
    badge.textContent = total > 99 ? '99+' : String(total);
  }
  
  function clearUnreadChats() {
    unreadChats = 0;
    updatePhoneBadge();
  }
  
  function setupMultiplayer(nickname, password) {
    if (multiplayer) return;
    multiplayer = new MultiplayerClient({
      connection: (state) => {
        progression.setConnection(state === 'connected');
        const dot = document.getElementById('onlineStateDot');
        const count = document.getElementById('onlineCount');
        const fab = document.getElementById('onlinePanelToggle');
        dot?.classList.toggle('connected', state === 'connected');
        fab?.classList.toggle('connected', state === 'connected');
        if (state !== 'connected' && count) count.textContent = state === 'connecting' ? '连接中' : '离线';
      },
      connected: (user, players, houses) => {
        onlinePlayers = players.filter((player) => player.id !== user.id);
        const owner = document.getElementById('phoneOwner');
        if (owner) owner.textContent = `${user.nickname} 的手机`;
        if (getCursorChar()) {
          const unsafe = Math.hypot(user.position.x, user.position.z) < FOUNTAIN_CLEAR || pointInAnyBuilding(user.position.x, user.position.z);
          if (unsafe) {
            getCursorChar().position.set(0, 0, -6);
            multiplayer?.position({ x: 0, y: 0, z: -6, rotation: 0 });
          } else {
            getCursorChar().position.set(user.position.x, 0, user.position.z);
            getCursorChar().rotation.y = user.position.rotation ?? 0;
          }
        }
        players.forEach(addRemotePlayer);
        renderHouseList(houses);
        updateOnlineCount(players.length);
      },
      playerJoined: (player) => { onlinePlayers = [...onlinePlayers.filter((item) => item.id !== player.id), player]; addRemotePlayer(player); updateOnlineCount(remotePlayers.size + 1); },
      playerMoved: (id, position) => {
        const remote = remotePlayers.get(id);
        if (remote) { remote.target.set(position.x, position.y, position.z); remote.rotation = position.rotation ?? remote.rotation; }
      },
      playerLeft: (id) => { onlinePlayers = onlinePlayers.filter((player) => player.id !== id); removeRemotePlayer(id); updateOnlineCount(Math.max(1, remotePlayers.size + 1)); },
      chat: (message) => appendChat(message.nickname, message.text, message.userId === multiplayer?.user?.id),
      houses: renderHouseList,
      requests: (requests) => {
        currentHousingRequests = requests;
        pendingHousingRequests = requests.filter((request) => request.targetId === multiplayer?.user?.id).length;
        updatePhoneBadge();
        renderHouseList(currentHouses);
      },
      progress: (progress, catalog, event) => {
        progression.applySnapshot(progress, catalog, event);
        if (!event) progression.syncAchievements(getLegacyAchievements());
      },
      authenticationFailed: (message) => {
        const previousNickname = localStorage.getItem('minicityUser') || nickname;
        localStorage.removeItem('minicityUser');
        multiplayer?.close();
        multiplayer = null;
        const input = document.getElementById('loginInput') as HTMLInputElement | null;
        const passwordInput = document.getElementById('loginPassword') as HTMLInputElement | null;
        const error = document.getElementById('loginError');
        if (input) input.value = previousNickname;
        if (passwordInput) passwordInput.value = '';
        if (error) { error.textContent = message; error.hidden = false; }
        showLoginEntry();
        showUnlockToast(message);
      },
      error: (message) => {
        progression.handleError();
        document.getElementById('residenceClaimSubmit')?.removeAttribute('disabled');
        document.getElementById('residenceApply')?.removeAttribute('disabled');
        showUnlockToast(message);
      },
    });
    multiplayer.connect(nickname, password);
  }
  
  function updateOnlineCount(count) {
    const el = document.getElementById('onlineCount');
    if (el) el.textContent = `${Math.max(0, count)} 人在线`;
  }
  
  function addRemotePlayer(player) {
    if (!player?.id || player.id === multiplayer?.user?.id || remotePlayers.has(player.id)) return;
    const mesh = makeCharacter(0xF0C18A, 0xC45A4A);
    mesh.position.set(player.position.x, player.position.y, player.position.z);
    mesh.rotation.y = player.position.rotation ?? 0;
    mesh.userData.remotePlayerId = player.id;
    scene.add(mesh);
    remotePlayers.set(player.id, { mesh, target: new THREE.Vector3(player.position.x, player.position.y, player.position.z), rotation: player.position.rotation ?? 0, nickname: player.nickname });
  }
  
  function removeRemotePlayer(id) {
    const remote = remotePlayers.get(id);
    if (!remote) return;
    scene.remove(remote.mesh);
    remote.mesh.traverse((object) => { if (object.geometry) object.geometry.dispose(); if (object.material?.dispose) object.material.dispose(); });
    remotePlayers.delete(id);
  }
  
  function updateRemotePlayers(delta) {
    remotePlayers.forEach((remote) => {
      remote.mesh.position.lerp(remote.target, Math.min(1, delta * 12));
      remote.mesh.rotation.y += Math.atan2(Math.sin(remote.rotation - remote.mesh.rotation.y), Math.cos(remote.rotation - remote.mesh.rotation.y)) * Math.min(1, delta * 12);
    });
  }
  
  function appendChat(nickname, text, own) {
    const log = document.getElementById('chatLog');
    if (!log) return;
    const row = document.createElement('p'); row.className = `chat-line${own ? ' own' : ''}`;
    const author = document.createElement('b'); author.textContent = nickname;
    const body = document.createElement('span'); body.textContent = text;
    row.append(author, body); log.appendChild(row);
    while (log.children.length > 80) log.firstElementChild?.remove();
    log.scrollTop = log.scrollHeight;
    // 手机收起或不在公聊页时，用悬浮按钮角标提示未读
    const panel = document.getElementById('onlinePanel');
    const chatActive = document.querySelector('[data-online-tab="chat"]')?.classList.contains('active');
    if (!own && (!panel?.classList.contains('open') || !chatActive)) bumpUnreadChats();
  }
  
  function renderHouseList(houses) {
    const list = document.getElementById('houseList');
    if (!list) return;
    currentHouses = houses;
    list.replaceChildren();
    const mine = multiplayer?.user?.id;
    renderHousingRequests(list, mine);
    if (selectedResidenceId && houses.some((house) => house.buildingId === selectedResidenceId)) list.appendChild(buildHouseFocus(houses));
    if (!houses.length) {
      const empty = document.createElement('p'); empty.className = 'house-empty'; empty.textContent = '还没有被认领的住宅。'; list.appendChild(empty);
    }
    houses.forEach((house) => list.appendChild(buildHouseCard(house, houses, mine)));
    if (!selectedResidenceId) {
      const hint = document.createElement('p'); hint.className = 'house-select-hint'; hint.textContent = '点击地图中的小型居民楼，可查看或认领该住宅。'; list.appendChild(hint);
    }
    syncResidenceLabels();
    renderMapHouseTags();
    if (residenceClaimId && houses.some((house) => house.buildingId === residenceClaimId)) openResidence(residenceClaimId);
    if (residenceClaimId && !houses.some((house) => house.buildingId === residenceClaimId)) {
      const submit = document.getElementById('residenceClaimSubmit');
      submit?.removeAttribute('disabled');
    }
  }
  
  function renderHousingRequests(list, mine) {
    if (!mine || !currentHousingRequests.length) return;
    const section = document.createElement('section'); section.className = 'house-requests';
    const heading = document.createElement('strong'); heading.className = 'house-requests-title'; heading.textContent = '待处理请求'; section.appendChild(heading);
    currentHousingRequests.forEach((request) => {
      const incoming = request.targetId === mine;
      const row = document.createElement('div'); row.className = 'house-request';
      const text = document.createElement('span'); text.className = 'house-request-text';
      const houseName = request.houseName || '未命名住宅';
      text.textContent = incoming
        ? (request.kind === 'invite' ? `${request.requesterNickname} 邀请你入住「${houseName}」` : `${request.requesterNickname} 申请入住「${houseName}」`)
        : (request.kind === 'invite' ? `已邀请 ${request.targetNickname} 入住「${houseName}」` : `已申请入住「${houseName}」`);
      row.appendChild(text);
      if (incoming) {
        row.append(
          houseActionButton('同意', false, () => { multiplayer?.housing('accept', { requestId: request.id }); }, 'primary'),
          houseActionButton('拒绝', false, () => { multiplayer?.housing('decline', { requestId: request.id }); }, 'danger'),
        );
      } else {
        const pending = document.createElement('small'); pending.className = 'house-request-pending'; pending.textContent = '等待同意'; row.appendChild(pending);
      }
      section.appendChild(row);
    });
    list.appendChild(section);
  }
  
  // 当前在地图上选中的住宅：未认领时给入口，已认领时显示入住进度
  function buildHouseFocus(houses) {
    const residence = residences.find((item) => item.id === selectedResidenceId);
    const house = houses.find((item) => item.buildingId === selectedResidenceId);
    const focus = document.createElement('article'); focus.className = 'house-focus';
    const head = document.createElement('div'); head.className = 'hf-head';
    const icon = document.createElement('span'); icon.className = 'hf-icon'; icon.innerHTML = HOUSE_ICON_SVG;
    const titles = document.createElement('div'); titles.className = 'hf-titles';
    const title = document.createElement('strong'); title.textContent = house?.name || '闲置住宅';
    const addr = document.createElement('span'); addr.className = 'hf-addr'; addr.textContent = residence?.label || selectedResidenceId;
    titles.append(title, addr);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'hf-close'; close.textContent = '✕'; close.title = '取消选择';
    close.onclick = () => { selectedResidenceId = null; renderHouseList(currentHouses); };
    head.append(icon, titles, close);
    focus.appendChild(head);
    const state = document.createElement('div'); state.className = 'hf-state';
    if (house) {
      const bar = document.createElement('div'); bar.className = 'hc-bar';
      const fill = document.createElement('i'); fill.style.width = `${Math.min(100, house.members.length * 10)}%`;
      bar.appendChild(fill);
      const text = document.createElement('span'); text.textContent = `已入住 ${house.members.length}/10`;
      state.append(bar, text);
      focus.appendChild(state);
    } else {
      const text = document.createElement('span'); text.textContent = '这间住宅还没有主人。'; state.appendChild(text);
      focus.appendChild(state);
    }
    return focus;
  }
  
  function houseActionButton(label, active, onClick, variant) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `hc-btn${variant ? ` ${variant}` : ''}${active ? ' active' : ''}`;
    button.textContent = label;
    // Some actions redraw the house list synchronously. Stop bubbling first so
    // the document-level outside-click handler does not see the detached button
    // as an outside click and collapse the resident phone.
    button.onclick = (event) => {
      event.stopPropagation();
      onClick(event);
    };
    return button;
  }

  function activatePhoneTab(target) {
    const views={chat:'onlineChatView',houses:'onlineHousesView',inventory:'onlineInventoryView',archive:'onlineArchiveView',social:'onlineSocialView'};
    document.querySelectorAll('[data-online-tab]').forEach((item) => item.classList.toggle('active', item.dataset.onlineTab === target));
    document.querySelectorAll('.online-view').forEach((view) => view.classList.toggle('active', view.id === views[target]));
  }
  
  // Raycasts often hit a facade/decoration child that was added after the
  // building was tagged. Walk up the hierarchy so every visible part remains
  // interactive.
  function raycastUserData(object, key) {
    let node=object;
    while(node){
      const value=node.userData?.[key];
      if(value) return value;
      node=node.parent;
    }
    return null;
  }
  
  function setHousePanel(houseId, mode) {
    if (housePanelState.houseId === houseId && housePanelState.mode === mode) housePanelState = { houseId: null, mode: null };
    else housePanelState = { houseId, mode };
    renderHouseList(currentHouses);
  }
  
  function buildHouseCard(house, houses, mine) {
    const isOwner = house.ownerId === mine;
    const isMember = house.members.some((member) => member.userId === mine);
    const card = document.createElement('article');
    card.className = `house-card${isOwner ? ' mine' : ''}${house.buildingId === selectedResidenceId ? ' selected' : ''}`;
  
    const head = document.createElement('div'); head.className = 'hc-head';
    const titleBox = document.createElement('div'); titleBox.className = 'hc-title';
    const name = document.createElement('strong'); name.className = 'hc-name'; name.textContent = house.name || '未命名住宅';
    const owner = document.createElement('span'); owner.className = 'hc-owner'; owner.textContent = `所有者 ${house.ownerNickname}`;
    titleBox.append(name, owner);
    const occ = document.createElement('span'); occ.className = 'hc-occ'; occ.textContent = `${house.members.length}/10`;
    head.append(titleBox, occ);
  
    const bar = document.createElement('div'); bar.className = 'hc-bar';
    const fill = document.createElement('i'); fill.style.width = `${Math.min(100, house.members.length * 10)}%`;
    bar.appendChild(fill);
  
    const members = document.createElement('div'); members.className = 'hc-members';
    house.members.forEach((member) => {
      const chip = document.createElement('span');
      chip.className = `hc-chip${member.userId === house.ownerId ? ' owner' : ''}${member.userId === mine ? ' me' : ''}`;
      chip.textContent = member.userId === house.ownerId ? `${member.nickname} · 房主` : member.nickname;
      members.appendChild(chip);
    });
    card.append(head, bar, members);
  
    const panelMode = housePanelState.houseId === house.buildingId ? housePanelState.mode : null;
    const actions = document.createElement('div'); actions.className = 'hc-actions';
    if (isOwner) {
      actions.append(
        houseActionButton('改名', panelMode === 'rename', () => setHousePanel(house.buildingId, 'rename')),
        houseActionButton('邀请', panelMode === 'invite', () => setHousePanel(house.buildingId, 'invite')),
        houseActionButton('成员', panelMode === 'members', () => setHousePanel(house.buildingId, 'members')),
        houseActionButton('放弃', panelMode === 'release', () => setHousePanel(house.buildingId, 'release'), 'danger'),
      );
      card.appendChild(actions);
    } else if (isMember) {
      actions.appendChild(houseActionButton('退出住宅', panelMode === 'leave', () => setHousePanel(house.buildingId, 'leave'), 'danger'));
      card.appendChild(actions);
    } else if (!houses.some((item) => item.members.some((member) => member.userId === mine))) {
      const pending = currentHousingRequests.some((request) => request.kind === 'application' && request.buildingId === house.buildingId && request.requesterId === mine);
      const applyAction = houseActionButton(pending ? '申请中' : '申请入住', false, () => {
        if (!pending) {
          multiplayer?.housing('apply', { buildingId: house.buildingId });
          showUnlockToast(`已申请入住「${house.name || '未命名住宅'}」`);
        }
      }, pending ? undefined : 'primary');
      applyAction.disabled = pending;
      actions.appendChild(applyAction);
      card.appendChild(actions);
    }
    if (panelMode) card.appendChild(buildHousePanel(house, houses, mine, panelMode));
    return card;
  }
  
  // 卡片内的内联操作区：改名表单 / 邀请选择器 / 成员管理 / 两步骤确认
  function buildHousePanel(house, houses, mine, mode) {
    const panel = document.createElement('div'); panel.className = 'hc-panel';
    const panelTitle = (text) => { const el = document.createElement('span'); el.className = 'hc-panel-title'; el.textContent = text; return el; };
    if (mode === 'rename') {
      const form = document.createElement('div'); form.className = 'hc-form';
      const input = document.createElement('input');
      input.value = house.name || ''; input.maxLength = 24; input.placeholder = '输入新的住宅名称';
      input.setAttribute('aria-label', '住宅名称');
      const save = houseActionButton('保存', false, () => {
        const name = input.value.trim();
        if (!name) { input.focus(); return; }
        housePanelState = { houseId: null, mode: null };
        multiplayer?.housing('rename', { buildingId: house.buildingId, name });
      }, 'primary');
      input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); save.click(); } });
      form.append(input, save, houseActionButton('取消', false, () => setHousePanel(house.buildingId, 'rename')));
      panel.append(panelTitle('重新命名'), form);
      requestAnimationFrame(() => input.focus());
    } else if (mode === 'invite') {
      panel.appendChild(panelTitle('邀请在线居民入住'));
      const candidates = onlinePlayers.filter((player) => !houses.some((item) => item.members.some((member) => member.userId === player.id)));
      const box = document.createElement('div'); box.className = 'hc-candidates';
      if (!candidates.length) {
        const empty = document.createElement('p'); empty.className = 'hc-person-empty'; empty.textContent = '当前没有可邀请的在线居民。'; box.appendChild(empty);
      }
      candidates.forEach((player) => {
        const row = document.createElement('div'); row.className = 'hc-person';
        const name = document.createElement('span'); name.className = 'hc-person-name'; name.textContent = player.nickname;
        const pendingInvite = currentHousingRequests.some((request) => request.kind === 'invite' && request.buildingId === house.buildingId && request.requesterId === mine && request.targetId === player.id);
        const inviteAction = houseActionButton(pendingInvite ? '已邀请' : '邀请', false, () => {
          if (pendingInvite) return;
          housePanelState = { houseId: null, mode: null };
          multiplayer?.housing('invite', { buildingId: house.buildingId, userId: player.id });
          showUnlockToast(`已邀请 ${player.nickname} 入住`);
        }, 'primary');
        inviteAction.disabled = pendingInvite;
        row.append(name, inviteAction);
        box.appendChild(row);
      });
      panel.appendChild(box);
    } else if (mode === 'members') {
      panel.appendChild(panelTitle('管理成员'));
      const rows = document.createElement('div'); rows.className = 'hc-member-rows';
      const others = house.members.filter((member) => member.userId !== mine);
      if (!others.length) {
        const empty = document.createElement('p'); empty.className = 'hc-person-empty'; empty.textContent = '还没有其他成员。'; rows.appendChild(empty);
      }
      others.forEach((member) => {
        const row = document.createElement('div'); row.className = 'hc-person';
        const name = document.createElement('span'); name.className = 'hc-person-name'; name.textContent = member.nickname;
        row.append(name,
          houseActionButton('转让', false, () => {
            housePanelState = { houseId: null, mode: null };
            multiplayer?.housing('transfer', { buildingId: house.buildingId, userId: member.userId });
          }),
          houseActionButton('踢出', false, () => {
            housePanelState = { houseId: null, mode: null };
            multiplayer?.housing('kick', { buildingId: house.buildingId, userId: member.userId });
          }, 'danger'),
        );
        rows.appendChild(row);
      });
      panel.appendChild(rows);
    } else if (mode === 'release' || mode === 'leave') {
      const text = mode === 'release'
        ? `确认放弃「${house.name || '这间住宅'}」？所有成员都会被移出。`
        : `确认退出「${house.name || '这间住宅'}」？`;
      const confirm = document.createElement('div'); confirm.className = 'hc-confirm';
      const label = document.createElement('span'); label.textContent = text;
      confirm.append(label,
        houseActionButton('确认', false, () => {
          housePanelState = { houseId: null, mode: null };
          multiplayer?.housing(mode === 'release' ? 'release' : 'leave', { buildingId: house.buildingId });
        }, 'danger'),
        houseActionButton('取消', false, () => setHousePanel(house.buildingId, mode)),
      );
      panel.appendChild(confirm);
    }
    return panel;
  }
  
  // 被命名的住宅：在 3D 场景中挂上可点击的名字标签
  function syncResidenceLabels() {
    const wrap = document.getElementById('labelsWrap');
    if (!wrap) return;
    residences.forEach((residence) => {
      const house = currentHouses.find((item) => item.buildingId === residence.id);
      const name = house?.name?.trim();
      if (!name) {
        if (residence.labelEl) { residence.labelEl.remove(); residence.labelEl = null; }
        return;
      }
      if (!residence.labelEl) {
        const el = document.createElement('button');
        el.type = 'button'; el.className = 'house-map-label show';
        el.innerHTML = `${HOUSE_ICON_SVG}<span class="hml-name"></span>`;
        el.addEventListener('click', (event) => { event.stopPropagation(); openResidence(residence.id); });
        wrap.appendChild(el);
        residence.labelEl = el;
      }
      residence.labelEl.querySelector('.hml-name').textContent = name;
    });
  }
  
  // 全景地图上同步显示已命名住宅的名字
  function renderMapHouseTags() {
    const wrap = document.getElementById('mapIcons');
    if (!wrap || !getMapIconsBuilt()) return;
    wrap.querySelectorAll('.map-house-tag').forEach((el) => el.remove());
    currentHouses.forEach((house) => {
      const name = house.name?.trim();
      if (!name) return;
      const residence = residences.find((item) => item.id === house.buildingId);
      if (!residence) return;
      const tag = document.createElement('button');
      tag.type = 'button'; tag.className = 'map-house-tag'; tag.textContent = name;
      const mapX = residence.group.position.x;
      const mapZ = residence.group.position.z;
      // Match the isometric 45° map projection (same as mapController) and
      // drop houses whose isometric center is outside the framed map shot.
      if (Math.abs(mapX - mapZ) > mapShotSpan || Math.abs(mapX + mapZ) > mapShotSpan) return;
      tag.style.left = (((mapX - mapZ) + mapShotSpan) / (2 * mapShotSpan) * 100) + '%';
      tag.style.top = (((mapX + mapZ) + mapShotSpan) / (2 * mapShotSpan) * 100) + '%';
      tag.addEventListener('click', () => { if (getMapMode()) toggleMapMode(); openResidence(house.buildingId); });
      wrap.appendChild(tag);
    });
  }
  
  function openResidence(residenceId) {
    const residence = residences.find((item) => item.id === residenceId);
    if (!residence) return;
    selectedResidenceId = residenceId;
    residenceClaimId = residenceId;
    const house = currentHouses.find((item) => item.buildingId === residenceId);
    if (house) {
      // Claimed residences are managed from the resident phone, where the
      // member list and owner actions are available.
      setPhoneOpen(true);
      document.querySelector('[data-online-tab="houses"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    const panel = document.getElementById('residenceClaim');
    const title = document.getElementById('residenceClaimTitle');
    const address = document.getElementById('residenceClaimAddress');
    const status = document.getElementById('residenceClaimStatus');
    const field = document.getElementById('residenceNameField');
    const input = document.getElementById('residenceNameInput');
    const submit = document.getElementById('residenceClaimSubmit');
    const apply = document.getElementById('residenceApply');
    const navigate = document.getElementById('residenceNavigate');
    if (!panel || !title || !address || !status || !field || !submit || !apply || !navigate) return;
    title.textContent = house?.name || '未命名住宅';
    address.textContent = residence.label;
    status.textContent = house
      ? `已认领 · 房主 ${house.ownerNickname} · ${house.members.length}/10 名成员`
      : '这栋住宅尚未被认领。';
    field.hidden = Boolean(house);
    submit.hidden = Boolean(house);
    navigate.hidden = !house;
    const mine = multiplayer?.user?.id;
    const alreadyLivesSomewhere = currentHouses.some((item) => item.members.some((member) => member.userId === mine));
    const canApply = Boolean(house && mine && !alreadyLivesSomewhere && house.ownerId !== mine);
    const pendingApplication = currentHousingRequests.some((request) => request.kind === 'application' && request.buildingId === residenceId && request.requesterId === mine);
    apply.hidden = !canApply;
    apply.textContent = pendingApplication ? '申请中' : '申请入住';
    apply.toggleAttribute('disabled', pendingApplication);
    submit.removeAttribute('disabled');
    if (input) input.value = house?.name || '';
    panel.hidden = Boolean(house);
    if (!house) requestAnimationFrame(() => input?.focus());
  }
  
  function closeResidencePanel() {
    const panel = document.getElementById('residenceClaim');
    if (panel) panel.hidden = true;
    residenceClaimId = null;
  }
  
  function navigateToResidence(residenceId) {
    const residence = residences.find((item) => item.id === residenceId);
    if (!residence) return;
    closeResidencePanel();
    movePlayerTo(residence.group.position.clone());
  }

  function sendLocalPosition(position, now) {
    if (!multiplayer || now - lastNetworkPosition < 80) return;
    multiplayer.position(position);
    lastNetworkPosition = now;
  }

  function destroy() {
    multiplayer?.close();
    multiplayer = null;
    remotePlayers.clear();
    progression.destroy();
  }

  return {
    setupUI: setupMultiplayerUI, connect: setupMultiplayer, updateRemotePlayers,
    setPhoneOpen, renderMapHouseTags, openResidence, closeResidencePanel,
    navigateToResidence, raycastUserData, sendLocalPosition, destroy,
    progression,
  };
}
