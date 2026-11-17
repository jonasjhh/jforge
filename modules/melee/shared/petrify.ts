import type { BattleEvent, BattleState, Unit } from "./types";
import { dropReady } from "./units";

// Petrify (Geomancer): a harmful `petrify` status. While it lasts the unit
// is stone: its gauge doesn't fill and it can't take a turn, but it takes
// x0.5 damage. Petrifying breaks a cast in progress (the MP stays spent)
// and takes a unit waiting to act out of the line; its full gauge brings
// it straight back once the stone wears off.

/** What a petrified unit takes from every hit, times. */
export const PETRIFY_TAKEN = 0.5;

export function isPetrified(unit: Unit): boolean {
  return unit.statuses.some((s) => s.effect === "petrify");
}

/** When the unit's petrification wears off, if it is petrified. */
export function petrifiedUntil(unit: Unit): number | undefined {
  const status = unit.statuses.find((s) => s.effect === "petrify");
  return status
    ? status.nextTickAt + (status.ticksLeft - 1) * status.interval
    : undefined;
}

/** Turns `target` to stone: breaks its cast and takes it out of line. */
export function petrify(
  state: BattleState,
  target: Unit,
  events: BattleEvent[],
): void {
  if (target.casting) {
    events.push({
      type: "castFizzled",
      unitId: target.id,
      skillName: target.casting.skillName,
    });
    target.casting = undefined;
  }
  dropReady(state, target.id);
}
