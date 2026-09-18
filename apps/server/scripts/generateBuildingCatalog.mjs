import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

// Generates apps/server/src/buildingCatalog.ts from the authoritative client
// building config (apps/web/src/city/data/buildings.ts). The server needs the
// id/label/x/z of every building to render the admin world-config map; keeping
// a generated mirror avoids hand-maintaining a second copy. Run after editing
// BUILDING_DEFS. The generated file is committed.
const ROOT = new URL('../../../', import.meta.url);
const SERVER_SRC_DATA = new URL('apps/server/src/data/', ROOT);
const SOURCE_FILE = 'apps/web/src/city/data/buildings.ts';

function extractValue(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  return undefined;
}

function readArray(file, varName) {
  const src = readFileSync(new URL(file, ROOT), 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  let result = null;
  sf.forEachChild((stmt) => {
    if (result || !ts.isVariableStatement(stmt)) return;
    for (const decl of stmt.declarationList.declarations) {
      if (decl.name.getText() !== varName) continue;
      if (!ts.isArrayLiteralExpression(decl.initializer)) continue;
      result = decl.initializer.elements.filter((el) => ts.isObjectLiteralExpression(el)).map((el) => {
        const entry = {};
        for (const prop of el.properties) {
          if (!ts.isPropertyAssignment(prop)) continue;
          const key = prop.name.getText();
          if (['id', 'label', 'num', 'x', 'z', 'storyLocked'].includes(key)) entry[key] = extractValue(prop.initializer);
        }
        return entry;
      });
    }
  });
  return result ?? [];
}

const entries = readArray(SOURCE_FILE, 'BUILDING_DEFS')
  .filter((entry) => typeof entry.id === 'string')
  .map((entry) => ({
    id: entry.id,
    label: entry.label ?? entry.id,
    num: entry.num ?? '',
    x: Number.isFinite(entry.x) ? entry.x : 0,
    z: Number.isFinite(entry.z) ? entry.z : 0,
    storyLocked: entry.storyLocked === true,
  }));

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
lines.push('const BUILDING_BY_ID = new Map(BUILDING_CATALOG.map((building) => [building.id, building]));');
lines.push('');
lines.push('export function getBuildingCatalogEntry(id: string): BuildingCatalogEntry | undefined {');
lines.push('  return BUILDING_BY_ID.get(id);');
lines.push('}');
lines.push('');

mkdirSync(SERVER_SRC_DATA, { recursive: true });
writeFileSync(new URL('buildingCatalog.ts', SERVER_SRC_DATA), lines.join('\n'));
console.log(`buildingCatalog.ts generated: ${entries.length} buildings`);
