export type StatsPanelControllerOptions = {
  getStats: () => Record<string, any>;
  getUserId: () => string;
  calcLevel: (interactions: number) => number;
  formatDate: (time: number) => string;
  formatTime: (seconds: number) => string;
  getBuildingCount: () => number;
  getNpcCount: () => number;
  achievements: readonly { id: string; name: string; desc: string }[];
  unlockTiers: readonly { threshold: number; label: string }[];
};

export function createStatsPanelController(options: StatsPanelControllerOptions) {
  let mode: 'clean' | 'raw' = 'clean';

  function render(): void { mode === 'clean' ? renderClean() : renderRaw(); }
  function open(): void { render(); document.getElementById('statsPanel')?.classList.add('open'); }
  function close(): void { document.getElementById('statsPanel')?.classList.remove('open'); }
  function setMode(next: 'clean' | 'raw'): void {
    mode = next;
    document.getElementById('spModeClean')?.classList.toggle('active', next === 'clean');
    document.getElementById('spModeRaw')?.classList.toggle('active', next === 'raw');
    render();
  }

  function renderClean(): void {
    const stats = options.getStats();
    const interactions = stats.interactions ?? 0;
    const visited = (stats.buildingsVisited ?? []).length;
    const achievementIds = stats.achievements ?? [];
    const next = options.unlockTiers.find((tier) => interactions < tier.threshold);
    const previous = [...options.unlockTiers].reverse().find((tier) => interactions >= tier.threshold)?.threshold ?? 0;
    const target = next?.threshold ?? options.unlockTiers.at(-1)?.threshold ?? 1;
    const progress = next ? Math.min(100, Math.round(((interactions - previous) / (target - previous)) * 100)) : 100;
    const unlockRows = options.unlockTiers.map((tier) => `<div class="sp-ul-item${interactions >= tier.threshold ? ' done' : ''}"><span class="sp-ul-dot">${interactions >= tier.threshold ? 'Done' : 'Open'}</span><span class="sp-ul-name">${tier.label}</span><span class="sp-ul-thresh">${tier.threshold} visits</span></div>`).join('');
    const achievementRows = options.achievements.map((achievement) => {
      const done = achievementIds.includes(achievement.id);
      return `<div class="sp-ul-item${done ? ' done' : ''}" title="${achievement.desc}"><span class="sp-ul-dot">${done ? 'Done' : 'Open'}</span><span class="sp-ul-name">${achievement.name}</span><span class="sp-ul-thresh">${done ? achievement.desc : 'Not earned'}</span></div>`;
    }).join('');
    const body = document.getElementById('spBody');
    if (!body) return;
    body.innerHTML = `<div class="sp-user-row"><div class="sp-username"></div><div class="sp-level">LVL ${options.calcLevel(interactions)}</div></div><div class="sp-since">citizen since ${stats.joinDate ? options.formatDate(stats.joinDate) : 'today'}</div><div class="sp-cards"><div class="sp-card"><div class="sc-val">${options.formatTime(Number(localStorage.getItem('minicityTime') ?? 0))}</div><div class="sc-lbl">TIME IN CITY</div></div><div class="sp-card"><div class="sc-val">${interactions}</div><div class="sc-lbl">INTERACTIONS</div></div><div class="sp-card"><div class="sc-val">${visited}/${options.getBuildingCount()}</div><div class="sc-lbl">BUILDINGS VISITED</div></div><div class="sp-card"><div class="sc-val">${Math.round(stats.distance ?? 0)}</div><div class="sc-lbl">DISTANCE WALKED</div></div></div><div class="sp-prog-section"><div class="sp-prog-label">${next ? `NEXT UNLOCK ${interactions}/${target}` : 'ALL UNLOCKS EARNED'}</div><div class="sp-prog-track"><div class="sp-prog-fill" style="width:${progress}%"></div></div></div><div class="sp-unlocks"><div class="sp-ul-title">UNLOCK HISTORY</div>${unlockRows}</div><div class="sp-unlocks"><div class="sp-ul-title">ACHIEVEMENTS ${achievementIds.length}/${options.achievements.length}</div>${achievementRows}</div>`;
    body.querySelector('.sp-username')?.replaceChildren(document.createTextNode(localStorage.getItem('minicityUser') ?? 'visitor'));
  }

  function renderRaw(): void {
    const stats = options.getStats();
    const rows = Object.entries(stats).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n');
    const body = document.getElementById('spBody');
    if (!body) return;
    const pre = document.createElement('pre');
    pre.className = 'sp-raw';
    pre.textContent = `user_id: ${options.getUserId()}\n${rows}`;
    body.replaceChildren(pre);
  }

  return { open, close, setMode, render };
}
