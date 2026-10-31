// 烟花铺设计台（DOM 适配器）：按真实制作流程分四段——弹体与发射、星体
// 与开爆、颜色与花形、试放。物理参数由 city/fireworks/fireworksPhysics
// 推导成工艺卡；2D 试放使用与 3D 引擎相同的弹道与星体解析解。
import {
  FIREWORK_SAVE_PRICE, FIREWORK_SHAPE_LABELS, FIREWORK_SHAPES, FIREWORK_NAME_MAX,
  PATTERN_COLS, PATTERN_ROWS, buildBurstSeeds, decodePatternCells,
  defaultFireworkDesign, emptyGrid, encodePatternCells, normalizeFireworkDesign,
  projectToBillboard, recommendedBreakCharge, recommendedLiftCharge, seedBurstMath, validateFireworkDesign,
  type BurstSeed, type FireworkDesign, type FireworkShape, type FireworkTrail,
} from '../../city/fireworks/fireworksDesign';
import {
  craftReport, planShell, sampleStar, shellPosition, type CraftReport, type ShellPlan,
} from '../../city/fireworks/fireworksPhysics';
import type { FireworksClient, FireworkRecordView } from '../../city/fireworks/fireworksClient';

const GRID_COLS = PATTERN_COLS;
const GRID_ROWS = PATTERN_ROWS;
const PREVIEW_FPS_BUDGET_MS = 33;

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  // eslint-disable-next-line no-bitwise
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

