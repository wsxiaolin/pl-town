import type { CityConstructionConfig } from './data/cityConstructionConfig.js';
import { AREA_PLOTS, PERSONAL_AREAS } from './data/cityConstructionAreas.js';
import { isLegacyAreaPlotRelocation } from './cityAreaLayoutMigration.js';

/** Explicit additive reconciliation for the area catalog, used on startup and restore.
 * Existing purchased decoration geometry and prices retain their identities.
 * Building policy has its own reconciliation and may evolve independently.
 * city_operations is intentionally untouched: its fingerprints are permanent receipts.
 */
export function reconcileAreaCatalog(previous: CityConstructionConfig, next: CityConstructionConfig): void {
  // The presence of the field marks an area-aware catalog. Do not use the
  // current manifest IDs as the guard: removing one from the manifest must
  // still leave the migration checks active for persisted catalogs.
  const hasAreas = (catalog: CityConstructionConfig) => catalog.personalAreas !== undefined;
  const areaAware = hasAreas(previous) || hasAreas(next);
  const nextPlot = (id: string) => next.personalPlots.find((entry) => entry.id === id);
  const nextDecoration = (id: string) => next.decorations.find((entry) => entry.id === id);
  const nextArea = (id: string) => next.personalAreas?.find((entry) => entry.id === id);
  const plotLedgerUnchanged = (entry: CityConstructionConfig['personalPlots'][number]) => {
    const candidate = nextPlot(entry.id);
    return Boolean(candidate && ((candidate.x === entry.x && candidate.z === entry.z
      && entry.options.every((id) => candidate.options.includes(id))) || isLegacyAreaPlotRelocation(entry, candidate)));
  };
  const decorationLedgerUnchanged = (entry: CityConstructionConfig['decorations'][number]) => {
    const candidate = nextDecoration(entry.id);
    return Boolean(candidate && candidate.kind === entry.kind);
  };
  const areaLedgerUnchanged = (entry: NonNullable<CityConstructionConfig['personalAreas']>[number]) => {
    const candidate = nextArea(entry.id);
    return Boolean(candidate && JSON.stringify(candidate.plotIds) === JSON.stringify(entry.plotIds));
  };
  const plotAdditionAllowed = (entry: CityConstructionConfig['personalPlots'][number]) =>
    AREA_PLOTS.some((candidate) => candidate.id === entry.id && candidate.x === entry.x && candidate.z === entry.z
      && JSON.stringify(candidate.options) === JSON.stringify(entry.options));
  const areaAdditionAllowed = (entry: NonNullable<CityConstructionConfig['personalAreas']>[number]) =>
    PERSONAL_AREAS.some((candidate) => candidate.id === entry.id && JSON.stringify(candidate.plotIds) === JSON.stringify(entry.plotIds));
  const previousPlots = previous.personalPlots;
  const nextPlots = next.personalPlots;
  if (previousPlots.some((entry) => !plotLedgerUnchanged(entry))) {
    throw new Error('City area migration requires explicit reconciliation: personal plot ledger changed');
  }
  if (nextPlots.filter((entry) => !previousPlots.some((old) => old.id === entry.id)).some((entry) => !plotAdditionAllowed(entry))) {
    throw new Error('City area migration requires explicit reconciliation: personal plot addition is not in the area catalog');
  }
  if (previous.decorations.some((entry) => !decorationLedgerUnchanged(entry))) {
    throw new Error('City decorations migration requires explicit reconciliation: decoration kind changed');
  }
  if (!areaAware) return;
  const previousAreas = previous.personalAreas ?? [];
  const nextAreas = next.personalAreas ?? [];
  if (previousAreas.some((entry) => !areaLedgerUnchanged(entry))) {
    throw new Error('City area migration requires explicit reconciliation: personal area ledger changed');
  }
  if (nextAreas.filter((entry) => !previousAreas.some((old) => old.id === entry.id)).some((entry) => !areaAdditionAllowed(entry))) {
    throw new Error('City area migration requires explicit reconciliation: personal area addition is not in the area catalog');
  }
}
