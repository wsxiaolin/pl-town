import type { CityConfig } from './cityGovernanceClient';

// Personal construction no longer exists as a player action. The immutable
// `personalBlocks` catalog still describes the curated, pre-designed patches, so
// every placement it declares is now part of the default city and is rendered
// for all residents. Revegetation follows the layout the designers already
// reviewed instead of an arbitrary per-plot fallback.

export type DefaultDecoration = {
  plotId: string;
  decorationId: string;
  kind: CityConfig['decorations'][number]['kind'];
  x: number;
  z: number;
};

export function collectDefaultDecorations(config: CityConfig): DefaultDecoration[] {
  const plots = new Map(config.personalPlots.map((plot) => [plot.id, plot]));
  const kinds = new Map(config.decorations.map((decoration) => [decoration.id, decoration.kind]));
  const decorations: DefaultDecoration[] = [];
  for (const block of config.personalBlocks ?? []) {
    for (const placement of block.placements) {
      const plot = plots.get(placement.plotId);
      const kind = kinds.get(placement.decorationId);
      if (!plot || !kind) continue;
      decorations.push({ plotId: plot.id, decorationId: placement.decorationId, kind, x: plot.x, z: plot.z });
    }
  }
  return decorations;
}
