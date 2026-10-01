// 遗留入口：地块默认规格已并入 buildings/_shapeDefaults.ts，
// 单栋建筑可在自己的配置文件里用 `plot` 字段覆盖。仅为旧 import 路径保留。
export type { BuildingPlotSpec } from './buildings/_types';
export { SHAPE_PLOTS as BUILDING_PLOT_MAP } from './buildings/_shapeDefaults';
