import type { TextureProgress } from '../../city/textureResourcePreloader';

export function updateTextureLoadUi(progress: TextureProgress): void {
  const bar = document.getElementById('textureLoadProgress') as HTMLProgressElement | null;
  const detail = document.getElementById('textureLoadDetail');
  const ratio = progress.totalBytes > 0
    ? progress.loadedBytes / progress.totalBytes
    : progress.loadedFiles / Math.max(1, progress.totalFiles);
  if (bar) bar.value = Math.min(1, ratio);
  if (detail) {
    const percent = Math.round(Math.min(1, ratio) * 100);
    detail.textContent = progress.failedFiles > 0
      ? `资源 ${percent}% · ${progress.failedFiles} 个资源将使用程序化材质`
      : `资源 ${percent}% · ${progress.loadedFiles}/${progress.totalFiles}`;
  }
}

export function finishTextureLoadUi(): void {
  document.getElementById('textureLoadPanel')?.classList.add('is-complete');
  const detail = document.getElementById('textureLoadDetail');
  if (detail) detail.textContent = '高清资源已就绪';
}
