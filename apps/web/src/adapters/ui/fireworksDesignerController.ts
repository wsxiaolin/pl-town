// 烟花铺设计台（DOM 适配器）：高度/颜色/花形参数 + 21×21 拼字点阵
// 画布 + 2D 物理预览 + 云端清单（存稿 30 金币）。形状→粒子的数学与
// 3D 引擎共用 city/fireworks/fireworksDesign（纯模块），预览只是把同
// 一份 BurstSeed 投影到画布上，保证「所见即所得」。
import {
  FIREWORK_SAVE_PRICE, FIREWORK_SHAPE_LABELS, FIREWORK_SHAPES, FIREWORK_NAME_MAX,
  PATTERN_COLS, PATTERN_ROWS, buildBurstSeeds, defaultFireworkDesign, encodePatternCells,
  emptyGrid, seedBurstMath, validateFireworkDesign,
  type FireworkDesign, type FireworkShape,
} from '../../city/fireworks/fireworksDesign';
import type { FireworksClient, FireworkRecordView } from '../../city/fireworks/fireworksClient';

const GRID_COLS = PATTERN_COLS;
const GRID_ROWS = PATTERN_ROWS;
const PREVIEW_FPS_BUDGET_MS = 33;

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  // eslint-disable-next-line no-bitwise
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function createFireworksDesignerController(options: {
  document: Document;
  signal: AbortSignal;
  client: FireworksClient;
  showToast: (message: string) => void;
  getCurrency: () => number;
  isOnline: () => boolean;
}) {
  const doc = options.document;
  const panel = (() => {
    const element = doc.getElementById('fireworksPanel');
    if (!element) throw new Error('#fireworksPanel missing');
    return element;
  })();

  let design: FireworkDesign = defaultFireworkDesign();
  let grid: boolean[] = emptyGrid();
  let tool: 'draw' | 'erase' = 'draw';
  let symmetry = true;
  let editingId: string | null = null;
  let ownRecords: FireworkRecordView[] = [];
  let confirmArmed = false;
  let confirmTimer = 0;
  let previewHandle = 0;
  let previewSeeds: ReturnType<typeof buildBurstSeeds> = [];
  let previewBurstTime = -1;

  const gridCanvas = panel.querySelector('[data-fw-grid]') as HTMLCanvasElement;
  const previewCanvas = panel.querySelector('[data-fw-preview]') as HTMLCanvasElement;
  const gridCtx = gridCanvas.getContext('2d')!;
  const previewCtx = previewCanvas.getContext('2d')!;
  const cellPx = gridCanvas.width / GRID_COLS;

  const nameInput = panel.querySelector('[data-fw-name]') as HTMLInputElement;
  const shapesRow = panel.querySelector('[data-fw-shapes]') as HTMLElement;
  const patternSection = panel.querySelector('[data-fw-pattern-section]') as HTMLElement;
  const cellsLabel = panel.querySelector('[data-fw-cells]') as HTMLElement;
  const statusLabel = panel.querySelector('[data-fw-status]') as HTMLElement;
  const saveButton = panel.querySelector('[data-fw-save]') as HTMLButtonElement;
  const mineList = panel.querySelector('[data-fw-mine-list]') as HTMLElement;
  const heightInput = panel.querySelector('[data-fw-height]') as HTMLInputElement;
  const sizeInput = panel.querySelector('[data-fw-size]') as HTMLInputElement;
  const sparkleInput = panel.querySelector('[data-fw-sparkle]') as HTMLInputElement;
  const primaryInput = panel.querySelector('[data-fw-primary]') as HTMLInputElement;
  const secondaryInput = panel.querySelector('[data-fw-secondary]') as HTMLInputElement;
  const trailInput = panel.querySelector('[data-fw-trail]') as HTMLInputElement;

  // ── 状态同步 ─────────────────────────────────────────────
  function syncDesignFromInputs(): void {
    design = {
      ...design,
      height: Number(heightInput.value),
      size: Number(sizeInput.value),
      sparkle: Number(sparkleInput.value),
      colors: {
        primary: primaryInput.value,
        secondary: secondaryInput.value,
        trail: trailInput.value,
      },
    };
    (panel.querySelector('[data-fw-height-value]') as HTMLElement).textContent = `${design.height}`;
    (panel.querySelector('[data-fw-size-value]') as HTMLElement).textContent = `${design.size}%`;
    (panel.querySelector('[data-fw-sparkle-value]') as HTMLElement).textContent = `${design.sparkle}`;
    rebuildPreviewSeeds();
  }

  function syncPatternIntoDesign(): void {
    if (design.shape === 'pattern') {
      design = { ...design, pattern: { cols: GRID_COLS, rows: GRID_ROWS, cells: encodePatternCells(grid) } };
    }
    rebuildPreviewSeeds();
  }

  function setStatus(message: string, isError = false): void {
    statusLabel.textContent = message;
    statusLabel.classList.toggle('error', isError);
  }

  // ── 花形按钮 ─────────────────────────────────────────────
  function renderShapeButtons(): void {
    shapesRow.replaceChildren();
    for (const shape of FIREWORK_SHAPES) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'fw-shape' + (design.shape === shape ? ' active' : '');
      button.textContent = FIREWORK_SHAPE_LABELS[shape];
      button.dataset.fwShape = shape;
      shapesRow.appendChild(button);
    }
    patternSection.hidden = design.shape !== 'pattern';
  }

  // ── 拼字网格 ─────────────────────────────────────────────
  function drawGrid(): void {
    gridCtx.fillStyle = '#101322';
    gridCtx.fillRect(0, 0, gridCanvas.width, gridCanvas.height);
    gridCtx.strokeStyle = 'rgba(217, 164, 65, 0.22)';
    gridCtx.lineWidth = 1;
    for (let col = 0; col <= GRID_COLS; col += 1) {
      gridCtx.beginPath();
      gridCtx.moveTo(col * cellPx, 0);
      gridCtx.lineTo(col * cellPx, gridCanvas.height);
      gridCtx.stroke();
    }
    for (let row = 0; row <= GRID_ROWS; row += 1) {
      gridCtx.beginPath();
      gridCtx.moveTo(0, row * cellPx);
      gridCtx.lineTo(gridCanvas.width, row * cellPx);
      gridCtx.stroke();
    }
    for (let row = 0; row < GRID_ROWS; row += 1) {
      for (let col = 0; col < GRID_COLS; col += 1) {
        if (!grid[row * GRID_COLS + col]) continue;
        gridCtx.fillStyle = design.colors.primary;
        gridCtx.fillRect(col * cellPx + 2, row * cellPx + 2, cellPx - 4, cellPx - 4);
      }
    }
    const count = grid.filter(Boolean).length;
    cellsLabel.textContent = `${count} 点`;
  }

  function paintCell(event: PointerEvent): void {
    const rect = gridCanvas.getBoundingClientRect();
    const scaleX = gridCanvas.width / rect.width;
    const col = Math.floor((event.clientX - rect.left) * scaleX / cellPx);
    const row = Math.floor((event.clientY - rect.top) * (gridCanvas.height / rect.height) / cellPx);
    if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
    const value = tool === 'draw';
    grid[row * GRID_COLS + col] = value;
    if (symmetry) grid[row * GRID_COLS + (GRID_COLS - 1 - col)] = value;
    drawGrid();
    syncPatternIntoDesign();
  }

  let painting = false;
  gridCanvas.addEventListener('pointerdown', (event) => {
    painting = true;
    gridCanvas.setPointerCapture(event.pointerId);
    paintCell(event);
  }, { signal: options.signal });
  gridCanvas.addEventListener('pointermove', (event) => {
    if (painting) paintCell(event);
  }, { signal: options.signal });
  gridCanvas.addEventListener('pointerup', () => { painting = false; }, { signal: options.signal });

  // ── 2D 预览 ──────────────────────────────────────────────
  function rebuildPreviewSeeds(): void {
    seedBurstMath(20261007);
    const radius = (design.shape === 'pattern' ? 8.8 : 7.0) * design.size / 100;
    previewSeeds = buildBurstSeeds(design, radius);
    previewBurstTime = -1;
  }

  let lastPreviewFrame = 0;
  function renderPreview(now: number): void {
    previewHandle = window.requestAnimationFrame(renderPreview);
    if (now - lastPreviewFrame < PREVIEW_FPS_BUDGET_MS) return;
    lastPreviewFrame = now;
    const width = previewCanvas.width;
    const height = previewCanvas.height;
    previewCtx.fillStyle = '#0b0e1a';
    previewCtx.fillRect(0, 0, width, height);
    // 地平线与发射点。
    const originX = width / 2;
    const originY = height - 14;
    const apexY = 34;
    const scale = (height - 90) / 90; // 世界 y → 预览像素
    previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    previewCtx.beginPath();
    previewCtx.moveTo(0, originY + 10);
    previewCtx.lineTo(width, originY + 10);
    previewCtx.stroke();

    if (previewBurstTime < 0) {
      previewBurstTime = now;
    }
    const elapsed = (now - previewBurstTime) / 1000;
    const riseDuration = design.height / 34;
    const [pr, pg, pb] = hexToRgb(design.colors.primary);
    const [sr, sg, sb] = hexToRgb(design.colors.secondary);
    const [tr, tg, tb] = hexToRgb(design.colors.trail);
    if (elapsed < riseDuration) {
      // 升空段：亮点 + 拖尾。
      const y = originY - (originY - apexY - (90 - design.height) * scale) * (elapsed / riseDuration);
      previewCtx.fillStyle = `rgb(${tr},${tg},${tb})`;
      previewCtx.beginPath();
      previewCtx.arc(originX, y, 2.2, 0, Math.PI * 2);
      previewCtx.fill();
      return;
    }
    const burstAge = elapsed - riseDuration;
    for (const seed of previewSeeds) {
      const decay = Math.exp(-seed.drag * burstAge);
      const x = originX + seed.vx * (1 - decay) / seed.drag * scale;
      const y = apexY + (90 - design.height) * scale - seed.vy * (1 - decay) / seed.drag * scale + 0.5 * 7.2 * seed.gravity * burstAge * burstAge * scale;
      const lifeLeft = seed.life - burstAge;
      if (lifeLeft <= 0) continue;
      let alpha = Math.min(1, burstAge * 9) * Math.min(1, lifeLeft / 0.55);
      if (seed.flicker) alpha *= 0.5 + 0.5 * Math.abs(Math.sin(burstAge * 13 + seed.vx));
      if (alpha <= 0.02) continue;
      const mixT = seed.colorMix;
      const r = Math.round(pr + (sr - pr) * mixT);
      const g = Math.round(pg + (sg - pg) * mixT);
      const b = Math.round(pb + (sb - pb) * mixT);
      previewCtx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      previewCtx.beginPath();
      previewCtx.arc(x, y, 1.4 + seed.size * 0.7, 0, Math.PI * 2);
      previewCtx.fill();
    }
    // 每 6 秒重放。
    if (burstAge > 6.2) previewBurstTime = -1;
  }

  // ── 云端清单 ─────────────────────────────────────────────
  function renderMine(): void {
    mineList.replaceChildren();
    if (!options.isOnline()) {
      const empty = doc.createElement('li');
      empty.className = 'fw-empty';
      empty.textContent = '登录后可以把设计存入云端';
      mineList.appendChild(empty);
      return;
    }
    if (ownRecords.length === 0) {
      const empty = doc.createElement('li');
      empty.className = 'fw-empty';
      empty.textContent = '还没有存过的烟花';
      mineList.appendChild(empty);
      return;
    }
    for (const record of ownRecords) {
      const item = doc.createElement('li');
      item.className = 'fw-mine-item' + (record.id === editingId ? ' current' : '');
      const name = doc.createElement('span');
      name.className = 'fw-mine-name';
      name.textContent = `《${record.name}》${FIREWORK_SHAPE_LABELS[record.design.shape]}`;
      item.appendChild(name);
      const load = doc.createElement('button');
      load.type = 'button';
      load.textContent = '载入';
      load.dataset.fwLoad = record.id;
      item.appendChild(load);
      const remove = doc.createElement('button');
      remove.type = 'button';
      remove.textContent = '删';
      remove.dataset.fwRemove = record.id;
      item.appendChild(remove);
      mineList.appendChild(item);
    }
  }

  async function refreshMine(): Promise<void> {
    if (!options.isOnline()) { renderMine(); return; }
    try {
      const library = await options.client.list();
      ownRecords = library.own;
      renderMine();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '读取清单失败', true);
    }
  }

  function loadRecord(record: FireworkRecordView): void {
    editingId = record.id;
    design = JSON.parse(JSON.stringify(record.design)) as FireworkDesign;
    nameInput.value = record.name;
    heightInput.value = String(design.height);
    sizeInput.value = String(design.size);
    sparkleInput.value = String(design.sparkle);
    primaryInput.value = design.colors.primary;
    secondaryInput.value = design.colors.secondary;
    trailInput.value = design.colors.trail;
    if (design.pattern) {
      grid = emptyGrid();
      // 解码回网格：直接用服务端位图。
      const bits = decodePatternSafe(design.pattern);
      for (let i = 0; i < grid.length && i < bits.length; i += 1) grid[i] = bits[i]!;
    } else {
      grid = emptyGrid();
    }
    syncDesignFromInputs();
    renderShapeButtons();
    drawGrid();
    setStatus(`已载入《${record.name}》，修改后重新存入会再收 ${FIREWORK_SAVE_PRICE} 金币`);
  }

  function decodePatternSafe(pattern: { cols: number; rows: number; cells: string }): boolean[] {
    const total = pattern.cols * pattern.rows;
    const out: boolean[] = new Array(total).fill(false);
    let binary: string;
    try {
      binary = atob(pattern.cells);
    } catch {
      return out;
    }
    for (let i = 0; i < total && i < binary.length * 8; i += 1) {
      out[i] = (binary.charCodeAt(i >> 3)! & (1 << (i & 7))) !== 0;
    }
    return out;
  }

  // ── 保存（两步确认）─────────────────────────────────────
  function disarmConfirm(): void {
    confirmArmed = false;
    window.clearTimeout(confirmTimer);
    saveButton.textContent = `存入云端 · ${FIREWORK_SAVE_PRICE} 金币`;
    saveButton.classList.remove('armed');
  }

  async function save(): Promise<void> {
    if (!options.isOnline()) {
      setStatus('当前离线：先登录小城再保存', true);
      return;
    }
    const name = nameInput.value.trim();
    if (!name) { setStatus('先给这支烟花起个名字', true); return; }
    const problem = validateFireworkDesign(design);
    if (problem) { setStatus(problem, true); return; }
    if (!confirmArmed) {
      confirmArmed = true;
      saveButton.textContent = '确认花费 30 金币存入？';
      saveButton.classList.add('armed');
      confirmTimer = window.setTimeout(disarmConfirm, 3500);
      return;
    }
    disarmConfirm();
    if (options.getCurrency() < FIREWORK_SAVE_PRICE) {
      setStatus(`存入需要 ${FIREWORK_SAVE_PRICE} 金币，余额不足`, true);
      return;
    }
    saveButton.disabled = true;
    setStatus('正在存入云端…');
    try {
      const { record } = await options.client.save(design, name, editingId ?? undefined);
      editingId = record.id;
      setStatus(`《${record.name}》已存入云端（-30 金币），去观景台就能看到它`);
      options.showToast('烟花已存入云端');
      await refreshMine();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败', true);
    } finally {
      saveButton.disabled = false;
    }
  }

  // ── 事件绑定 ─────────────────────────────────────────────
  panel.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (target.closest('[data-fw-close]')) { close(); return; }
    const shapeButton = target.closest('[data-fw-shape]') as HTMLElement | null;
    if (shapeButton) {
      design = { ...design, shape: shapeButton.dataset.fwShape as FireworkShape };
      renderShapeButtons();
      syncPatternIntoDesign();
      return;
    }
    if (target.closest('[data-fw-tool="draw"]')) { tool = 'draw'; setToolButtons(); return; }
    if (target.closest('[data-fw-tool="erase"]')) { tool = 'erase'; setToolButtons(); return; }
    if (target.closest('[data-fw-clear]')) { grid = emptyGrid(); drawGrid(); syncPatternIntoDesign(); return; }
    if (target.closest('[data-fw-refresh]')) { void refreshMine(); return; }
    if (target.closest('[data-fw-save]')) { void save(); return; }
    const loadButton = target.closest('[data-fw-load]') as HTMLElement | null;
    if (loadButton) {
      const record = ownRecords.find((entry) => entry.id === loadButton.dataset.fwLoad);
      if (record) loadRecord(record);
      return;
    }
    const removeButton = target.closest('[data-fw-remove]') as HTMLElement | null;
    if (removeButton && removeButton.dataset.fwRemove) {
      void removeRecord(removeButton.dataset.fwRemove);
    }
  }, { signal: options.signal });

  function setToolButtons(): void {
    panel.querySelectorAll('[data-fw-tool]').forEach((button) => {
      button.classList.toggle('active', (button as HTMLElement).dataset.fwTool === tool);
    });
  }

  async function removeRecord(designId: string): Promise<void> {
    try {
      await options.client.remove(designId);
      if (editingId === designId) editingId = null;
      options.showToast('已删除该烟花');
      await refreshMine();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '删除失败', true);
    }
  }

  nameInput.addEventListener('input', () => {
    if (nameInput.value.length > FIREWORK_NAME_MAX) nameInput.value = nameInput.value.slice(0, FIREWORK_NAME_MAX);
  }, { signal: options.signal });
  for (const input of [heightInput, sizeInput, sparkleInput, primaryInput, secondaryInput, trailInput]) {
    input.addEventListener('input', () => { syncDesignFromInputs(); drawGrid(); }, { signal: options.signal });
  }
  (panel.querySelector('[data-fw-symmetry]') as HTMLInputElement).addEventListener('change', (event) => {
    symmetry = (event.target as HTMLInputElement).checked;
  }, { signal: options.signal });

  // 云端有新烟花时自动刷新「我的」清单。
  options.client.onLibraryChanged(() => {
    if (isOpen()) void refreshMine();
  });

  function isOpen(): boolean {
    return !panel.hidden;
  }
  function open(): void {
    panel.hidden = false;
    disarmConfirm();
    syncDesignFromInputs();
    renderShapeButtons();
    drawGrid();
    void refreshMine();
    previewHandle = window.requestAnimationFrame(renderPreview);
  }
  function close(): void {
    panel.hidden = true;
    window.cancelAnimationFrame(previewHandle);
    previewHandle = 0;
  }
  function dispose(): void {
    close();
  }

  return { open, close, isOpen, dispose };
}
