import { STAT_NAMES, type Stats } from "@jforge/melee/shared";

// Levels and experience in a run. What a level adds is in growth.ts.

export const MAX_LEVEL = 50;

/** A whole level between 1 and MAX_LEVEL. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(MAX_LEVEL, Math.max(1, Math.round(level)));
}

/**
 * Stats at a level: base plus growth for every level above the first,
 * rounded. Never below 0, and always at least 1 HP.
 */
export function statsAtLevel(base: Stats, growth: Stats, level: number): Stats {
  const steps = clampLevel(level) - 1;
  const stats = {} as Stats;
  for (const stat of STAT_NAMES) {
    const value = Math.max(0, Math.round(base[stat] + growth[stat] * steps));
    stats[stat] = stat === "maxHp" ? Math.max(1, value) : value;
  }
  return stats;
}

/** Experience needed to go from `level` to the next; 0 at the top level. */
export function xpToNext(level: number): number {
  const at = clampLevel(level);
  return at >= MAX_LEVEL ? 0 : 100 * at;
}

interface Progress {
  level: number;
  xp: number;
}

/**
 * Adds experience and levels up as often as it pays for. At the top level
 * experience no longer gathers.
 */
export function gainXp(progress: Progress, amount: number): Progress {
  let level = clampLevel(progress.level);
  let xp = Math.max(0, progress.xp) + Math.max(0, amount);
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
  }
  return { level, xp: level >= MAX_LEVEL ? 0 : xp };
}
