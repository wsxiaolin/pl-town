import type { BuildingEntity } from '../../city/buildingEntity';

export function createBuildingLabelController(options: {
  getBuildings: () => readonly BuildingEntity[];
  isStoryLocked: (building: BuildingEntity) => boolean;
  interact: (building: BuildingEntity) => void;
  /**
   * Labels that are outbound links rather than walk-and-interact targets
   * (the bulletin board's announcement page). The browser then owns the
   * navigation: middle-click, ⌘-click and keyboard activation all work
   * natively, and no user-activation bookkeeping is needed.
   */
  getExternalHref?: (building: BuildingEntity) => string | null;
}) {
  function addLabel(building: BuildingEntity): void {
    const wrap = document.getElementById('labelsWrap');
    if (!wrap || building.labelEl) return;
    const element = document.createElement('a');
    element.className = 'b-label-item'; element.href = '#'; element.tabIndex = 0;
    element.dataset.buildingId = building.id;
    element.setAttribute('aria-label', `${building.label}${building.isStats ? ' - open stats panel' : ' - view details'}`);
    element.innerHTML = `<span class="bl-icon">${building.icon}</span><span class="bl-name">${building.label}</span>`;
    const externalHref = options.getExternalHref?.(building) ?? null;
    if (externalHref) {
      // A real link with real semantics: the native click carries the user
      // activation, so the popup blocker stays out of the way. The rename
      // binding below stays attached but is unreachable for these labels —
      // the first click already navigates away.
      element.href = externalHref;
      element.target = '_blank';
      element.rel = 'noopener noreferrer';
    } else {
      element.addEventListener('click', (event) => { event.preventDefault(); options.interact(building); });
      element.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); options.interact(building); } });
    }
    if (!building.isStats) element.querySelector('.bl-name')?.addEventListener('dblclick', (event) => { event.preventDefault(); event.stopPropagation(); startRename(building, element.querySelector('.bl-name') as HTMLElement); });
    wrap.appendChild(element); building.labelEl = element;
  }

  function addLabels(): void {
    options.getBuildings().filter((building) => !options.isStoryLocked(building)).forEach(addLabel);
  }

  function removeLabel(building: BuildingEntity): void {
    building.labelEl?.remove();
    building.labelEl = null;
  }

  function applyRenames(): void {
    const saved = JSON.parse(localStorage.getItem('minicityRenames') ?? '{}');
    options.getBuildings().forEach((building) => {
      if (saved[building.id] && building.labelEl) building.labelEl.querySelector('.bl-name')!.textContent = saved[building.id];
    });
  }

  function startRename(building: BuildingEntity, nameElement: HTMLElement): void {
    const current = nameElement.textContent ?? '';
    const input = document.createElement('input');
    input.className = 'bl-rename-input'; input.value = current; input.maxLength = 16;
    nameElement.replaceWith(input); input.focus(); input.select();
    const finish = () => {
      const value = input.value.trim() || current;
      const span = document.createElement('span');
      span.className = 'bl-name'; span.textContent = value;
      span.addEventListener('dblclick', (event) => { event.preventDefault(); event.stopPropagation(); startRename(building, span); });
      input.replaceWith(span);
      const saved = JSON.parse(localStorage.getItem('minicityRenames') ?? '{}');
      saved[building.id] = value; localStorage.setItem('minicityRenames', JSON.stringify(saved));
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (event) => { if (event.key === 'Enter') input.blur(); if (event.key === 'Escape') { input.value = current; input.blur(); } });
  }

  return { addLabels, applyRenames, addLabel, removeLabel };
}
