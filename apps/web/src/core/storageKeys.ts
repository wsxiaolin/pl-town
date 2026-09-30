// Leaf storage-key constants — no imports, no browser globals. Keys that
// multiple modules need live here so a pure module (e.g. gpuCapability's
// classifier) never has to import a module with side effects (createRenderer
// reads matchMedia at module scope) just for a constant.
export const RENDER_SETTINGS_KEY = 'minicityRenderSettings';
