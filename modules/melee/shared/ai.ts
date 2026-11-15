import { randomIndex } from "./rng";
import { isAlive } from "./stats";
import type { BattleState, Command, Unit } from "./types";

/**
 * Placeholder AI: attack a random living enemy. Replaced by weighted,
 * data-driven rules in a later phase.
 */
export function chooseCommand(state: BattleState, unit: Unit): Command | null {
  const targets = state.units.filter((u) => u.side !== unit.side && isAlive(u));
  if (targets.length === 0) return null;
  const target = targets[randomIndex(state, targets.length)]!;
  return { type: "attack", targetId: target.id };
}
