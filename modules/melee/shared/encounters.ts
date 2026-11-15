import { monsters, playerTypes } from "./content";
import { GRID_COLUMNS, GRID_ROWS, MAX_PARTY_SIZE } from "./grid";
import { createRandom } from "./rng";
import type { BattleSetup, CombatantDef, Placement, Side } from "./types";

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard"];

/**
 * Total monster threat per difficulty (Slime 2, Wolf 3, Viper 2). Tuned
 * with auto-played battles where both sides only attack: about 93% / 71% /
 * 38% party wins. Skills, summons and movement, which auto-play doesn't
 * use, help a real player. The encounter tests check each difficulty stays
 * in its band.
 */
export const THREAT_BUDGET: Record<Difficulty, number> = {
  easy: 15,
  normal: 17,
  hard: 19,
};

/** Monsters lean toward the front: weights for rows 0, 1, 2. */
const ENEMY_ROW_WEIGHTS = [3, 2, 1];

export interface EncounterPools {
  party: CombatantDef[];
  monsters: CombatantDef[];
}

/**
 * A battle built from the given party and monster pool. The same seed and
 * difficulty always give the same encounter. Party members stand in their
 * preferred row (in a random column); monsters are drawn at random until
 * the threat budget is spent and placed with a bias toward the front.
 */
export function randomEncounter(
  seed: number,
  difficulty: Difficulty,
  pools: EncounterPools = { party: playerTypes, monsters },
): BattleSetup {
  const random = createRandom(seed);
  const pick = <T>(items: T[]): T =>
    items[Math.floor(random() * items.length)]!;
  const taken = new Set<string>();
  const key = (side: Side, col: number, row: number) => `${side}-${col}-${row}`;
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

  for (const def of party) {
    // The preferred row, or the nearest row with room.
    const preferred = def.preferredRow ?? 0;
    const rows = [0, 1, 2].sort(
      (a, b) => Math.abs(a - preferred) - Math.abs(b - preferred) || a - b,
    );
    const row = rows.find((r) => freeCells("player", r).length > 0);
    if (row === undefined) break;
    put(def, "player", row, pick(freeCells("player", row)));
  }

  let budget = THREAT_BUDGET[difficulty];
  const cost = (def: CombatantDef) => def.threat ?? 1;
  for (;;) {
    const affordable = pools.monsters.filter((m) => cost(m) <= budget);
    const rows = [0, 1, 2].filter((r) => freeCells("enemy", r).length > 0);
    if (affordable.length === 0 || rows.length === 0) break;
    const monster = pick(affordable);
    const row = weightedRow(rows, random());
    put(monster, "enemy", row, pick(freeCells("enemy", row)));
    budget -= cost(monster);
  }

  return { placements };
}

function weightedRow(rows: number[], roll: number): number {
  const weights = rows.map((r) => ENEMY_ROW_WEIGHTS[r] ?? 1);
  let left = roll * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < rows.length; i++) {
    left -= weights[i]!;
    if (left < 0) return rows[i]!;
  }
  return rows[rows.length - 1] ?? GRID_ROWS - 1;
}
