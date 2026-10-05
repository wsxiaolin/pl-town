import type { LegacyStats } from './legacyStats';

export type UnlockTier = { threshold: number; label: string; fn: () => void };

export function createProgressionController(options: {
  getStats: () => LegacyStats;
  saveStats: (stats: LegacyStats) => void;
  unlockTiers: readonly UnlockTier[];
  showToast: (message: string) => void;
}) {
  function checkUnlocks(stats: LegacyStats): void {
    const current = stats.unlockLevel ?? 0;
    for (let index = current; index < options.unlockTiers.length; index += 1) {
      const tier = options.unlockTiers[index];
      if (!tier || stats.interactions < tier.threshold) break;
      tier.fn();
      stats.unlockLevel = index + 1;
      options.saveStats(stats);
      options.showToast(tier.label);
    }
  }

  return { checkUnlocks };
}
