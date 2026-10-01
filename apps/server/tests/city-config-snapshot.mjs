// City construction config golden snapshot.
//
// The off-site restore path refuses to boot when the persisted city_configs
// row for the current version no longer matches the config JSON — the
// "City config changed without a version bump" guard in
// cityGovernanceSchema.ts. The serialized config embeds building catalog
// labels (#181's tavern relabel drifted it on main), so any content change
// must ship with a version bump. This test pins the serialized config and
// fails at review time when the content drifts without one.
//
//   node tests/city-config-snapshot.mjs --update
//
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const goldenPath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'city-construction-config.golden.json');
const { CITY_CONSTRUCTION_CONFIG: config } = await import('../dist/data/cityConstructionConfig.js');
const canonical = JSON.stringify(config);

function projectDrift(currentConfig, goldenConfig) {
  const notes = [];
  const currentProjects = new Map(currentConfig.projects.map((project) => [project.id, project]));
  const goldenProjects = new Map(goldenConfig.projects.map((project) => [project.id, project]));
  for (const id of currentProjects.keys()) if (!goldenProjects.has(id)) notes.push(`project added: ${id}`);
  for (const id of goldenProjects.keys()) if (!currentProjects.has(id)) notes.push(`project removed: ${id}`);
  for (const [id, project] of currentProjects) {
    const goldenProject = goldenProjects.get(id);
    if (!goldenProject) continue;
    for (const field of new Set([...Object.keys(project), ...Object.keys(goldenProject)])) {
      if (JSON.stringify(project[field]) !== JSON.stringify(goldenProject[field])) {
        notes.push(`project ${id}: ${field} changed (${JSON.stringify(goldenProject[field])} -> ${JSON.stringify(project[field])})`);
      }
    }
  }
  for (const [label, currentIds, goldenIds] of [
    ['decoration', (currentConfig.decorations ?? []).map((entry) => entry.id), (goldenConfig.decorations ?? []).map((entry) => entry.id)],
    ['plot', (currentConfig.personalPlots ?? []).map((entry) => entry.id), (goldenConfig.personalPlots ?? []).map((entry) => entry.id)],
    ['initialBuiltBuildingIds', currentConfig.initialBuiltBuildingIds ?? [], goldenConfig.initialBuiltBuildingIds ?? []],
  ]) {
    const currentSet = new Set(currentIds);
    const goldenSet = new Set(goldenIds);
    for (const id of currentSet) if (!goldenSet.has(id)) notes.push(`${label} added: ${id}`);
    for (const id of goldenSet) if (!currentSet.has(id)) notes.push(`${label} removed: ${id}`);
  }
  return notes;
}

if (process.argv.includes('--update')) {
  if (process.env.CI) {
    console.error('city-config-snapshot: --update is for local regeneration only; commit the regenerated golden deliberately.');
    process.exit(1);
  }
  // Regenerating alone must not be able to re-arm the guard: a content change
  // under the SAME version is exactly what the off-site restore path rejects,
  // so --update refuses to record it. The golden may only change content
  // together with a version bump.
  if (existsSync(goldenPath)) {
    const previous = JSON.parse(readFileSync(goldenPath, 'utf8'));
    if (previous.version === config.version && JSON.stringify(previous) !== canonical) {
      console.error(
        `city-config-snapshot: content changed but the version is still ${config.version} — `
          + 'bump CITY_CONSTRUCTION_CONFIG.version first, then rerun `node tests/city-config-snapshot.mjs --update`. '
          + 'A same-version content change is what the production restore guard ("City config changed without a version bump") rejects.',
      );
      process.exit(1);
    }
  }
  mkdirSync(dirname(goldenPath), { recursive: true });
  writeFileSync(goldenPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  console.log(`city-config-snapshot: wrote golden for version ${config.version}`);
  process.exit(0);
}

if (!existsSync(goldenPath)) {
  assert.fail(`city-config-snapshot: golden snapshot not found at ${goldenPath}; run \`node tests/city-config-snapshot.mjs --update\``);
}
const golden = readFileSync(goldenPath, 'utf8').trim();
assert.ok(golden, 'city-config-snapshot: golden snapshot is missing; run `node tests/city-config-snapshot.mjs --update`');
const goldenConfig = JSON.parse(golden);
if (goldenConfig.version !== config.version) {
  assert.fail(
    `city-config-snapshot: config version is ${config.version} but the golden snapshot pins ${goldenConfig.version}; `
    + 'bump CITY_CONSTRUCTION_CONFIG.version and regenerate with `node tests/city-config-snapshot.mjs --update`',
  );
}
if (canonical !== JSON.stringify(goldenConfig)) {
  const notes = projectDrift(config, goldenConfig);
  assert.fail(
    'city-config-snapshot: city construction config content changed without a version bump — '
      + 'bump CITY_CONSTRUCTION_CONFIG.version and regenerate the golden snapshot '
      + '(`node tests/city-config-snapshot.mjs --update`). Drift:\n'
      + (notes.length ? notes.map((note) => `  - ${note}`).join('\n') : '  (field-level diff unavailable; compare the golden manually)'),
  );
}
console.log(`city-config-snapshot: config matches golden (version ${config.version})`);
