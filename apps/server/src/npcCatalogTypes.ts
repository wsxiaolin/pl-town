// Read-only types for the server-side NPC mirror catalog. The concrete
// catalog data is generated into npcCatalog.ts from the authoritative client
// config in apps/web/src/city/data.

export type NpcCatalogType = 'resident' | 'story';

export interface NpcDialogNode {
  /** Index into the NPC's dialog array. */
  index: number;
  text: string;
}

export interface NpcDialogEdge {
  /** [dialogNodeIndex, optionIndex] the edge originates from. */
  from: [number, number];
  /** Target dialog node index, or null when the option ends the dialogue. */
  to: number | null;
  label: string;
}

export interface NpcCatalogEntry {
  id: string;
  name: string;
  role: string;
  npcType: NpcCatalogType;
  core: boolean;
  behavior: string;
  storyOnly: boolean;
  dialogNodes: NpcDialogNode[];
  dialogEdges: NpcDialogEdge[];
}
