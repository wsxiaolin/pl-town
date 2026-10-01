import { decorateCityBlock, getCityConfig, getPendingCityBlockOperation, refreshCityGovernanceSession, type CityConfig, type CityMutationResult, type CityPersonalBlock, type CityState } from '../../city/cityGovernanceClient';
import { actionButton, card, money, trackPendingActionFocus } from './cityGovernanceDom';

// Block purchases have no drafts: one card is one immutable purchase of a
// pre-designed patch. Only the in-flight marker survives a rerender.
const pendingBlocks = new Map<string, symbol>();

export function clearCityConstructionDrafts(): void { pendingBlocks.clear(); }

function errorMessage(error: unknown): string { return error instanceof Error ? error.message : '建设失败，请重试'; }

type ConstructionFeedback = {
  rerender: () => void;
  reportError: (message: string, actionKey: string) => void;
  reportNotice: (message: string) => void;
  focusAction: (dataKey: 'cityBlock', id: string) => void;
};

async function submitConstruction(
  blockId: string, blockName: string,
  mutation: () => Promise<CityMutationResult>, feedback: ConstructionFeedback,
): Promise<void> {
  const session = refreshCityGovernanceSession();
  const action = Symbol(blockId);
  const isCurrent = () => pendingBlocks.get(blockId) === action && refreshCityGovernanceSession() === session;
  if (pendingBlocks.has(blockId)) return;
  const targetPrefix = `「${blockName}」`;
  pendingBlocks.set(blockId, action);
  const focus = trackPendingActionFocus(`block-build:${blockId}`);
  const actionKey = `cityBlock:${blockId}`;
  feedback.reportError('', actionKey);
  feedback.rerender();
  let failed = false;
  try {
    const result = await mutation();
    if (!result || !isCurrent()) return;
    feedback.reportNotice(result.replayed ? '上一笔已成功，未重复扣费。' : '');
  } catch (error) {
    if (!isCurrent()) return;
    failed = true;
    const message = errorMessage(error);
    feedback.reportError(message.startsWith(targetPrefix) ? message : `${targetPrefix}${message}`, actionKey);
  } finally {
    focus.dispose();
    if (isCurrent()) {
      pendingBlocks.delete(blockId);
      const restoreActionFocus = focus.shouldRestore(failed);
      feedback.rerender();
      if (restoreActionFocus) feedback.focusAction('cityBlock', blockId);
    }
  }
}

function compositionSummary(block: CityPersonalBlock, config: CityConfig): string {
  const counts = new Map<string, number>();
  for (const placement of block.placements) counts.set(placement.decorationId, (counts.get(placement.decorationId) ?? 0) + 1);
  const parts: string[] = [];
  for (const [decorationId, count] of counts) {
    const decoration = config.decorations.find((entry) => entry.id === decorationId);
    parts.push(`${decoration?.name ?? decorationId} ×${count}`);
  }
  return parts.join(' · ');
}

export function renderCityPersonalBlocks(
  list: HTMLElement, config: CityConfig, state: CityState, feedback: ConstructionFeedback,
): void {
  const occupied = new Map(state.decorations.map((entry) => [entry.plotId, entry]));
  const plotsById = new Map(config.personalPlots.map((plot) => [plot.id, plot]));
  const blocks = config.personalBlocks ?? [];
  const knownAreas = new Set((config.personalAreas ?? []).map((area) => area.id));
  // Area blocks keep their manifest order; gate gardens and yards close the list.
  const ordered = [
    ...blocks.filter((block) => block.areaId !== null && knownAreas.has(block.areaId)),
    ...blocks.filter((block) => block.areaId === null || !knownAreas.has(block.areaId)),
  ];
  for (const block of ordered) {
    const plots = block.placements.flatMap((placement) => { const plot = plotsById.get(placement.plotId); return plot ? [plot] : []; });
    const item = card(block.name, `${block.description}一次性建成 ${block.placements.length} 处装饰，全城居民都能看到。`);
    item.dataset.cityBlock = block.id;
    const preview = document.createElement('div');
    preview.className = 'city-area-preview';
    preview.setAttribute('aria-label', `${block.name}地块预览`);
    const columns = [...new Set(plots.map((plot) => plot.x))].sort((a, b) => a - b);
    const rows = [...new Set(plots.map((plot) => plot.z))].sort((a, b) => a - b);
    preview.style.gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;
    preview.style.width = `min(100%, ${columns.length * 3}rem)`;
    const builtPlacements = block.placements
      .flatMap((placement) => { const entry = occupied.get(placement.plotId); return entry ? [{ ...entry, placement }] : []; });
    const complete = builtPlacements.length === block.placements.length;
    const singleOwner = complete && new Set(builtPlacements.map((entry) => entry.ownerId)).size === 1;
    const owners = [...new Set(builtPlacements.map((entry) => entry.ownerNickname))];
    const pendingReceipt = getPendingCityBlockOperation(block.id);
    const inFlight = pendingBlocks.has(block.id);
    // A retained receipt must stay clickable: the retry replays the saved
    // request and never charges twice. Only occupancy or an in-flight request
    // locks the card.
    const action = actionButton(pendingReceipt ? '确认投建结果' : '投建这片', undefined, !!(builtPlacements.length && !pendingReceipt) || inFlight, `block-build:${block.id}`);
    const total = document.createElement('p');
    total.dataset.cityBlockTotal = 'true';
    total.setAttribute('aria-live', 'polite');
    if (pendingReceipt) {
      total.textContent = '上次投建结果待确认，在当前页面及登录会话内重试不会重复扣费。';
    } else if (complete) {
      total.textContent = singleOwner
        ? `已由 ${owners[0]} 投建 · ${compositionSummary(block, config)}`
        : `已建成 · ${compositionSummary(block, config)}`;
    } else if (builtPlacements.length) {
      total.textContent = `部分地块已有装饰（${owners.join('、')}），暂不能整块投建。`;
    } else {
      total.textContent = `整片投建 ${block.placements.length} 处 · ${compositionSummary(block, config)} · ${money(block.cost)}`;
    }
    action.addEventListener('click', () => {
      if (action.disabled) return;
      void submitConstruction(block.id, block.name, () => decorateCityBlock(block.id), feedback);
    });
    for (const placement of block.placements) {
      const plot = plotsById.get(placement.plotId);
      const cell = document.createElement('span');
      const built = occupied.get(placement.plotId);
      const decorationName = config.decorations.find((entry) => entry.id === (built?.decorationId ?? placement.decorationId))?.name ?? '';
      cell.className = `city-area-cell${built ? ' occupied' : ''}`;
      if (plot) {
        cell.style.gridColumn = String(columns.indexOf(plot.x) + 1);
        cell.style.gridRow = String(rows.indexOf(plot.z) + 1);
      }
      cell.textContent = built ? '已建' : decorationName;
      cell.title = `${plot?.name ?? placement.plotId}：${built ? `已建 · ${decorationName}` : `待建 · ${decorationName}`}`;
      preview.append(cell);
    }
    item.append(preview, total, action);
    list.append(item);
  }
  if (!ordered.length) list.append(card('小区块列表暂时为空', '请稍后刷新查看可投建的小区块。'));
}
