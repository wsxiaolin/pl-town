// Re-export of the generated building mirror catalog so callers import from a
// stable module path. The data itself lives in ./data/buildingCatalog.ts
// (exempt from the source-size limit because it is generated config) and is
// produced by `npm run gen:building-catalog`.
export { BUILDING_CATALOG, getBuildingCatalogEntry } from './data/buildingCatalog.js';
export type { BuildingCatalogEntry } from './data/buildingCatalog.js';
