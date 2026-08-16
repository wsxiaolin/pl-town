export function bindCityUiEvents(options: {
  signal: AbortSignal;
  closeRenderSettings: () => void;
  onYouClick: () => void;
  closeStats: () => void;
  setStatsMode: (mode: 'clean' | 'raw') => void;
  closeWorks: () => void;
  closeWriterCatalog: () => void;
  closeWorkDetail: () => void;
  toggleWorkStar: () => void;
  loadWorkComments: () => void;
  loadWorkDerivatives: () => void;
  loadWorkSupporters: () => void;
  toggleWorkSupport: () => void;
  postWorkComment: (event: Event) => void;
  isMapOpen: () => boolean;
  toggleMap: () => void;
  closeModal: () => void;
  closeNpcDialog: () => void;
  login: () => void;
  loginFeedback: () => void;
  showLogin: () => void;
  resize: () => void;
}) {
  const { signal } = options;
  document.getElementById('renderSettingsClose')?.addEventListener('click', options.closeRenderSettings, { signal });
  document.querySelector('.you-block')?.addEventListener('click', options.onYouClick, { signal });
  document.getElementById('fsToggle')?.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, { signal });
  document.getElementById('landscapeFullscreen')?.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, { signal });
  document.getElementById('spClose')?.addEventListener('click', options.closeStats, { signal });
  document.getElementById('spModeClean')?.addEventListener('click', () => options.setStatsMode('clean'), { signal });
  document.getElementById('spModeRaw')?.addEventListener('click', () => options.setStatsMode('raw'), { signal });
  document.getElementById('worksClose')?.addEventListener('click', options.closeWorks, { signal });
  document.getElementById('writerCatalogClose')?.addEventListener('click', options.closeWriterCatalog, { signal });
  document.getElementById('workDetailClose')?.addEventListener('click', options.closeWorkDetail, { signal });
  document.getElementById('workStar')?.addEventListener('click', options.toggleWorkStar, { signal });
  document.getElementById('workCommentsTab')?.addEventListener('click', options.loadWorkComments, { signal });
  document.getElementById('workDerivatives')?.addEventListener('click', options.loadWorkDerivatives, { signal });
  document.getElementById('workSupport')?.addEventListener('click', options.toggleWorkSupport, { signal });
  document.getElementById('workSupporters')?.addEventListener('click', options.loadWorkSupporters, { signal });
  document.getElementById('workCommentForm')?.addEventListener('submit', options.postWorkComment, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (options.isMapOpen()) return options.toggleMap();
    options.closeRenderSettings(); options.closeStats(); options.closeWorks(); options.closeWriterCatalog(); options.closeModal(); options.closeNpcDialog();
  }, { signal });
  document.getElementById('loginBtn')?.addEventListener('click', options.login, { signal });
  document.getElementById('loginInput')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') options.login(); }, { signal });
  document.getElementById('loginPassword')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') options.login(); }, { signal });
  document.getElementById('loginInput')?.addEventListener('input', options.loginFeedback, { signal });
  document.getElementById('logoUser')?.addEventListener('click', (event) => {
    if ((event.currentTarget as HTMLElement).classList.contains('login-required')) options.showLogin();
  }, { signal });
  window.addEventListener('resize', options.resize, { signal });
}
