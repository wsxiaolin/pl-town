// City construction config golden snapshot.
//
// The off-site restore path refuses to boot when the persisted city_configs
// row for the current version no longer matches the config JSON — the
// "City config changed without a version bump" guard in
// cityGovernanceSchema.ts. That invariant can only hold if every content
// change ships with a version bump, but nothing used to compare the two at
// review time, so a bad row could reach production and crash-loop the
// deploy. This test pins the serialized config: changing the content
// requires bumping CITY_CONSTRUCTION_CONFIG.version and regenerating the
// golden snapshot in one go.
//
//   node tests/city-config-snapshot.mjs --update
//
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const goldenPath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'city-construction-config.golden.json');
const { CITY_CONSTRUCTION_CONFIG } = await import('../dist/data/cityConstructionConfig.js');
const current = JSON.stringify(CITY_CONSTRUCTION_CONFIG);

if (process.argv.includes('--update')) {
  mkdirSync(dirname(goldenPath), { recursive: true });
  writeFileSync(goldenPath, `${current}\n`, 'utf8');
  console.log(`city-config-snapshot: wrote golden for version ${CITY_CONSTRUCTION_CONFIG.version}`);
  process.exit(0);
}

const golden = readFileSync(goldenPath, 'utf8').trim();
assert.ok(golden, 'city-config-snapshot: golden snapshot is missing; run `node tests/city-config-snapshot.mjs --update`');
const goldenVersion = JSON.parse(golden).version;
if (goldenVersion !== CITY_CONSTRUCTION_CONFIG.version) {
  assert.fail(
    `city-config-snapshot: config version is ${CITY_CONSTRUCTION_CONFIG.version} but the golden snapshot pins ${goldenVersion}; `
    + 'regenerate it with `node tests/city-config-snapshot.mjs --update`',
  );
}
assert.equal(
  current,
  golden,
  'city-config-snapshot: city construction config content changed without a version bump — '
    + 'bump CITY_CONSTRUCTION_CONFIG.version and regenerate the golden snapshot '
    + '(`node tests/city-config-snapshot.mjs --update`)',
);
console.log(`city-config-snapshot: config matches golden (version ${CITY_CONSTRUCTION_CONFIG.version})`);
