import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import ts from 'typescript';

// Generates apps/server/src/data/buildingCatalog.ts from the authoritative
// client building registry (apps/web/src/city/data/buildings/_registry.ts,
// which aggregates the per-building config files next to it). The server needs
// the id/label/x/z of every building to render the admin world-config map;
// keeping a generated mirror avoids hand-maintaining a second copy. Run after
// editing any building config file. The generated file is committed.
//
// The registry is loaded by bundling it with esbuild and importing the result,
// so any pure-data config layout keeps working without this script knowing
// about its file structure.
//
// `--check` regenerates in memory and compares against the committed file,
// exiting non-zero on drift so CI catches placement changes.
const ROOT = new URL('../../../', import.meta.url);
const REGISTRY_FILE = 'apps/web/src/city/data/buildings/_registry.ts';
const BUILDING_IDS_FILE = 'apps/server/src/progression.ts';
const OUTPUT_FILE = 'apps/server/src/data/buildingCatalog.ts';

function parse(file) {
  return ts.createSourceFile(file, readFileSync(new URL(file, ROOT), 'utf8'), ts.ScriptTarget.Latest, true);
}

function unwrap(node) {
  while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression?.(node))) {
    node = node.expression;
  }
  return node;
}

/** String array exported by a module (used for BUILDING_IDS in progression.ts). */
function readStringArray(file, varName) {
  let result = null;
  parse(file).forEachChild((stmt) => {
    if (result || !ts.isVariableStatement(stmt)) return;
    for (const decl of stmt.declarationList.declarations) {
      const initializer = unwrap(decl.initializer);
      if (decl.name.getText() !== varName || !initializer || !ts.isArrayLiteralExpression(initializer)) continue;
      result = initializer.elements.filter((el) => ts.isStringLiteral(el)).map((el) => el.text);
    }
  });
  if (!result) throw new Error(`Could not find ${varName} in ${file}`);
  return result;
}

/** Bundle the client registry to a temp ESM module and import BUILDING_DEFS. */
async function loadBuildingDefs() {
  const workDir = mkdtempSync(join(tmpdir(), 'building-catalog-'));
  const outfile = join(workDir, 'registry.mjs');
  try {
    await build({
      entryPoints: [fileURLToPath(new URL(REGISTRY_FILE, ROOT))],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile,
      logLevel: 'silent',
    });
    const registry = await import(pathToFileURL(outfile).href);
    if (!Array.isArray(registry.BUILDING_DEFS)) throw new Error('Registry did not export a BUILDING_DEFS array');
    return registry.BUILDING_DEFS;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

const defs = await loadBuildingDefs();
const byId = new Map(defs.filter((entry) => typeof entry.id === 'string').map((entry) => [entry.id, entry]));

// BUILDING_IDS and the client definitions must cover the same buildings so
// every named building has a server-side construction and access policy.
const managedIds = readStringArray(BUILDING_IDS_FILE, 'BUILDING_IDS');
const unmanagedIds = [...byId.keys()].filter((id) => !managedIds.includes(id));
if (unmanagedIds.length) throw new Error(`BUILDING_DEFS has buildings missing from BUILDING_IDS: ${unmanagedIds.join(', ')}`);
const entries = managedIds.map((id) => {
  const def = byId.get(id);
  if (!def) throw new Error(`BUILDING_IDS lists "${id}" but BUILDING_DEFS has no matching entry`);
  if (!Number.isFinite(def.x) || !Number.isFinite(def.z)) throw new Error(`Building "${id}" is missing finite x/z coordinates`);
  return {
    id,
    label: typeof def.label === 'string' ? def.label : id,
    num: typeof def.num === 'string' ? def.num : '',
    x: def.x,
    z: def.z,
    storyLocked: def.storyLocked === true,
  };
});

const lines = [];
lines.push('// GENERATED FILE — do not edit by hand.');
lines.push('// Mirrors apps/web/src/city/data BUILDING_DEFS for the admin world-config map.');
lines.push('// Regenerate with `npm run gen:building-catalog` after changing building placement.');
lines.push('');
lines.push('export type BuildingCatalogEntry = {');
lines.push('  id: string;');
lines.push('  label: string;');
lines.push('  num: string;');
lines.push('  x: number;');
lines.push('  z: number;');
lines.push('  storyLocked: boolean;');
lines.push('};');
lines.push('');
lines.push('export const BUILDING_CATALOG: readonly BuildingCatalogEntry[] = Object.freeze(');
lines.push(JSON.stringify(entries, null, 2).replace(/"(?<key>[a-zA-Z_]+)":/g, '$<key>:'));
lines.push(');');
lines.push('');
const output = lines.join('\n');

if (process.argv.includes('--check')) {
  const committed = readFileSync(new URL(OUTPUT_FILE, ROOT), 'utf8');
  if (committed !== output) {
    console.error('buildingCatalog.ts is out of date. Run `npm run gen:building-catalog` and commit the result.');
    process.exit(1);
  }
  console.log(`buildingCatalog.ts is up to date: ${entries.length} buildings`);
} else {
  mkdirSync(new URL('apps/server/src/data/', ROOT), { recursive: true });
  writeFileSync(new URL(OUTPUT_FILE, ROOT), output);
  console.log(`buildingCatalog.ts generated: ${entries.length} buildings`);
}
