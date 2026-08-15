export type Achievement = { id: string; name: string; check: (stats: any) => boolean };
export type UnlockTier = { threshold: number; label: string; fn: () => void };

export function createProgressionController(options: {
  getStats: () => any;
  saveStats: (stats: any) => void;
  achievements: readonly Achievement[];
  unlockTiers: readonly UnlockTier[];
  unlockAchievement: (id: string) => void;
  showToast: (message: string) => void;
}) {
  function awardDirectAchievement(id: string, name: string): void {
    const stats = options.getStats();
    stats.achievements ??= [];
    if (stats.achievements.includes(id)) return;
    stats.achievements.push(id);
    options.saveStats(stats);
    options.unlockAchievement(id);
    options.showToast(`Achievement unlocked: ${name}`);
  }

  function checkAchievements(): void {
    const stats = options.getStats();
    stats.achievements ??= [];
    let changed = false;
    options.achievements.forEach((achievement) => {
      if (!stats.achievements.includes(achievement.id) && achievement.check(stats)) {
        stats.achievements.push(achievement.id);
        options.unlockAchievement(achievement.id);
        options.showToast(`Achievement unlocked: ${achievement.name}`);
        changed = true;
      }
    });
    if (changed) options.saveStats(stats);
  }

  function checkUnlocks(stats: any): void {
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

  return { awardDirectAchievement, checkAchievements, checkUnlocks };
}
