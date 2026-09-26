import { decorateCity, decorateCityArea, getPendingCityAreaOperation, refreshCityGovernanceSession, type CityConfig, type CityState, type CityMutationResult } from '../../city/cityGovernanceClient';
import { actionButton, card, money, trackPendingActionFocus } from './cityGovernanceDom';

type Draft = { decorationId: string; pending: boolean };
type AreaDraft = Draft & { quantityText: string };
const areaDrafts = new Map<string, AreaDraft>();
const plotDrafts = new Map<string, Draft>();

export function clearCityConstructionDrafts(): void { areaDrafts.clear(); plotDrafts.clear(); }

function decorationSelect(name: string, config: CityConfig, ids: string[]): HTMLSelectElement {
  const select = document.createElement('select');
  select.setAttribute('aria-label', `${name}装饰类型`);
  for (const id of ids) {
    const decoration = config.decorations.find((entry) => entry.id === id);
    if (!decoration) continue;
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${decoration.name} · ${money(decoration.cost)} / 处`;
    select.append(option);
  }
  return select;
}

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : '建设失败，请重试'; }

type ConstructionFeedback = {
  rerender: () => void;
  reportError: (message: string) => void;
  reportNotice: (message: string) => void;
  focusAction: (dataKey: 'cityArea' | 'plotId', id: string) => void;
};

async function submitConstruction(
  draft: Draft, dataKey: 'cityArea' | 'plotId', id: string,
  mutation: () => Promise<CityMutationResult>, feedback: ConstructionFeedback,
): Promise<void> {
  const session = refreshCityGovernanceSession();
  const drafts = dataKey === 'cityArea' ? areaDrafts : plotDrafts;
  const isCurrentDraft = () => drafts.get(id) === draft && refreshCityGovernanceSession() === session;
  if (!isCurrentDraft()) return;
  if (draft.pending) return;
  draft.pending = true;
  const focus = trackPendingActionFocus(`${dataKey === 'cityArea' ? 'area-build' : 'decorate'}:${id}`);
  feedback.reportError('');
  feedback.rerender();
  let failed = false;
  try {
    const result = await mutation();
    if (!result || !isCurrentDraft()) return;
    feedback.reportNotice(result.replayed ? '上一笔已成功，未重复扣费。' : '');
  } catch (error) {
    if (!isCurrentDraft()) return;
    failed = true;
    feedback.reportError(errorMessage(error));
  }
  finally {
    focus.dispose();
    if (isCurrentDraft()) {
      draft.pending = false;
      const restoreSuccessFocus = focus.shouldRestore();
      feedback.rerender();
      if (failed || restoreSuccessFocus) feedback.focusAction(dataKey, id);
    }
  }
}

export function renderCityPersonalAreas(
  list: HTMLElement, config: CityConfig, state: CityState, feedback: ConstructionFeedback,
): void {
  const occupied = new Map(state.decorations.map((entry) => [entry.plotId, entry]));
  const plotsById = new Map(config.personalPlots.map((plot) => [plot.id, plot]));
  const grouped = new Set((config.personalAreas ?? []).flatMap((area) => area.plotIds));
  for (const area of config.personalAreas ?? []) {
    const plots = area.plotIds.flatMap((id) => { const plot = plotsById.get(id); return plot ? [plot] : []; });
    const item = card(area.name, `在同一区域连续建设，已建 ${plots.filter((plot) => occupied.has(plot.id)).length} / ${plots.length} 处。`);
    item.dataset.cityArea = area.id;
    const ids = config.decorations.filter((decoration) => plots.some((plot) => plot.options.includes(decoration.id))).map((decoration) => decoration.id);
    const draft = areaDrafts.get(area.id) ?? { decorationId: ids[0] ?? '', quantityText: String(Math.min(20, plots.length)), pending: false };
    areaDrafts.set(area.id, draft);
    const pendingReceipt = getPendingCityAreaOperation(area.id);
    if (pendingReceipt) {
      // A lost response may already have charged the original request. Keep
      // the visible draft aligned with that immutable receipt before retry.
      draft.decorationId = pendingReceipt.decorationId;
      draft.quantityText = String(pendingReceipt.quantity);
    }
    if (!pendingReceipt && !ids.includes(draft.decorationId)) draft.decorationId = ids[0] ?? '';
    const select = decorationSelect(area.name, config, ids);
    select.dataset.focusKey = `area-decoration:${area.id}`;
    select.value = draft.decorationId;
    const quantity = document.createElement('input');
    quantity.dataset.focusKey = `area-quantity:${area.id}`;
    quantity.type = 'number'; quantity.min = '1'; quantity.step = '1'; quantity.value = draft.quantityText;
    quantity.setAttribute('aria-label', `${area.name}建设数量`);
    const total = document.createElement('p');
    total.dataset.cityAreaTotal = 'true';
    total.setAttribute('aria-live', 'polite');
    const preview = document.createElement('div');
    preview.className = 'city-area-preview';
    preview.setAttribute('aria-label', `${area.name}地块预览`);
    const columns = [...new Set(plots.map((plot) => plot.x))].sort((a, b) => a - b);
    const rows = [...new Set(plots.map((plot) => plot.z))].sort((a, b) => a - b);
    preview.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
    const action = actionButton('批量建设', undefined, false, `area-build:${area.id}`);
    const update = () => {
      const count = Number(draft.quantityText);
      const available = plots.filter((plot) => !occupied.has(plot.id) && plot.options.includes(draft.decorationId));
      quantity.max = String(Math.max(available.length, pendingReceipt?.quantity ?? 0));
      const valid = Number.isSafeInteger(count) && count >= 1 && count <= available.length;
      const selected = new Set(valid ? available.slice(0, count).map((plot) => plot.id) : []);
      const cost = config.decorations.find((entry) => entry.id === draft.decorationId)?.cost ?? 0;
      total.textContent = pendingReceipt ? `上次 ${count} 处建设结果待确认，在当前页面及登录会话内重试不会重复扣费。`
        : valid ? `将建设 ${count} 处 · 总价 ${money(cost * count)} · 可用 ${available.length} 处`
        : available.length ? `请输入 1–${available.length} 之间的整数` : '该区域已无可用地块';
      // A city broadcast can already show the committed plots as occupied.
      // Confirming its pending receipt remains safe even with no capacity left.
      action.disabled = draft.pending || (!pendingReceipt && !valid);
      select.disabled = quantity.disabled = draft.pending || Boolean(pendingReceipt);
      preview.replaceChildren();
      for (const plot of plots) {
        const cell = document.createElement('span');
        const built = occupied.has(plot.id);
        cell.className = `city-area-cell${built ? ' occupied' : selected.has(plot.id) ? ' selected' : ''}`;
        cell.style.gridColumn = String(columns.indexOf(plot.x) + 1);
        cell.style.gridRow = String(rows.indexOf(plot.z) + 1);
        cell.textContent = built ? '已建' : selected.has(plot.id) ? '待建' : '空地';
        cell.title = `${plot.name}：${cell.textContent}`;
        preview.append(cell);
      }
    };
    select.addEventListener('change', () => { draft.decorationId = select.value; update(); });
    quantity.addEventListener('input', () => { draft.quantityText = quantity.value; update(); });
    action.addEventListener('click', () => {
      if (action.disabled) return;
      void submitConstruction(draft, 'cityArea', area.id,
        () => decorateCityArea(area.id, draft.decorationId, Number(draft.quantityText)), feedback);
    });
    update();
    item.append(preview, select, quantity, total, action);
    list.append(item);
  }
  // The original individually purchased plots keep their IDs and remain usable.
  for (const plot of config.personalPlots.filter((entry) => !grouped.has(entry.id))) {
    const item = card(plot.name, '选择一项装饰，建设完成后全城居民都能看到。');
    item.dataset.plotId = plot.id;
    const built = occupied.get(plot.id);
    if (built) {
      const owner = document.createElement('p');
      owner.textContent = `已由 ${built.ownerNickname} 建设：${config.decorations.find((entry) => entry.id === built.decorationId)?.name ?? built.decorationId}`;
      item.append(owner);
    } else {
      const select = decorationSelect(plot.name, config, plot.options);
      select.dataset.focusKey = `decoration:${plot.id}`;
      const action = actionButton('建设', undefined, false, `decorate:${plot.id}`);
      const draft = plotDrafts.get(plot.id) ?? { decorationId: select.value, pending: false };
      plotDrafts.set(plot.id, draft);
      if (!plot.options.includes(draft.decorationId)) draft.decorationId = select.value;
      select.value = draft.decorationId;
      select.disabled = action.disabled = draft.pending;
      select.addEventListener('change', () => { draft.decorationId = select.value; });
      action.addEventListener('click', () => {
        void submitConstruction(draft, 'plotId', plot.id, () => decorateCity(plot.id, draft.decorationId), feedback);
      });
      item.append(select, action);
    }
    list.append(item);
  }
}
