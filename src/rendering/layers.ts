export const SURFACE_Y = Object.freeze({
  base: 0,
  district: 0.018,
  plaza: 0.036,
  landscape: 0.036,
  buildingPlot: 0.036,
  road: 0.065,
  roadSurface: 0.10,
  roadMarking: 0.11,
  water: 0.105,
});

export const RENDER_ORDER = Object.freeze({
  base: 0,
  district: 1,
  plaza: 2,
  landscape: 3,
  buildingPlot: 4,
  road: 5,
  roadMarking: 6,
  transparentSurface: 7,
  overlay: 10,
});
