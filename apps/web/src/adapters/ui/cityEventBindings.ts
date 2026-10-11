export function bindCityUiEvents(options: {
  signal: AbortSignal;
  closeRenderSettings: () => void;
  onYouClick: () => void;
  openStats: () => void;
  closeStats: () => void;
  openMemorial: (beforeOpen?: () => void) => void;
  setStatsMode: (mode: 'clean' | 'raw') => void;
  closeWorks: () => void;
  closeWriterCatalog: () => void;
  closeAcademy: () => void;
  closeAcademyReader: () => void;
  closeMutualAid: () => void;
  isMapOpen: () => boolean;
  toggleMap: () => void;
  toggleWalkMode?: () => void;
  isWalkModeActive?: () => boolean;
  closeModal: () => void;
  closeNpcDialog: () => void;
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
  document.getElementById('landscapeFullscreen')?.addEventListener('click', (event) => {
    event.preventDefault();
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, { signal });
  document.getElementById('spClose')?.addEventListener('click', options.closeStats, { signal });
  document.getElementById('walkToggle')?.addEventListener('click', () => options.toggleWalkMode?.(), { signal });
  document.getElementById('statsToggle')?.addEventListener('click', options.openStats, { signal });
  document.getElementById('spMemorial')?.addEventListener('click', () => {
    options.openMemorial(options.closeStats);
  }, { signal });
  document.getElementById('spModeClean')?.addEventListener('click', () => options.setStatsMode('clean'), { signal });
  document.getElementById('spModeRaw')?.addEventListener('click', () => options.setStatsMode('raw'), { signal });
  document.getElementById('worksClose')?.addEventListener('click', options.closeWorks, { signal });
  document.getElementById('writerCatalogClose')?.addEventListener('click', options.closeWriterCatalog, { signal });
  document.getElementById('academyClose')?.addEventListener('click', options.closeAcademy, { signal });
  document.getElementById('academyReaderClose')?.addEventListener('click', options.closeAcademyReader, { signal });
  document.getElementById('mutualAidClose')?.addEventListener('click', options.closeMutualAid, { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (options.isWalkModeActive?.()) return options.toggleWalkMode?.();
    if (options.isMapOpen()) return options.toggleMap();
    if (document.getElementById('academyReader')?.classList.contains('open')) return options.closeAcademyReader();
    options.closeRenderSettings(); options.closeStats(); options.closeWorks(); options.closeWriterCatalog(); options.closeAcademy(); options.closeMutualAid(); options.closeModal(); options.closeNpcDialog();
  }, { signal });
  document.getElementById('logoUser')?.addEventListener('click', (event) => {
    if ((event.currentTarget as HTMLElement).classList.contains('login-required')) options.showLogin();
  }, { signal });
  window.addEventListener('resize', options.resize, { signal });
}
