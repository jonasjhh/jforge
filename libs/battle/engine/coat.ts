import { POISON } from "./poison";
import { isAlive } from "./stats";
import { applyStatus } from "./status";
import type { BattleEvent, BattleState, Unit } from "./types";

// A coated blade (the Rogue's Poison Blade) poisons whatever its weapon
// hits while the coating lasts: plain attacks and strike skills alike.
// Built in, not a general second effect.

export function isCoated(unit: Unit): boolean {
  return unit.statuses.some((s) => s.effect === "coat");
}

/** Poisons `target` if `unit`'s blade is coated and the hit got through. */
export function poisonOnHit(
  state: BattleState,
  unit: Unit,
  target: Unit,
  damage: number,
  events: BattleEvent[],
): void {
  if (!isCoated(unit) || damage <= 0) return;
  if (!isAlive(target) || target.obstacle) return;
  applyStatus(state, unit, target, POISON, events);
}
