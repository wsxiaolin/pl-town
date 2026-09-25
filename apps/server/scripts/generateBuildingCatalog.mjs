import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

// Generates apps/server/src/buildingCatalog.ts from the authoritative client
// building config (apps/web/src/city/data/buildings.ts). The server needs the
// id/label/x/z of every building to render the admin world-config map; keeping
// a generated mirror avoids hand-maintaining a second copy. Run after editing
// BUILDING_DEFS. The generated file is committed.
//
// `--check` regenerates in memory and compares against the committed file,
// exiting non-zero on drift so CI catches placement changes.
const ROOT = new URL('../../../', import.meta.url);
const SOURCE_FILE = 'apps/web/src/city/data/buildings.ts';
const CONSTANTS_FILE = 'apps/web/src/gameplay/content/stories/iceKing/iceKingContent.ts';
const BUILDING_IDS_FILE = 'apps/server/src/progression.ts';
const OUTPUT_FILE = 'apps/server/src/data/buildingCatalog.ts';
const CATALOG_KEYS = ['id', 'label', 'num', 'x', 'z', 'storyLocked'];

function parse(file) {
  return ts.createSourceFile(file, readFileSync(new URL(file, ROOT), 'utf8'), ts.ScriptTarget.Latest, true);
}

/** String constants exported by a module, so identifier ids like ICE_KING_BUILDING_ID resolve. */
function readStringConstants(file) {
  const constants = new Map();
  parse(file).forEachChild((stmt) => {
    if (!ts.isVariableStatement(stmt)) return;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer || !ts.isStringLiteral(decl.initializer)) continue;
      constants.set(decl.name.text, decl.initializer.text);
    }
  });
  return constants;
}

function extractValue(node, constants) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isIdentifier(node)) return constants.get(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const operand = extractValue(node.operand, constants);
    return typeof operand === 'number' ? -operand : undefined;
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function unwrap(node) {
  while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression?.(node))) {
    node = node.expression;
  }
  return node;
}

function readArray(file, varName, constants) {
  let result = null;
  parse(file).forEachChild((stmt) => {
    if (result || !ts.isVariableStatement(stmt)) return;
    for (const decl of stmt.declarationList.declarations) {
      const initializer = unwrap(decl.initializer);
      if (decl.name.getText() !== varName || !initializer || !ts.isArrayLiteralExpression(initializer)) continue;
      result = initializer.elements.filter((el) => ts.isObjectLiteralExpression(el)).map((el) => {
        const entry = {};
        for (const prop of el.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const key = prop.name.getText();
          if (CATALOG_KEYS.includes(key)) entry[key] = extractValue(prop.initializer, constants);
        }
        return entry;
      });
    }
  });
  if (!result) throw new Error(`Could not find ${varName} in ${file}`);
  return result;
}

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

const constants = readStringConstants(CONSTANTS_FILE);
const defs = readArray(SOURCE_FILE, 'BUILDING_DEFS', constants);
const byId = new Map(defs.filter((entry) => typeof entry.id === 'string').map((entry) => [entry.id, entry]));

// Only buildings the server actually manages (BUILDING_PRICES) belong in the
// catalog; accepted overrides must always have an effect.
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
