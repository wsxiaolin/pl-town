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
};

export type BuildingEntity = BuildingDefinition & {
  group: THREE.Group;
  body?: THREE.Mesh;
  bodyMat?: THREE.MeshStandardMaterial;
  glowMat?: THREE.MeshStandardMaterial;
  labelEl?: HTMLElement | null;
  labelY?: number;
};

export type ResidenceEntity = {
  id: string;
  label: string;
  group: THREE.Group;
  body?: THREE.Mesh;
  labelEl?: HTMLElement | null;
  styleId?: number;
};
