import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CITY_CONSTRUCTION_CONFIG as config } from '../dist/data/cityConstructionConfig.js';
import { AREA_PLOTS, AREA_PROJECTS, PERSONAL_BLOCKS } from '../dist/data/cityConstructionAreas.js';
import { AREA_CLEARANCE, validateCityAreaPlacement } from '../dist/cityAreaPlacement.js';
import { LEGACY_AREA_PLOTS, LEGACY_AREA_PROJECTS, LEGACY_PERSONAL_AREAS } from '../dist/data/legacyCityConstructionAreas.js';
import { reconcileAreaCatalog } from '../dist/cityAreaMigration.js';
import { isLegacyAreaPlotRelocation } from '../dist/cityAreaLayoutMigration.js';

// Keep the isolated browser fixture tied to the production ledger coordinates.
const fixture = JSON.parse(readFileSync(new URL('../../web/tests/fixtures/city-area-plots.json', import.meta.url), 'utf8'));
assert.deepEqual(fixture, AREA_PLOTS);
// Personal construction is sold as blocks: every plot joins exactly one
// pre-designed block whose price is the sum of its decoration prices and
// whose decorations are allowed on their plots within the right area.
assert.ok(PERSONAL_BLOCKS.length >= 20);
assert.ok(new Set(PERSONAL_BLOCKS.map((block) => block.id)).size === PERSONAL_BLOCKS.length);
const plotAreaId = new Map(config.personalAreas.flatMap((area) => area.plotIds.map((id) => [id, area.id])));
const coveredPlots = new Set();
for (const block of PERSONAL_BLOCKS) {
  assert.ok(block.placements.length >= 2, 'blocks must cover at least two plots');
  assert.equal((plotAreaId.get(block.placements[0].plotId) ?? null), block.areaId);
  for (const placement of block.placements) {
    assert.equal((plotAreaId.get(placement.plotId) ?? null), block.areaId, `${block.id} must stay within ${block.areaId}`);
    assert.ok(!coveredPlots.has(placement.plotId), `${block.id} overlaps another block`);
    coveredPlots.add(placement.plotId);
    const plot = config.personalPlots.find((entry) => entry.id === placement.plotId);
    const decoration = config.decorations.find((entry) => entry.id === placement.decorationId);
    assert.ok(plot && decoration && plot.options.includes(placement.decorationId), `${block.id} places ${placement.decorationId} on ${placement.plotId}`);
  }
  assert.equal(block.cost, block.placements.reduce((sum, placement) => sum + config.decorations.find((entry) => entry.id === placement.decorationId).cost, 0), `${block.id} price must be the decoration sum`);
}
assert.ok(config.personalPlots.every((plot) => coveredPlots.has(plot.id)), 'every personal plot must be sellable through a block');
assert.ok(config.personalAreas.every((area) => area.plotIds.every((id) => PERSONAL_BLOCKS.some((block) => block.areaId === area.id && block.placements.some((placement) => placement.plotId === id)))), 'every area plot must be in a block of that area');
const renamedBlocks = structuredClone(config);
renamedBlocks.personalBlocks[0].name += '（新名称）';
renamedBlocks.personalBlocks[0].description += '（新描述）';
assert.doesNotThrow(() => reconcileAreaCatalog(config, renamedBlocks));
const retunedBlocks = structuredClone(config);
retunedBlocks.personalBlocks[0].cost += 1;
assert.throws(() => reconcileAreaCatalog(config, retunedBlocks), /personal block ledger changed/);
const blockless = structuredClone(config);
delete blockless.personalBlocks;
assert.doesNotThrow(() => reconcileAreaCatalog(blockless, config));
const foreignBlocks = structuredClone(config);
foreignBlocks.personalBlocks = [...foreignBlocks.personalBlocks, { id: 'foreign-block', name: '外来小区块', areaId: null, description: 'x', cost: 420, placements: [{ plotId: 'north-garden-1', decorationId: 'cherry' }, { plotId: 'north-garden-2', decorationId: 'oak' }] }];
assert.throws(() => reconcileAreaCatalog(config, foreignBlocks), /personal block addition/);
assert.doesNotThrow(() => validateCityAreaPlacement(config));
const originalLayout = structuredClone(config);
originalLayout.personalAreas = structuredClone(LEGACY_PERSONAL_AREAS);
originalLayout.personalPlots = originalLayout.personalPlots.map((plot) => structuredClone(LEGACY_AREA_PLOTS.find((old) => old.id === plot.id) ?? plot));
originalLayout.projects = originalLayout.projects.map((project) => structuredClone(LEGACY_AREA_PROJECTS.find((old) => old.id === project.id) ?? project));
assert.doesNotThrow(() => reconcileAreaCatalog(originalLayout, config));
const unknownLayout = structuredClone(config);
unknownLayout.personalPlots.find((plot) => plot.id === AREA_PLOTS[0].id).x += 0.1;
assert.throws(() => reconcileAreaCatalog(originalLayout, unknownLayout), /personal plot ledger changed/);
assert.throws(() => reconcileAreaCatalog(config, unknownLayout), /personal plot ledger changed/);
// The one-time destination is captured by value: changing the live catalog
// cannot make this migration authorize an additional move.
// AREA_PLOTS shares its objects with config.personalPlots. Always restore in
// finally so later assertions cannot observe this intentionally invalid fixture.
const originalX = AREA_PLOTS[0].x;
AREA_PLOTS[0].x += 0.1;
try {
  assert.equal(isLegacyAreaPlotRelocation(LEGACY_AREA_PLOTS[0], AREA_PLOTS[0]), false);
  // A fresh migration module seeing a future edited catalog must also reject
  // it rather than bless that catalog as this migration's new destination.
  const futureMigration = await import('../dist/cityAreaLayoutMigration.js?unknown-layout');
  assert.equal(futureMigration.isLegacyAreaPlotRelocation(LEGACY_AREA_PLOTS[0], AREA_PLOTS[0]), false);
}
finally { AREA_PLOTS[0].x = originalX; }
assert.equal(AREA_PROJECTS.length, LEGACY_AREA_PROJECTS.length);
for (const [x, z] of [[-3, -38.5], [41, -18], [-38.5, 11], [33, -33], [42, -41], [30, -40]]) {
  const invalid = structuredClone(config);
  Object.assign(invalid.personalPlots.find((plot) => plot.id === AREA_PLOTS[0].id), { x, z });
  assert.throws(() => validateCityAreaPlacement(invalid), /reserved scenery/);
}

