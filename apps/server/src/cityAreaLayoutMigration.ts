import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import type { CityConstructionConfig } from './data/cityConstructionConfig.js';
import { AREA_PLOTS, AREA_PROJECTS } from './data/cityConstructionAreas.js';
import { LEGACY_AREA_PLOTS, LEGACY_AREA_PROJECTS, LEGACY_PERSONAL_AREAS } from './data/legacyCityConstructionAreas.js';

type Plot = CityConstructionConfig['personalPlots'][number];
const samePlot = (left: Plot, right: Plot) => left.id === right.id && left.x === right.x && left.z === right.z
  && JSON.stringify(left.options) === JSON.stringify(right.options);
const plotLedger = ({ id, x, z, options }: Plot) => ({ id, x, z, options });
// Freeze this migration's destination, not the evolving live catalog. The hash
// covers ordered plot id/x/z/options plus the two complete project definitions.
// A later layout requires another explicit migration; it must not silently
// reuse this exception. A mismatch disables only this historical exception.
const destinationHash = '11874a7057f4ec2ab26b4641f879832b296b8df0d7f43f8d982a5a9b4368b84e';
const destinationMatches = createHash('sha256')
  .update(JSON.stringify({ plots: AREA_PLOTS.map(plotLedger), projects: AREA_PROJECTS })).digest('hex') === destinationHash;
const correctedPlots = new Map(destinationMatches ? AREA_PLOTS.map((plot) => [plot.id, JSON.stringify(plotLedger(plot))]) : []);
const correctedProjects = new Map(destinationMatches ? AREA_PROJECTS.map((project) => [project.id, JSON.stringify(project)]) : []);

// Only the frozen, original 88-slot layout can be relocated. Ordinary edits,
// including moving an already corrected slot again, still fail reconciliation.
export function isLegacyAreaPlotRelocation(previous: Plot, next: Plot): boolean {
  const legacy = LEGACY_AREA_PLOTS.find((plot) => plot.id === previous.id);
  return Boolean(legacy && samePlot(previous, legacy)
    && JSON.stringify(plotLedger(next)) === correctedPlots.get(previous.id));
}

// Called within initializeCityGovernance's existing startup/restore transaction.
// Change geometry only: progress, ownership, votes and payment receipts survive.
export function reconcileLegacyAreaProjectLayout(db: Database.Database, next: CityConstructionConfig): void {
  const saved = db.prepare(`SELECT c.config_json FROM city_meta m
    JOIN city_configs c ON c.version = m.config_version WHERE m.id = 1 AND m.config_version <> ?`)
    .get(next.version) as { config_json: string } | undefined;
  if (!saved) return;
  const previous = JSON.parse(saved.config_json) as CityConstructionConfig;
  if (!LEGACY_PERSONAL_AREAS.every((area) => previous.personalAreas?.some((entry) => entry.id === area.id
    && JSON.stringify(entry.plotIds) === JSON.stringify(area.plotIds)))) return;
  if (!LEGACY_AREA_PLOTS.every((plot) => previous.personalPlots.some((entry) => samePlot(entry, plot)))) return;
  for (const legacy of LEGACY_AREA_PROJECTS) {
    const corrected = correctedProjects.get(legacy.id);
    const target = next.projects.find((project) => project.id === legacy.id);
    const historical = previous.projects.find((project) => project.id === legacy.id);
    if (!corrected || JSON.stringify(target) !== corrected
      || JSON.stringify(historical) !== JSON.stringify(legacy)) continue;
    // The saved config and the project row must agree; corruption is never
    // repaired implicitly. The normal project immutability check rejects it.
    db.prepare('UPDATE city_projects SET definition_json = ? WHERE id = ? AND definition_json = ?')
      .run(corrected, legacy.id, JSON.stringify(legacy));
  }
}
