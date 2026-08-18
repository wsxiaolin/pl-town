import * as THREE from 'three';
import type { BuiltBuilding } from '../../rendering/buildingMeshFactory';

type Building = BuiltBuilding;

export function createBuildingLabelController(options: {
  getBuildings: () => readonly Building[];
  isStoryLocked: (building: Building) => boolean;
  interact: (building: Building) => void;
}) {
  function addLabels(): void {
    const wrap = document.getElementById('labelsWrap');
    if (!wrap) return;
    options.getBuildings().filter((building) => !options.isStoryLocked(building)).forEach((building) => {
      const element = document.createElement('a');
      element.className = 'b-label-item'; element.href = '#'; element.tabIndex = 0;
      element.dataset.buildingId = building.id;
      element.setAttribute('aria-label', `${building.label}${building.isStats ? ' - open stats panel' : ' - view details'}`);
      element.innerHTML = `<span class="bl-icon">${building.icon}</span><span class="bl-name">${building.label}</span>`;
      element.addEventListener('click', (event) => { event.preventDefault(); options.interact(building); });
      element.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); options.interact(building); } });
      if (!building.isStats) element.querySelector('.bl-name')?.addEventListener('dblclick', (event) => { event.preventDefault(); event.stopPropagation(); startRename(building, element.querySelector('.bl-name') as HTMLElement); });
      wrap.appendChild(element); building.labelEl = element;
    });
  }

  function applyRenames(): void {
    const saved = JSON.parse(localStorage.getItem('minicityRenames') ?? '{}');
    options.getBuildings().forEach((building) => {
      if (saved[building.id] && building.labelEl) building.labelEl.querySelector('.bl-name')!.textContent = saved[building.id];
    });
  }

  function startRename(building: Building, nameElement: HTMLElement): void {
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

  return { addLabels, applyRenames };
}
