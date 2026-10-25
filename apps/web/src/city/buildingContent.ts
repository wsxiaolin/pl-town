/** Shared dialogue/content shapes used by city data, domain assembly, and UI adapters. */
export interface LegacyDialogueOption {
  text: string;
  next: number | null;
  onPick?: () => void;
  action?: string;
  nextByVisitor?: {
    includes: readonly string[];
    maxLength?: number;
    next: number;
  };
}

export interface LegacyDialogueNode {
  speaker?: string;
  text: string;
  options: readonly LegacyDialogueOption[];
}

export interface BuildingContentLike {
  name: string;
  slogan: string;
  dialog: readonly string[];
  dialogTree?: readonly LegacyDialogueNode[];
  dialogAvatar?: readonly [number, number];
  /** Enables the detail-panel action from the building dialog. */
  readBody?: boolean;
  /** Overrides the default detail-panel action label. */
  readBodyLabel?: string;
  /** Optional memorial-note interaction kind. */
  noteKind?: string;
}
