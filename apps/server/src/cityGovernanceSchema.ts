import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { CITY_CONSTRUCTION_CONFIG as config } from './data/cityConstructionConfig.js';
import { BUILDING_CATALOG } from './buildingCatalog.js';

// Called inside both the schema migration and the in-process restore transaction.
export function initializeCityGovernance(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS city_configs (version TEXT PRIMARY KEY, config_json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS city_meta (id INTEGER PRIMARY KEY CHECK(id = 1), revision INTEGER NOT NULL CHECK(revision >= 0), config_version TEXT NOT NULL REFERENCES city_configs(version));
    CREATE TABLE IF NOT EXISTS city_projects (id TEXT PRIMARY KEY, definition_json TEXT NOT NULL, funded INTEGER NOT NULL DEFAULT 0 CHECK(funded >= 0), built INTEGER NOT NULL DEFAULT 0 CHECK(built IN (0,1)));
    CREATE TABLE IF NOT EXISTS city_decorations (plot_id TEXT PRIMARY KEY, decoration_id TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id), owner_nickname TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS city_operations (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, request_id TEXT NOT NULL, fingerprint TEXT NOT NULL, accepted_amount INTEGER NOT NULL CHECK(accepted_amount > 0), revision INTEGER NOT NULL, PRIMARY KEY(user_id, request_id));
  `);
  if (!(db.prepare('PRAGMA table_info(city_meta)').all() as Array<{ name: string }>).some((column) => column.name === 'epoch')) {
    db.exec("ALTER TABLE city_meta ADD COLUMN epoch TEXT NOT NULL DEFAULT ''");
  }
  const json = JSON.stringify(config);
  const unique = (values: string[]) => new Set(values).size === values.length;
  const validId = (value: string) => /^[A-Za-z0-9._:-]{1,100}$/.test(value);
  if (config.schemaVersion !== 1 || !config.version || !unique(config.personalPlots.map((entry) => entry.id))
    || !unique(config.decorations.map((entry) => entry.id)) || !unique(config.initialBuiltBuildingIds)
    || !unique(config.projects.flatMap((entry) => entry.buildingId ? [entry.buildingId] : []))) throw new Error('Invalid city config identifiers');
  if (![...config.projects, ...config.personalPlots, ...config.decorations].every((entry) => validId(entry.id))) throw new Error('Invalid city config identifiers');
  const kinds = new Set(['oak', 'pine', 'cherry', 'lamp', 'bench', 'flowers']);
  if (config.decorations.some((entry) => !kinds.has(entry.kind))) throw new Error('Invalid decoration kind');
  if (config.decorations.some((entry) => !Number.isSafeInteger(entry.cost) || entry.cost <= 0)) throw new Error('Invalid decoration cost');
  const buildingIds = new Set(BUILDING_CATALOG.map((entry) => entry.id));
  if (config.initialBuiltBuildingIds.some((id) => !buildingIds.has(id))) throw new Error('Unknown initial building');
  for (const id of buildingIds) {
    if (!config.initialBuiltBuildingIds.includes(id) && !config.projects.some((project) => project.buildingId === id)) throw new Error(`Missing city building policy: ${id}`);
  }
  const validPoint = (x: number, z: number) => Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) <= 42 && Math.abs(z) <= 42;
  const clearPoint = (x: number, z: number, halfWidth = 0.5, halfDepth = halfWidth) => validPoint(x, z)
    && Math.abs(x) + halfWidth <= 42 && Math.abs(z) + halfDepth <= 42
    && Math.abs(x) > halfWidth + 1.2 && Math.abs(z) > halfDepth + 1.2
    && BUILDING_CATALOG.every((building) => Math.abs(x - building.x) > halfWidth + 4 || Math.abs(z - building.z) > halfDepth + 4);
  const saved = db.prepare('SELECT config_json FROM city_configs WHERE version = ?').get(config.version) as { config_json: string } | undefined;
  if (saved && saved.config_json !== json) throw new Error('City config changed without a version bump');
  const ids = new Set<string>();
  for (const project of config.projects) {
    if (ids.has(project.id) || !Number.isSafeInteger(project.cost) || project.cost <= 0) throw new Error('Invalid city project');
    ids.add(project.id);
    if (!['building', 'road', 'trees', 'lights', 'decoration'].includes(project.kind)) throw new Error('Invalid project kind');
    if (project.kind !== 'building' && project.buildingId) throw new Error('Only building projects may target buildings');
    if (project.kind === 'building' && (!project.buildingId || !buildingIds.has(project.buildingId))) throw new Error('Unknown project building');
    if (project.kind === 'road' && !project.road) throw new Error('Missing city road');
    if (['trees', 'lights', 'decoration'].includes(project.kind) && !project.placements?.length) throw new Error('Missing city placements');
    if (project.placements?.some((point) => !kinds.has(point.kind))) throw new Error('Invalid placement kind');
    if (project.placements?.some((point) => !clearPoint(point.x, point.z))) throw new Error('City placement overlaps a building or main road');
    if (project.road && (!(project.road.width > 0 && project.road.depth > 0) || !clearPoint(project.road.x, project.road.z, project.road.width / 2, project.road.depth / 2))) throw new Error('Invalid city road');
    if (project.buildingId && config.initialBuiltBuildingIds.includes(project.buildingId)) throw new Error('Construction overlaps core buildings');
    const old = db.prepare('SELECT definition_json FROM city_projects WHERE id = ?').get(project.id) as { definition_json: string } | undefined;
    // Paid projects keep immutable targets and geometry across deployments.
    if (old && old.definition_json !== JSON.stringify(project)) throw new Error(`City project changed: ${project.id}; use a new project ID`);
    db.prepare('INSERT OR IGNORE INTO city_projects (id, definition_json) VALUES (?, ?)').run(project.id, JSON.stringify(project));
    const progress = db.prepare('SELECT funded, built FROM city_projects WHERE id = ?').get(project.id) as { funded: number; built: number };
    if (!Number.isSafeInteger(progress.funded) || progress.funded > project.cost || Boolean(progress.built) !== (progress.funded === project.cost)) throw new Error(`Invalid city project progress: ${project.id}`);
  }
  const existing = db.prepare('SELECT id FROM city_projects').all() as Array<{ id: string }>;
  if (existing.some((entry) => !ids.has(entry.id))) throw new Error('City projects cannot be removed');
  for (const plot of config.personalPlots) {
    if (!clearPoint(plot.x, plot.z)) throw new Error('City plot overlaps a building or main road');
    if (!plot.options.length || plot.options.some((id) => !config.decorations.some((decoration) => decoration.id === id))) throw new Error('Invalid city plot options');
  }
  const decorations = db.prepare('SELECT plot_id, decoration_id FROM city_decorations').all() as Array<{ plot_id: string; decoration_id: string }>;
  if (decorations.some((entry) => !config.personalPlots.find((plot) => plot.id === entry.plot_id)?.options.includes(entry.decoration_id))) throw new Error('Persisted city decoration does not match config');
  const meta = db.prepare('SELECT config_version FROM city_meta WHERE id = 1').get() as { config_version: string } | undefined;
  if (meta && meta.config_version !== config.version) {
    const previous = db.prepare('SELECT config_json FROM city_configs WHERE version = ?').get(meta.config_version) as { config_json: string } | undefined;
    if (!previous) throw new Error('Missing persisted city config');
    const old = JSON.parse(previous.config_json) as typeof config;
    for (const key of ['personalPlots', 'decorations', 'initialBuiltBuildingIds'] as const) {
      if (JSON.stringify(old[key]) !== JSON.stringify(config[key])) throw new Error(`City ${key} migration requires explicit reconciliation`);
    }
  }
  db.prepare('INSERT OR IGNORE INTO city_configs VALUES (?, ?)').run(config.version, json);
  db.prepare('INSERT OR IGNORE INTO city_meta (id, revision, config_version, epoch) VALUES (1, 0, ?, ?)').run(config.version, randomUUID());
  db.prepare("UPDATE city_meta SET epoch = ? WHERE epoch = ''").run(randomUUID());
  db.prepare('UPDATE city_meta SET config_version = ?, revision = revision + 1 WHERE id = 1 AND config_version <> ?').run(config.version, config.version);
}
