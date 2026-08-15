// Re-export of the generated NPC mirror catalog so callers import from a
// stable module path. The data itself lives in ./data/npcCatalog.ts (exempt
// from the source-size limit because it is generated config) and is produced
// by `npm run gen:npc-catalog`.
export { NPC_CATALOG, getNpcCatalogEntry } from './data/npcCatalog.js';