type Preview = {
  plan: ShellPlan;
  report: CraftReport;
  seeds: BurstSeed[];
  maxLife: number;
};

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
  let preview: Preview | null = null;
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
  const caliberInput = panel.querySelector('[data-fw-caliber]') as HTMLInputElement;
  const liftInput = panel.querySelector('[data-fw-lift]') as HTMLInputElement;
  const heightInput = panel.querySelector('[data-fw-height]') as HTMLInputElement;
  const angleInput = panel.querySelector('[data-fw-angle]') as HTMLInputElement;
  const breakInput = panel.querySelector('[data-fw-break]') as HTMLInputElement;
  const starsInput = panel.querySelector('[data-fw-stars]') as HTMLInputElement;
  const starSizeInput = panel.querySelector('[data-fw-starsize]') as HTMLInputElement;
  const burnInput = panel.querySelector('[data-fw-burn]') as HTMLInputElement;
  const sparkleInput = panel.querySelector('[data-fw-sparkle]') as HTMLInputElement;
  const trailInput = panel.querySelector('[data-fw-trail]') as HTMLSelectElement;
  const primaryInput = panel.querySelector('[data-fw-primary]') as HTMLInputElement;
  const secondaryInput = panel.querySelector('[data-fw-secondary]') as HTMLInputElement;
  const trailColorInput = panel.querySelector('[data-fw-trail-color]') as HTMLInputElement;
  const craftFuse = panel.querySelector('[data-fw-craft-fuse]') as HTMLElement;
  const craftHeight = panel.querySelector('[data-fw-craft-height]') as HTMLElement;
  const craftRadius = panel.querySelector('[data-fw-craft-radius]') as HTMLElement;
  const craftStars = panel.querySelector('[data-fw-craft-stars]') as HTMLElement;
  const craftBurn = panel.querySelector('[data-fw-craft-burn]') as HTMLElement;
  const craftCharge = panel.querySelector('[data-fw-craft-charge]') as HTMLElement;
  const craftWarn = panel.querySelector('[data-fw-craft-warn]') as HTMLElement;
  const craftVerdict = panel.querySelector('[data-fw-craft-verdict]') as HTMLElement;

  // ── 状态同步 ─────────────────────────────────────────────
  function syncDesignFromInputs(): void {
    const nextCaliber = Number(caliberInput.value);
    const caliberChanged = nextCaliber !== design.caliber;
    const liftWasRecommended = design.liftCharge === recommendedLiftCharge(design.caliber);
    const breakWasRecommended = design.breakCharge === recommendedBreakCharge(design.caliber);
    design = {
      ...design,
      caliber: nextCaliber,
      liftCharge: Number(liftInput.value),
      height: Number(heightInput.value),
      launchAngle: Number(angleInput.value),
      breakCharge: Number(breakInput.value),
      starCount: Number(starsInput.value),
      starSize: Number(starSizeInput.value),
      burnTime: Number(burnInput.value),
      sparkle: Number(sparkleInput.value),
      trail: trailInput.value as FireworkTrail,
      colors: {
        primary: primaryInput.value,
        secondary: secondaryInput.value,
        trail: trailColorInput.value,
      },
    };
    // 弹径变化时，若当前装药仍等于旧推荐值，就跟着更新推荐值。
    if (caliberChanged && liftWasRecommended) {
      design = { ...design, liftCharge: recommendedLiftCharge(nextCaliber) };
      liftInput.value = String(design.liftCharge);
    }
    if (caliberChanged && breakWasRecommended) {
      design = { ...design, breakCharge: recommendedBreakCharge(nextCaliber) };
      breakInput.value = String(design.breakCharge);
    }
    (panel.querySelector('[data-fw-caliber-value]') as HTMLElement).textContent = `${design.caliber}mm`;
    (panel.querySelector('[data-fw-lift-value]') as HTMLElement).textContent = `${design.liftCharge}g`;
    (panel.querySelector('[data-fw-height-value]') as HTMLElement).textContent = `${design.height}`;
    (panel.querySelector('[data-fw-angle-value]') as HTMLElement).textContent = `${design.launchAngle}°`;
    (panel.querySelector('[data-fw-break-value]') as HTMLElement).textContent = `${design.breakCharge}g`;
    (panel.querySelector('[data-fw-stars-value]') as HTMLElement).textContent = `${design.starCount}`;
    (panel.querySelector('[data-fw-starsize-value]') as HTMLElement).textContent = `${design.starSize}mm`;
    (panel.querySelector('[data-fw-burn-value]') as HTMLElement).textContent = `${design.burnTime}s`;
    (panel.querySelector('[data-fw-sparkle-value]') as HTMLElement).textContent = `${design.sparkle}`;
    rebuildPreview();
  }

  function syncPatternIntoDesign(): void {
    if (design.shape === 'pattern') {
      design = { ...design, pattern: { cols: GRID_COLS, rows: GRID_ROWS, cells: encodePatternCells(grid) } };
    }
    rebuildPreview();
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
    if (event.isTrusted) gridCanvas.setPointerCapture(event.pointerId);
    paintCell(event);
  }, { signal: options.signal });
  gridCanvas.addEventListener('pointermove', (event) => {
    if (painting) paintCell(event);
  }, { signal: options.signal });
  gridCanvas.addEventListener('pointerup', () => { painting = false; }, { signal: options.signal });

  // ── 工艺卡 + 2D 试放 ─────────────────────────────────────
  function rebuildPreview(): void {
    seedBurstMath(20261007);
    const report = craftReport(design);
    const seeds = buildBurstSeeds(design, report.radius);
    preview = {
      plan: report.plan,
      report,
      seeds,
      maxLife: seeds.reduce((max, seed) => Math.max(max, seed.life), 0),
    };
    previewBurstTime = -1;
    renderCraft(report);
  }

  function renderCraft(report: CraftReport): void {
    craftFuse.textContent = `${report.plan.fuseTime.toFixed(1)}s`;
    craftHeight.textContent = `${report.plan.burstHeight.toFixed(1)}m`;
    craftRadius.textContent = `${report.radius.toFixed(1)}`;
    craftStars.textContent = `${design.starCount}`;
    craftBurn.textContent = `${design.burnTime}s`;
    craftCharge.textContent = `${report.recommendedLift}g / ${report.recommendedBreak}g`;
    craftWarn.textContent = report.warnings.join('　');
    craftVerdict.textContent = report.warnings.length > 0 ? '需调整' : '可试放';
    craftVerdict.classList.toggle('warn', report.warnings.length > 0);
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
    if (!preview) return;

    const { plan, report, seeds, maxLife } = preview;
    const scale = 2.55;
    const originX = width * 0.66;
    const groundY = height - 18;
    previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
    previewCtx.beginPath();
    previewCtx.moveTo(0, groundY + 6);
    previewCtx.lineTo(width, groundY + 6);
    previewCtx.stroke();
    // 高度刻度（每 20m，按相机广告牌上方向投影）。
    previewCtx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    previewCtx.font = '9px monospace';
    for (let m = 20; m <= 80; m += 20) {
      const y = groundY - projectToBillboard({ x: 0, y: m, z: 0 }).v * scale;
      previewCtx.fillRect(0, y, 6, 1);
      previewCtx.fillText(`${m}`, 8, y + 3);
    }

    const [pr, pg, pb] = hexToRgb(design.colors.primary);
    const [sr, sg, sb] = hexToRgb(design.colors.secondary);
    const [tr, tg, tb] = hexToRgb(design.colors.trail);

    // 弹道与开爆点（世界坐标投影到相机广告牌平面）。
    const burst = shellPosition(plan, { x: 0, z: 0 }, plan.fuseTime);
    const burstScreen = projectToBillboard(burst);
    const burstX = originX + burstScreen.u * scale;
    const burstY = groundY - burstScreen.v * scale;
    previewCtx.strokeStyle = 'rgba(246, 217, 141, 0.32)';
    previewCtx.setLineDash([3, 4]);
    previewCtx.beginPath();
    previewCtx.moveTo(originX, groundY);
    previewCtx.quadraticCurveTo(originX + burstScreen.u * scale * 0.4, groundY - burstScreen.v * scale * 1.18, burstX, burstY);
    previewCtx.stroke();
    previewCtx.setLineDash([]);
    previewCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    previewCtx.beginPath();
    previewCtx.arc(burstX, burstY, Math.max(4, report.radius * scale), 0, Math.PI * 2);
    previewCtx.stroke();

    if (previewBurstTime < 0) previewBurstTime = now;
    const elapsed = (now - previewBurstTime) / 1000;
    if (elapsed < plan.fuseTime) {
      const position = shellPosition(plan, { x: 0, z: 0 }, elapsed);
      const screen = projectToBillboard(position);
      const x = originX + screen.u * scale;
      const y = groundY - screen.v * scale;
      previewCtx.fillStyle = `rgb(${tr},${tg},${tb})`;
      previewCtx.beginPath();
      previewCtx.arc(x, y, 2.4, 0, Math.PI * 2);
      previewCtx.fill();
      previewCtx.globalAlpha = 0.35;
      previewCtx.strokeStyle = `rgb(${tr},${tg},${tb})`;
      previewCtx.beginPath();
      previewCtx.moveTo(originX, groundY);
      previewCtx.lineTo(x, y);
      previewCtx.stroke();
      previewCtx.globalAlpha = 1;
      return;
    }

    const burstAge = elapsed - plan.fuseTime;
    for (const seed of seeds) {
      const sample = sampleStar(seed, burstAge, burstAge);
      if (!sample.alive) continue;
      const point = projectToBillboard({ x: sample.x, y: sample.y, z: sample.z });
      const x = burstX + point.u * scale;
      const y = burstY - point.v * scale;
      if (x < -20 || x > width + 20 || y < -20 || y > height + 20) continue;
      const r = Math.round(pr + (sr - pr) * seed.colorMix);
      const g = Math.round(pg + (sg - pg) * seed.colorMix);
      const b = Math.round(pb + (sb - pb) * seed.colorMix);
      const alpha = sample.alpha;
      if (design.trail !== 'none' && burstAge > 0.12) {
        const tail = sampleStar(seed, Math.max(0, burstAge - 0.06), burstAge - 0.06);
        if (tail.alive) {
          const tailPoint = projectToBillboard({ x: tail.x, y: tail.y, z: tail.z });
          previewCtx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.45).toFixed(3)})`;
          previewCtx.lineWidth = design.trail === 'glitter' ? 1 : 1.4;
          previewCtx.beginPath();
          previewCtx.moveTo(burstX + tailPoint.u * scale, burstY - tailPoint.v * scale);
          previewCtx.lineTo(x, y);
          previewCtx.stroke();
        }
      }
      previewCtx.fillStyle = `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
      previewCtx.beginPath();
      previewCtx.arc(x, y, Math.max(0.8, sample.size * 1.25), 0, Math.PI * 2);
      previewCtx.fill();
    }
    if (burstAge > maxLife + 1.1) previewBurstTime = -1;
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
    const normalized = normalizeFireworkDesign(record.design);
    if (!normalized) {
      setStatus('这份烟花数据已损坏，无法载入', true);
      return;
    }
    editingId = record.id;
    design = normalized;
    nameInput.value = record.name;
    caliberInput.value = String(design.caliber);
    liftInput.value = String(design.liftCharge);
    heightInput.value = String(design.height);
    angleInput.value = String(design.launchAngle);
    breakInput.value = String(design.breakCharge);
    starsInput.value = String(design.starCount);
    starSizeInput.value = String(design.starSize);
    burnInput.value = String(design.burnTime);
    sparkleInput.value = String(design.sparkle);
    trailInput.value = design.trail;
    primaryInput.value = design.colors.primary;
    secondaryInput.value = design.colors.secondary;
    trailColorInput.value = design.colors.trail;
    if (design.pattern) {
      grid = emptyGrid();
      const bits = decodePatternCells(design.pattern);
      for (let i = 0; i < grid.length && i < bits.length; i += 1) grid[i] = bits[i]!;
    } else {
      grid = emptyGrid();
    }
    syncDesignFromInputs();
    renderShapeButtons();
    drawGrid();
    setStatus(`已载入《${record.name}》，修改后重新存入会再收 ${FIREWORK_SAVE_PRICE} 金币`);
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
  for (const input of [
    caliberInput, liftInput, heightInput, angleInput, breakInput, starsInput,
    starSizeInput, burnInput, sparkleInput, primaryInput, secondaryInput, trailColorInput,
  ]) {
    input.addEventListener('input', () => { syncDesignFromInputs(); drawGrid(); }, { signal: options.signal });
  }
  trailInput.addEventListener('change', () => { syncDesignFromInputs(); }, { signal: options.signal });
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
    if (isOpen()) return; // 重复打开会叠加预览 rAF 链
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
