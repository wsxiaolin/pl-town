import type * as THREE from 'three';
import type { StoryRepository } from '../../gameplay/stories/types';
import type { IceSanctumEnding } from '../../gameplay/content/stories/iceKing/iceKingContent';

export type IceSanctumCursor = THREE.Object3D & {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  visible: boolean;
};

export interface IceSanctumScenePort {
  root: THREE.Group;
  npcMesh: THREE.Object3D;
  npcHitMesh: THREE.Object3D;
  center: readonly [number, number];
  walkBounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  activate(cursor: IceSanctumCursor): void;
  deactivate(): void;
  npcWorldPosition(target?: THREE.Vector3): THREE.Vector3;
  interactionPosition(target?: THREE.Vector3): THREE.Vector3;
  exitPosition(target?: THREE.Vector3): THREE.Vector3;
  dispose(): void;
}

export interface IceSanctumPresentationPort {
  enter(playCinematic?: boolean): void;
  leave(): void;
  fadeOutTimeSkipBlackout(): void;
  returnThroughBlackout(onCovered: () => Promise<void>): Promise<void>;
  schedule(callback: () => void, delayMs: number): number;
  isCinematic(): boolean;
  dispose(): void;
}

export interface IceSanctumDialogModel {
  title?: string | null;
  role?: string | null;
  text: string;
  variant?: 'story' | 'blackout';
  options?: readonly { text: string; onPick: () => void | Promise<void> }[];
  presentation?: { typewriter: true; optionStaggerMs: number; selectionDelayMs: number };
}

export interface IceSanctumDialogPort {
  openStory(story: IceSanctumDialogModel): void;
  close(): void;
}

export interface IceSanctumStoryRepository extends StoryRepository {
  pendingReward(): { ending: IceSanctumEnding; claimSequence: number } | null;
  prepareReward(ending: IceSanctumEnding, claimSequence: number): void;
}

export interface IceSanctumProgressStore {
  hasCompleted(): boolean;
  openSession(): IceSanctumStoryRepository;
}
