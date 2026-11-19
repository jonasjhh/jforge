import type { Library } from "@jforge/char/shared";
import {
  content,
  type CombatantDef,
  type Position,
} from "@jforge/melee/shared";
import { BOARD_COLUMNS, BOARD_ROWS } from "./hex";
import { randomFrom } from "./random";
import { STAR_STATS, monsterDef } from "./units";

// Every round is a pack of monsters, as in a trial against the house:
// a fixed curve of rounds that grow harder, in stages, each ending in a
// stronger round.

export const ROUNDS = 30;
export const ROUNDS_PER_STAGE = 5;
/** Threat the first round's pack has... */
export const BASE_BUDGET = 3;
/** ...and how much more each round after. */
export const BUDGET_PER_ROUND = 1.0;
/** The last round of a stage has this much more. */
export const STAGE_END_BUDGET = 1.3;
/** A pack never has more monsters than this. */
export const MAX_PACK = 10;
/** Each stage after the first adds this share to monsters' STAR_STATS. */
export const MONSTER_GROWTH = 0.45;

export const stageOf = (round: number) => Math.ceil(round / ROUNDS_PER_STAGE);
export const isStageEnd = (round: number) => round % ROUNDS_PER_STAGE === 0;

/** The threat a round's pack is drawn up to. */
export function roundBudget(round: number): number {
  const budget = BASE_BUDGET + BUDGET_PER_ROUND * (round - 1);
  return isStageEnd(round) ? budget * STAGE_END_BUDGET : budget;
}

/**
 * The monsters a run meets: the library's enemy types that aren't
 * obstacles, and melee's own monsters. Each costs its threat at stage 1;
 * later stages make them stronger, not dearer.
 */
export function monsterPool(library: Library, stage: number): CombatantDef[] {
  const designed = library.archetypes
    .filter((a) => a.kind === "enemy" && !a.obstacle)
    .flatMap((a) => monsterDef(library, a.id) ?? []);
  const growth = 1 + MONSTER_GROWTH * (stage - 1);
  return [...designed, ...content.monsters].map((def) => {
    const stats = { ...def.stats };
    for (const stat of STAR_STATS)
      stats[stat] = Math.round(stats[stat] * growth);
    return { ...def, stats };
  });
}

/** A monster of a pack, where it stands on the enemy's side. */
export interface PackMonster {
  def: CombatantDef;
  position: Position;
}

/** The row a monster stands in: its own, or by weapon (ranged behind). */
const rowFor = (def: CombatantDef) =>
  Math.min(
    def.preferredRow ?? (def.weapon.kind === "ranged" ? 2 : 0),
    BOARD_ROWS - 1,
  );

/**
 * A round's pack: monsters drawn at random among those the budget still
 * affords, up to MAX_PACK, each in a free hex of its row (or the nearest
 * row with one). The same seed, the same pack.
 */
export function roundPack(
  library: Library,
  round: number,
  seed: number,
): PackMonster[] {
  const random = randomFrom(seed);
  const pool = monsterPool(library, stageOf(round));
  const pack: PackMonster[] = [];
  let left = roundBudget(round);
  while (pack.length < MAX_PACK) {
    const affordable = pool.filter((m) => (m.threat ?? 1) <= left);
    if (affordable.length === 0) break;
    const def = affordable[Math.floor(random() * affordable.length)]!;
    left -= def.threat ?? 1;
    const rows = Array.from({ length: BOARD_ROWS }, (_, r) => r).sort(
      (a, b) => Math.abs(a - rowFor(def)) - Math.abs(b - rowFor(def)) || a - b,
    );
    for (const row of rows) {
      const free = Array.from(
        { length: BOARD_COLUMNS },
        (_, col) => col,
      ).filter(
        (col) =>
          !pack.some((m) => m.position.col === col && m.position.row === row),
      );
      if (free.length === 0) continue;
      const col = free[Math.floor(random() * free.length)]!;
      pack.push({
        def: {
          ...def,
          id: `${def.id}-${pack.length + 1}`,
          portrait: def.portrait ?? def.id,
        },
        position: { col, row },
      });
      break;
    }
  }
  return pack;
}