// These constraints belong to scene geometry, so verify the mirror against
// the actual sources rather than relying on a second unchecked fixture.
const source = (path) => readFileSync(new URL(`../../web/src/${path}`, import.meta.url), 'utf8');
const city = source('city/data/cityConfig.ts');
const roads = city.match(/ROAD_COORDS\s*=\s*Object\.freeze\((\[[\s\S]*?\])\)/);
assert.ok(roads, 'ROAD_COORDS must remain readable by the placement contract');
assert.deepEqual(JSON.parse(roads[1]), AREA_CLEARANCE.roadCoords);
assert.equal(Number(city.match(/MAIN_ROAD_WIDTH\s*=\s*([\d.]+)/)?.[1]), 2.4);
assert.equal(Number(city.match(/CITY_LIMIT\s*=\s*([\d.]+)/)?.[1]), AREA_CLEARANCE.cityLimit);
assert.match(source('rendering/createCitySurfaces.ts'), /addRing\(RING_ROAD_RADII\.inner,\s*RING_ROAD_RADII\.outer,\s*ringMat/);
assert.match(city, /RING_ROAD_RADII\s*=\s*Object\.freeze\(\{\s*inner:\s*37,\s*outer:\s*39\s*\}\)/);
assert.match(source('rendering/worldDecorations.ts').replace(/\s/g, ''), /Math\.abs\(position\)===6\|\|Math\.abs\(position\)===12\?1\.5:1\.0/);
const beach = source('rendering/westBeach.ts');
assert.match(beach, /shorelineX\(z\)\s*\+\s*10/);
// The coast wobble now lives beside coastlineX in cityConfig so the visible
// shore and the waterline-clearance budget share one amplitude source.
assert.match(city, /Math\.sin\(z\s*\*\s*0\.19\)\s*\*\s*COAST_WOBBLE_A\s*\+\s*Math\.sin\(z\s*\*\s*0\.47\s*\+\s*1\.4\)\s*\*\s*COAST_WOBBLE_B/);
assert.match(city, /COAST_WOBBLE_A\s*=\s*0\.85/);
assert.match(city, /COAST_WOBBLE_B\s*=\s*0\.35/);
const coastline = Number(city.match(/coastlineX:\s*(-?[\d.]+)/)?.[1]);
assert.ok(Math.abs(coastline + 0.85 + 0.35 + 10 - AREA_CLEARANCE.beachLandEdge) < 1e-6);
