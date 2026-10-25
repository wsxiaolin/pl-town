import type * as THREE from 'three';
import type { BuildingContentQuery, BuildingPlotSpec } from './data/buildings/_types';

export type BuildingDefinition = {
  id: string;
  num: string;
  label?: string;
  x: number;
  z: number;
  shape: string;
  icon: string;
  isStats?: boolean;
  disabled?: boolean;
  facade?: string;
  storyLocked?: boolean;
  contentQuery?: BuildingContentQuery;
  interactionRadius?: number;
  decorationClearance?: number;
  hasPlot?: boolean;
  featureIds?: readonly string[];
  plot?: BuildingPlotSpec;
  /** 整体体量缩放（缺省 1）。builder 的几何尺寸是硬编码常量，年份群岛需要
   *  更大体量减少疏离感时，按此系数统一放大 group；主城不设即行为不变。
   *  缩放以建筑自身中心为基准，不改变 x/z 落位与 baseY。 */
  scale?: number;
  /** 地基绝对 Y（主城恒 0/缺省；年份镇建筑 = 岛台面高度，T6）。入场动画与
   *  buildingSceneController 以此为落位终点，缺省 0 行为不变（回归安全）。 */
  baseY?: number;
};

export type BuildingEntity = BuildingDefinition & {
  group: THREE.Group;
  body?: THREE.Mesh;
  bodyMat?: THREE.MeshStandardMaterial;
  glowMat?: THREE.MeshStandardMaterial;
  labelEl?: HTMLElement | null;
  labelY?: number;
  /** Builders with real 3D facades (window frames, doors, awnings) set this to
   *  skip the flat facade-decal pass, which would clip through their details. */
  skipFacadeDecal?: boolean;
};

export type ResidenceEntity = {
  id: string;
  label: string;
  group: THREE.Group;
  body?: THREE.Mesh;
  labelEl?: HTMLElement | null;
  styleId?: number;
};
