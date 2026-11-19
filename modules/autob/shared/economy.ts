// Gold and levels, after TFT: a fixed income each round, interest on gold
// saved, a bonus for streaks, and experience bought with gold. The level
// is how many units may stand on the board.

/** Gold every round pays. */
export const BASE_INCOME = 5;
/** One gold of interest per this much held... */
export const INTEREST_STEP = 10;
/** ...up to this much. */
export const MAX_INTEREST = 5;
/** Extra gold for a round won. */
export const WIN_GOLD = 1;
export const REROLL_COST = 2;
/** Buying experience: this much gold for XP_PER_BUY. */
export const XP_COST = 4;
export const XP_PER_BUY = 4;
/** Experience every round gives. */
export const XP_PER_ROUND = 2;
export const START_LEVEL = 1;
export const MAX_LEVEL = 10;
/** Experience from each level to the next: XP_TO_LEVEL[level - 1]. */
export const XP_TO_LEVEL = [2, 2, 6, 10, 20, 36, 48, 76, 84] as const;

/** Gold for a streak of wins or losses (negative): 2-3, 4, then 5 or more. */
export function streakGold(streak: number): number {
  const length = Math.abs(streak);
  if (length >= 5) return 3;
  if (length >= 4) return 2;
  if (length >= 2) return 1;
  return 0;
}

export const interest = (gold: number) =>
  Math.min(MAX_INTEREST, Math.floor(gold / INTEREST_STEP));

/** What a new round pays to someone holding `gold`, on `streak`. */
export function income(gold: number, streak: number): number {
  return BASE_INCOME + interest(gold) + streakGold(streak);
}

/** Experience needed from `level` to the next; null at MAX_LEVEL. */
export const xpToNext = (level: number): number | null =>
  level >= MAX_LEVEL ? null : XP_TO_LEVEL[level - 1]!;

/** Levels up as often as the experience pays for. Experience stops at MAX_LEVEL. */
export function gainXp(
  level: number,
  xp: number,
  amount: number,
): { level: number; xp: number } {
  let next = { level, xp: xp + amount };
  for (let need = xpToNext(next.level); need !== null && next.xp >= need;) {
    next = { level: next.level + 1, xp: next.xp - need };
    need = xpToNext(next.level);
  }
  return next.level >= MAX_LEVEL ? { level: MAX_LEVEL, xp: 0 } : next;
}
