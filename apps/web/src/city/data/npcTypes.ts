export const NPC_TYPES = ['resident', 'story'] as const;

export type NpcType = (typeof NPC_TYPES)[number];

export interface NpcTypeLike {
  npcType?: string;
  type?: string;
}

export function getNpcType(profile: NpcTypeLike): NpcType {
  return (profile.npcType ?? profile.type ?? 'resident') as NpcType;
}
