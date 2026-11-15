import { nextRandom } from "./rng";
import { effectiveStat } from "./stats";
import type { BattleState, Unit } from "./types";

/** Higher K means defense matters less. */
export const DEFENSE_K = 50;
const VARIANCE = 0.1;

/**
 * Basic physical attack: attack x K / (K + defense) x random(0.9..1.1),
 * at least 1. Elements, rows and skill power arrive in phase 2.
 */
export function physicalDamage(
  state: BattleState,
  attacker: Unit,
  target: Unit,
): number {
  const attack = effectiveStat(attacker, "attack");
  const defense = effectiveStat(target, "defense");
  const variance = 1 - VARIANCE + nextRandom(state) * VARIANCE * 2;
  const raw = attack * (DEFENSE_K / (DEFENSE_K + defense)) * variance;
  return Math.max(1, Math.round(raw));
}
