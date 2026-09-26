import type Database from 'better-sqlite3';
import type { CityConstructionConfig } from './data/cityConstructionConfig.js';

// Standing buildings from the 2026-09-19.1 / 2026-09-25.areas.1 policy,
// including photostudio, which the old client rendered outside its server catalog.
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

// Only pre-ledger personal unlocks from this historical catalog are converted
// to collective completion. Future projects need their own explicit migration.
export const LEGACY_UNLOCK_PRESERVATION_BUILDINGS = Object.freeze([
  'catcafe', 'academy', 'shrine', 'beacon', 'television_tower', 'fried_chicken_shop',
  'tradingpost', 'guildhall', 'conservatory', 'arena', 'school_north', 'teahouse',
  'teahouse_outer', 'writingclub', 'senate', 'musichall', 'banana_palace', 'qipai_hall',
  'wushi_restaurant', 'tavern',
]);

// Read-only reconciliation runs inside initializeCityGovernance's caller-owned
// transaction, so this snapshot and the subsequent migration writes are atomic.
export function reconcileInitialBuildings(db: Database.Database, config: CityConstructionConfig): {
  preserved: ReadonlySet<string>;
  previousConfig: CityConstructionConfig | undefined;
} {
  const meta = db.prepare('SELECT config_version FROM city_meta WHERE id = 1').get() as { config_version: string } | undefined;
  if (meta?.config_version === config.version) return { preserved: new Set(), previousConfig: undefined };
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
  // This one-time exception is fixed to photostudio, which the client rendered
  // before the server catalog included it. Eligibility comes from the stored
  // config and absent project row, not a version allowlist or future catalog IDs.
  const hadPhotoStudioProject = previousConfig?.projects.some((project) => project.buildingId === 'photostudio') === true;
  const photoStudioProject = config.projects.find((project) => project.buildingId === 'photostudio');
  if (previousConfig && !hadPhotoStudioProject && photoStudioProject
    && !db.prepare('SELECT 1 FROM city_projects WHERE id = ?').get(photoStudioProject.id)) {
    preserved.add('photostudio');
  }
  // Admin access overrides are not construction receipts. They never widen
  // preservation, and schema 5 backups need no world_config table here.
  // A missing ledger can also mean an empty town; only existing residents set
  // previousInitial above and qualify for historical unlock preservation.
  if (!meta && previousInitial.length > 0) {
    const hasUnlock = db.prepare('SELECT 1 FROM player_building_unlocks WHERE building_id = ? LIMIT 1');
    for (const id of LEGACY_UNLOCK_PRESERVATION_BUILDINGS) {
      if (hasUnlock.get(id)) preserved.add(id);
    }
  }
  for (const id of preserved) {
    if (!config.projects.some((project) => project.buildingId === id)) {
      throw new Error('City initialBuiltBuildingIds migration requires explicit reconciliation');
    }
  }
  return { preserved, previousConfig };
}
