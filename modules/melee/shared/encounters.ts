import { monsters, playerTypes } from "./content";
import { GRID_COLUMNS, GRID_ROWS, MAX_PARTY_SIZE, unitId } from "./grid";
import { createRandom } from "./rng";
import type { BattleSetup, CombatantDef, Placement, Side } from "./types";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

/**
 * Total monster threat per difficulty (Slime 2, Wolf 3, Viper 2). Hard is
 * about 30% more than Normal. Tuned with auto-played battles where both sides use
 * their skills and move: about 100% / 90% / 55% party wins. The encounter
 * tests check each difficulty stays in its band.
 */
export const THREAT_BUDGET: Record<Difficulty, number> = {
  easy: 15,
  normal: 21,
  hard: 27,
};

/**
 * A unit that fights from behind the line: a ranged weapon, or a preferred
 * row past the front.
 */
export function isBackLiner(def: CombatantDef): boolean {
  return def.weapon.kind === "ranged" || (def.preferredRow ?? 0) > 0;
}

/**
 * Back-liners per front-liner in an encounter: at most two thirds of its
 * monsters fight from the back, so there is always a line to break first.
 */
export const MAX_BACK_PER_FRONT = 2;

export interface EncounterPools {
  party: CombatantDef[];
  monsters: CombatantDef[];
}

/**
 * A battle built from the given party and monster pool. The same seed and
 * difficulty always give the same encounter. Party members stand in their
 * preferred row (in a random column), or the nearest row with room.
 * Monsters are drawn at random until the threat budget is spent, with
 * back-liners kept to two thirds (MAX_BACK_PER_FRONT) (unless the pool has no front-liner),
 * and stand in their preferred row the same way.
 * `budget` replaces the difficulty's own (jrpg scales it with the party).
 */
export function randomEncounter(
  seed: number,
  difficulty: Difficulty,
  pools: EncounterPools = { party: playerTypes, monsters },
  budget: number = THREAT_BUDGET[difficulty],
): BattleSetup {
  const random = createRandom(seed);
  const pick = <T>(items: T[]): T =>
    items[Math.floor(random() * items.length)]!;
  const taken = new Set<string>();
  const key = (side: Side, col: number, row: number) =>
    unitId(side, { col, row });
  const allRows = () => Array.from({ length: GRID_ROWS }, (_, row) => row);
  const freeCells = (side: Side, row: number) =>
    Array.from({ length: GRID_COLUMNS }, (_, col) => col).filter(
      (col) => !taken.has(key(side, col, row)),
    );

  const placements: Placement[] = [];
  const put = (def: CombatantDef, side: Side, row: number, col: number) => {
    taken.add(key(side, col, row));
    placements.push({ def, side, position: { col, row } });
  };

  // With more classes than party slots, a seeded pick (kept in roster order).
  let party = pools.party;
  while (party.length > MAX_PARTY_SIZE) {
    const drop = Math.floor(random() * party.length);
    party = party.filter((_, i) => i !== drop);
  }

  /** The preferred row, or the nearest row with room; false when full. */
  const stand = (def: CombatantDef, side: Side): boolean => {
    const preferred = def.preferredRow ?? 0;
    const rows = allRows().sort(
      (a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b,
    );
    const row = rows.find((r) => freeCells(side, r).length > 0);
    if (row === undefined) return false;
    put(def, side, row, pick(freeCells(side, row)));
    return true;
  };

  for (const def of party) {
    if (!stand(def, "player")) break;
  }

  const cost = (def: CombatantDef) => def.threat ?? 1;
  const anyFront = pools.monsters.some((m) => !isBackLiner(m));
  let front = 0;
  let back = 0;
  // One more back-liner keeps them within their share.
  const backFits = () => !anyFront || back + 1 <= MAX_BACK_PER_FRONT * front;
  for (;;) {
    const allowed = pools.monsters.filter((m) => !isBackLiner(m) || backFits());
    let affordable = allowed.filter((m) => cost(m) <= budget);
    // A pool of only big monsters still gets one: the cheapest allowed.
    if (affordable.length === 0 && front + back === 0) {
      const cheapest = Math.min(...allowed.map(cost));
      affordable = allowed.filter((m) => cost(m) === cheapest);
    }
    if (affordable.length === 0) break;
    const monster = pick(affordable);
    if (!stand(monster, "enemy")) break;
    budget -= cost(monster);
    if (isBackLiner(monster)) back++;
    else front++;
  }

  return { placements };
}
