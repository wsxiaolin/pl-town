// 兼容入口：建筑数据已拆分为 ./buildings/ 下的单文件配置（一栋建筑一个文件）。
// 此文件仅转发旧导出，保持既有 import 路径不变；不要在这里新增数据。
export {
  BUILDING_API_QUERIES,
  BUILDING_CONTENT,
  BUILDING_DEFS,
} from './buildings/_registry';
