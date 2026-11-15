import { reachableTargets } from "./reach";
import { randomIndex } from "./rng";
import type { BattleState, Command, Unit } from "./types";

/**
 * Placeholder AI: attack a random enemy it can reach. Replaced by
 * weighted, data-driven rules in a later phase.
 */
export function chooseCommand(state: BattleState, unit: Unit): Command | null {
  const targets = reachableTargets(state, unit);
  if (targets.length === 0) return null;
  const target = targets[randomIndex(state, targets.length)]!;
  return { type: "attack", targetId: target.id };
}
