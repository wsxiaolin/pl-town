import {
  getRenderResolutionLimit,
  readRenderSettings,
  RENDER_SETTINGS_KEY,
  type RenderSettings,
} from '../../rendering/createRenderer';

type RenderPresetName = 'saving' | 'balanced' | 'high' | 'ultra';

type RenderSettingsControllerOptions = {
  signal: AbortSignal;
  maxAnisotropy: number;
  maxTextureSize: number;
  close: () => void;
};

const PRESET_LABELS: Record<RenderPresetName, string> = {
  saving: '节能',
  balanced: '均衡',
  high: '高清',
  ultra: '极致',
};

function selectSupportedAnisotropy(requested: number, maxAnisotropy: number): number {
  return [16, 8, 4, 1].find((value) => value <= requested && value <= maxAnisotropy) ?? 1;
}

export function setupRenderSettingsController(options: RenderSettingsControllerOptions): void {
  const { signal, maxAnisotropy, maxTextureSize, close } = options;
  const toggle = document.getElementById('renderSettingsToggle');
  const panel = document.getElementById('renderSettings');
  if (!toggle || !panel) return;

  const resolution = panel.querySelector<HTMLInputElement>('#renderResolution')!;
  const resolutionValue = panel.querySelector<HTMLOutputElement>('#renderResolutionValue')!;
  const antialias = panel.querySelector<HTMLInputElement>('#renderAntialias')!;
  const anisotropy = panel.querySelector<HTMLSelectElement>('#renderAnisotropy')!;
  const anisotropyValue = panel.querySelector<HTMLOutputElement>('#renderAnisotropyValue')!;
  const shadows = panel.querySelector<HTMLInputElement>('#renderShadows')!;
  const exposure = panel.querySelector<HTMLInputElement>('#renderExposure')!;
  const exposureValue = panel.querySelector<HTMLOutputElement>('#renderExposureValue')!;
  const presetStatus = panel.querySelector<HTMLElement>('#renderPresetStatus')!;
  const presetButtons = [...panel.querySelectorAll<HTMLButtonElement>('[data-render-preset]')];

  const resolutionLimit = getRenderResolutionLimit(
    maxTextureSize,
    window.innerWidth,
    window.innerHeight,
  );
  const normalizedMaxAnisotropy = Math.max(1, maxAnisotropy);
  const supportedAnisotropy = selectSupportedAnisotropy(16, normalizedMaxAnisotropy);
  const settings = readRenderSettings();

  resolution.min = '0.5';
  resolution.max = String(resolutionLimit);
  resolution.step = '0.25';
  resolution.value = String(Math.min(settings.resolution, resolutionLimit));
  antialias.checked = settings.antialias;
  anisotropy.value = String(selectSupportedAnisotropy(settings.anisotropy, normalizedMaxAnisotropy));
  shadows.checked = settings.shadows;
  exposure.value = String(settings.exposure);

  for (const option of anisotropy.options) {
    option.disabled = Number(option.value) > normalizedMaxAnisotropy;
  }

  panel.querySelector<HTMLElement>('#renderDeviceDpr')!.textContent = `${formatMetric(window.devicePixelRatio || 1)}x`;
  panel.querySelector<HTMLElement>('#renderDeviceTexture')!.textContent = `${maxTextureSize}px`;
  panel.querySelector<HTMLElement>('#renderDeviceAnisotropy')!.textContent = `${supportedAnisotropy}x`;
  panel.querySelector<HTMLElement>('#renderResolutionMaxLabel')!.textContent = `${formatMetric(resolutionLimit)}x 设备上限`;
  panel.querySelector<HTMLElement>('#renderDeviceHint')!.textContent = getCapabilityHint(
    resolutionLimit,
    supportedAnisotropy,
  );

  const presets: Record<RenderPresetName, Omit<RenderSettings, 'exposure'>> = {
    saving: { resolution: Math.min(0.75, resolutionLimit), antialias: false, anisotropy: 1, shadows: false },
    balanced: { resolution: Math.min(1.5, resolutionLimit), antialias: false, anisotropy: selectSupportedAnisotropy(4, normalizedMaxAnisotropy), shadows: false },
    high: { resolution: Math.min(2.5, resolutionLimit), antialias: true, anisotropy: selectSupportedAnisotropy(8, normalizedMaxAnisotropy), shadows: false },
    ultra: { resolution: resolutionLimit, antialias: true, anisotropy: supportedAnisotropy, shadows: true },
  };

  const currentValues = (): Omit<RenderSettings, 'exposure'> => ({
    resolution: Number(resolution.value),
    antialias: antialias.checked,
    anisotropy: Number(anisotropy.value),
    shadows: shadows.checked,
  });

  const updateLabels = () => {
    resolutionValue.textContent = `${formatMetric(Number(resolution.value))}x`;
    anisotropyValue.textContent = `${anisotropy.value}x`;
    exposureValue.textContent = Number(exposure.value).toFixed(2);

    const values = currentValues();
    const activePreset = (Object.keys(presets) as RenderPresetName[]).find((name) =>
      Object.entries(presets[name]).every(([key, value]) => values[key as keyof typeof values] === value),
    );
    presetStatus.textContent = activePreset ? PRESET_LABELS[activePreset] : '自定义';
    for (const button of presetButtons) {
      const isActive = button.dataset.renderPreset === activePreset;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  };

  updateLabels();

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (panel.classList.contains('open')) close();
    else {
      panel.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
    }
  }, { signal });

  for (const button of presetButtons) {
    button.addEventListener('click', () => {
      const name = button.dataset.renderPreset as RenderPresetName;
      const preset = presets[name];
      resolution.value = String(preset.resolution);
      antialias.checked = preset.antialias;
      anisotropy.value = String(preset.anisotropy);
      shadows.checked = preset.shadows;
      updateLabels();
    }, { signal });
  }

  resolution.addEventListener('input', updateLabels, { signal });
  antialias.addEventListener('change', updateLabels, { signal });
  anisotropy.addEventListener('change', updateLabels, { signal });
  shadows.addEventListener('change', updateLabels, { signal });
  exposure.addEventListener('input', updateLabels, { signal });
  panel.querySelector('#renderSettingsApply')!.addEventListener('click', () => {
    localStorage.setItem(RENDER_SETTINGS_KEY, JSON.stringify({
      ...currentValues(),
      exposure: Number(exposure.value),
    } satisfies RenderSettings));
    window.location.reload();
  }, { signal });
  panel.querySelector('#renderSettingsReset')!.addEventListener('click', () => {
    localStorage.removeItem(RENDER_SETTINGS_KEY);
    window.location.reload();
  }, { signal });
  document.addEventListener('click', (event) => {
    if (panel.classList.contains('open') && !panel.contains(event.target as Node) && event.target !== toggle) close();
  }, { signal });
}

function formatMetric(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, '');
}

function getCapabilityHint(resolutionLimit: number, maxAnisotropy: number): string {
  const suggestedPreset = resolutionLimit >= 3 && maxAnisotropy >= 16
    ? '高清'
    : resolutionLimit >= 1.5 && maxAnisotropy >= 4
      ? '均衡'
      : '节能';
  return `建议从${suggestedPreset}开始；当前视口最高安全倍率 ${formatMetric(resolutionLimit)}x，超出会受图形缓冲尺寸限制。`;
}
