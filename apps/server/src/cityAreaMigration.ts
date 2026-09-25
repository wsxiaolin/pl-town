import type { CityConstructionConfig } from './data/cityConstructionConfig.js';
import { AREA_PLOTS, PERSONAL_AREAS } from './data/cityConstructionAreas.js';

/** Explicit additive reconciliation for the area catalog, used on startup and restore.
 * Existing purchased decoration geometry and prices retain their identities.
 * Building policy has its own reconciliation and may evolve independently.
 * city_operations is intentionally untouched: its fingerprints are permanent receipts.
 */
export function reconcileAreaCatalog(previous: CityConstructionConfig, next: CityConstructionConfig): void {
  const hasAreas = (catalog: CityConstructionConfig) => catalog.personalAreas?.some((area) => PERSONAL_AREAS.some((entry) => entry.id === area.id));
  if (!hasAreas(previous) && !hasAreas(next)) return;
  const unchanged = <T extends { id: string }>(before: T[], after: T[]) => before.every((entry) =>
    JSON.stringify(entry) === JSON.stringify(after.find((candidate) => candidate.id === entry.id)));
  const onlyAdds = <T extends { id: string }>(before: T[], after: T[], allowed: T[]) =>
    after.filter((entry) => !before.some((old) => old.id === entry.id)).every((entry) =>
      JSON.stringify(entry) === JSON.stringify(allowed.find((candidate) => candidate.id === entry.id)));
  if (!unchanged(previous.personalPlots, next.personalPlots)
    || !unchanged(previous.decorations, next.decorations)
    || !onlyAdds(previous.personalPlots, next.personalPlots, AREA_PLOTS)
    || !unchanged(previous.personalAreas ?? [], next.personalAreas ?? [])
    || !onlyAdds(previous.personalAreas ?? [], next.personalAreas ?? [], PERSONAL_AREAS)) {
    throw new Error('City area migration requires explicit reconciliation: existing ledger definitions changed');
  }
}
