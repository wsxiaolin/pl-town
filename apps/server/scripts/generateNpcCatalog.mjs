import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

// Generates apps/server/src/npcCatalog.ts from the authoritative client NPC
// data (apps/web/src/city/data). Run after editing NPC dialog/config so the
// server-side read-only mirror stays aligned. The generated file is committed.
const ROOT = new URL('../../../', import.meta.url);
const SERVER_SRC_DATA = new URL('apps/server/src/data/', ROOT);

function extractObjectValue(node) {
  if (!ts.isObjectLiteralExpression(node)) return null;
  const obj = {};
  for (const prop of node.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    obj[prop.name.getText()] = extractValue(prop.initializer);
  }
  return obj;
}
function extractValue(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(extractValue);
  if (ts.isObjectLiteralExpression(node)) return extractObjectValue(node);
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
      if (ts.isArrayLiteralExpression(decl.initializer)) {
        // Spread elements (e.g. ...COMMUNITY_NPCS) reference data parsed
        // separately, so only object literals are extracted here.
        result = decl.initializer.elements
          .filter((el) => ts.isObjectLiteralExpression(el))
          .map((el) => extractObjectValue(el));
      }
    }
  });
  return result ?? [];
}

function npcTypeOf(profile) {
  return profile.npcType ?? profile.type ?? 'resident';
}

function buildEntry(profile) {
  const dialogNodes = (profile.dialog ?? []).map((dialog, index) => ({ index, text: dialog.text }));
  const dialogEdges = [];
  (profile.dialog ?? []).forEach((dialog, nodeIndex) => {
    for (const [optionIndex, option] of (dialog.options ?? []).entries()) {
      dialogEdges.push({ from: [nodeIndex, optionIndex], to: option.next, label: option.text });
    }
  });
  return {
    id: profile.id,
    name: profile.name,
    role: profile.role,
    npcType: npcTypeOf(profile),
    core: Boolean(profile.core),
    behavior: profile.behavior,
    storyOnly: Boolean(profile.storyOnly),
    dialogNodes,
    dialogEdges,
  };
}

const community = readArray('apps/web/src/city/data/communityNpcs.ts', 'COMMUNITY_NPCS');
const core = readArray('apps/web/src/city/data/npcs.ts', 'NPC_PROFILES');
const entries = [...community, ...core].map(buildEntry);

const lines = [];
lines.push('// GENERATED FILE — do not edit by hand.');
lines.push('// Mirrors apps/web/src/city/data NPC config for read-only admin display.');
lines.push('// Regenerate with `npm run gen:npc-catalog` after changing NPC dialog/config.');
lines.push('');
lines.push("import type { NpcCatalogEntry } from '../npcCatalogTypes.js';");
lines.push('');
lines.push('export const NPC_CATALOG: readonly NpcCatalogEntry[] = Object.freeze(');
lines.push(JSON.stringify(entries, null, 2).replace(/"(?<key>[a-zA-Z_]+)":/g, '$<key>:'));
lines.push(');');
lines.push('');
lines.push('const NPC_BY_ID = new Map(NPC_CATALOG.map((npc) => [npc.id, npc]));');
lines.push('');
lines.push('export function getNpcCatalogEntry(id: string): NpcCatalogEntry | undefined {');
lines.push('  return NPC_BY_ID.get(id);');
lines.push('}');
lines.push('');

mkdirSync(SERVER_SRC_DATA, { recursive: true });
writeFileSync(new URL('npcCatalog.ts', SERVER_SRC_DATA), lines.join('\n'));
console.log(`npcCatalog.ts generated: ${entries.length} NPCs`);
