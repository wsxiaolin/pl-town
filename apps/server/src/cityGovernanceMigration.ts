import type Database from 'better-sqlite3';
import type { CityConstructionConfig } from './data/cityConstructionConfig.js';

// The initial-building policy shipped before version 2026-09-25.pending.1.
// This frozen list is only for backups that predate the city config ledger.
// Do not derive it from today's catalog: future buildings must not be gifted.
export const LEGACY_INITIAL_BUILDINGS = Object.freeze([
  'activity', 'bulletin', 'techhalf', 'blackhole', 'laws',
  'library', 'litreview', 'news', 'mutualaid', 'screen',
  'elevator', 'residentid', 'stats', 'knowledgebaseE', 'newsstand',
  'community', 'research', 'commons', 'lab', 'culturehall',
  'mall_south', 'school_east', 'mall_west', 'kingice', 'knowledgebaseD',
  'community_outer', 'commons_outer', 'lab_outer', 'writingclub_outer', 'archive',
  'records', 'guesthouse', 'film_city', 'academy_library', 'photostudio',
]);

export function reconcileInitialBuildings(db: Database.Database, config: CityConstructionConfig): ReadonlySet<string> {
  const meta = db.prepare('SELECT config_version FROM city_meta WHERE id = 1').get() as { config_version: string } | undefined;
  if (meta?.config_version === config.version) return new Set();
  let previousInitial: readonly string[] = [];
  let previousConfig: CityConstructionConfig | undefined;
  if (meta) {
    const row = db.prepare('SELECT config_json FROM city_configs WHERE version = ?').get(meta.config_version) as { config_json: string } | undefined;
    if (!row) throw new Error('Missing persisted city config');
    previousConfig = JSON.parse(row.config_json) as CityConstructionConfig;
    previousInitial = previousConfig.initialBuiltBuildingIds;
  } else if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    // An established pre-governance town retains its standing core buildings.
    // Empty databases intentionally receive only the new initial policy.
    previousInitial = LEGACY_INITIAL_BUILDINGS;
  }
  const preserved = new Set(previousInitial.filter((id) => !config.initialBuiltBuildingIds.includes(id)));
  // Some released ledgers predate the photo studio project even though the
  // client already rendered it. Derive that compatibility case from the
  // persisted config so future config versions cannot be forgotten here.
  const hadPhotoStudioProject = previousConfig?.projects.some((project) => project.buildingId === 'photostudio') === true;
  const hasPhotoStudioProject = config.projects.some((project) => project.buildingId === 'photostudio');
  if (previousConfig && !hadPhotoStudioProject && hasPhotoStudioProject
    && !db.prepare("SELECT 1 FROM city_projects WHERE id = 'build-photostudio'").get()) {
    preserved.add('photostudio');
  }
  // Previously global-open buildings without a construction ledger row were
  // standing before this policy. Existing pending projects still need funding.
  // Offline restores can read schema 5 backups from before world_config existed.
  const hasWorldConfig = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'world_config'").get();
  const overrides = hasWorldConfig
    ? db.prepare("SELECT value_json FROM world_config WHERE key = 'buildings'").get() as { value_json: string } | undefined
    : undefined;
  // A pre-ledger world override describes the old standing city. Once a
  // versioned city config exists, an override may refer to a building added
  // later and must never turn that future project into a gifted building.
  const preLedgerTown = !meta && previousInitial.length > 0;
  if (overrides && preLedgerTown) {
    const states = JSON.parse(overrides.value_json) as Record<string, unknown>;
    for (const project of config.projects) {
      if (project.buildingId && states[project.buildingId] === 'open'
        && previousInitial.includes(project.buildingId)
        && !db.prepare('SELECT 1 FROM city_projects WHERE id = ?').get(project.id)) preserved.add(project.buildingId);
    }
  }
  for (const id of preserved) {
    if (!config.projects.some((project) => project.buildingId === id)) {
      throw new Error('City initialBuiltBuildingIds migration requires explicit reconciliation');
    }
  }
  return preserved;
}
