import { MAX_LEVEL } from "./economy";
import { TIERS, copiesIn } from "./units";

// The shop offers SHOP_SIZE units each round. Which cost tiers turn up
// depends on the level; every class has a limited number of copies,
// shared by every roll, so buying many of one makes it rarer.

export const SHOP_SIZE = 5;
export const BENCH_SIZE = 9;
/** Chance in percent of each tier (1, 2, 3) turning up, by level. */
export const SHOP_ODDS: readonly (readonly number[])[] = [
  [100, 0, 0],
  [100, 0, 0],
  [75, 25, 0],
  [55, 35, 10],
  [45, 40, 15],
  [30, 45, 25],
  [20, 45, 35],
  [15, 40, 45],
  [10, 35, 55],
  [5, 30, 65],
];
/** Copies of each class of a tier in the pool. */
export const POOL_COPIES = [18, 15, 12] as const;

/** Copies left of each class, by class id. */
export type Pool = Record<string, number>;

export function fullPool(tiers: Record<string, number>): Pool {
  return Object.fromEntries(
    Object.entries(tiers).map(([id, tier]) => [id, POOL_COPIES[tier - 1]!]),
  );
}

/** The pool with a unit's copies taken out (-1) or put back (+1). */
export function returnToPool(
  pool: Pool,
  classId: string,
  stars: number,
  sign: 1 | -1 = 1,
): Pool {
  return { ...pool, [classId]: (pool[classId] ?? 0) + sign * copiesIn(stars) };
}

function tierFor(level: number, roll: number): number {
  const odds = SHOP_ODDS[Math.min(level, MAX_LEVEL) - 1]!;
  let left = roll * 100;
  for (let tier = 1; tier <= TIERS; tier++) {
    left -= odds[tier - 1]!;
    if (left < 0) return tier;
  }
  return 1;
}

/**
 * A new shop: each slot draws a tier by the level's odds, then a class
 * of that tier weighted by its copies left. A tier with none left gives
 * way to the nearest cheaper one, then dearer; an empty pool, nothing.
 */
export function rollShop(
  pool: Pool,
  tiers: Record<string, number>,
  level: number,
  random: () => number,
): (string | null)[] {
  const ofTier = (tier: number) =>
    Object.keys(tiers).filter((id) => tiers[id] === tier && pool[id]! > 0);
  return Array.from({ length: SHOP_SIZE }, () => {
    const wanted = tierFor(level, random());
    const order = Array.from({ length: TIERS }, (_, i) => i + 1).sort(
      (a, b) =>
        Math.abs(a - wanted) - Math.abs(b - wanted) ||
        (a < wanted ? -1 : 1) - (b < wanted ? -1 : 1),
    );
    const tier = order.find((t) => ofTier(t).length > 0);
    const pick = random();
    if (tier === undefined) return null;
    const classes = ofTier(tier);
    const total = classes.reduce((sum, id) => sum + pool[id]!, 0);
    let left = pick * total;
    for (const id of classes) {
      left -= pool[id]!;
      if (left < 0) return id;
    }
    return classes[classes.length - 1]!;
  });
}
