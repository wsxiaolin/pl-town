export const NPC_TYPES = ['resident', 'story'] as const;

export type NpcType = (typeof NPC_TYPES)[number];

export interface NpcTypeLike {
  npcType?: NpcType;
  type?: NpcType;
}

export function getNpcType(profile: NpcTypeLike): NpcType {
  return profile.npcType ?? profile.type ?? 'resident';
}

import type { CommunityNpcProfile } from './communityNpcs';

export interface NpcProfile extends CommunityNpcProfile {
  npcType?: NpcType;
  type?: NpcType;
  storyOnly?: boolean;
  hiddenHours?: [number, number] | null;
  spawnArea?: [number, number, number];
  guaranteedSpawn?: boolean;
}
