import { unitAt } from "./grid";
import type { BattleEvent, BattleState, Position, Unit } from "./types";

// A charge (the Knight's Charge: a strike with `advance`) first runs the
// attacker to the front row of its own column, then strikes from there.

/** Where a charging unit ends up: the front cell of its column. */
export function chargeCell(unit: Unit): Position {
  return { col: unit.position.col, row: 0 };
}

/**
 * Why `unit` can't charge now, or null if it can: it is already at the
 * front, or a unit (standing or knocked out) is in the way.
 */
export function chargeBlock(state: BattleState, unit: Unit): string | null {
  const { col, row } = unit.position;
  if (row === 0) return "Already in the front row";
  for (let r = 0; r < row; r++) {
    if (unitAt(state, { side: unit.side, col, row: r })) {
      return "The way to the front row is blocked";
    }
  }
  return null;
}

/** `unit` as it would stand after charging: a copy, for reach and previews. */
export function charged(unit: Unit): Unit {
  return { ...unit, position: chargeCell(unit) };
}

/** Runs `unit` to the front of its column. */
export function charge(unit: Unit, events: BattleEvent[]): void {
  const from = { ...unit.position };
  unit.position = chargeCell(unit);
  events.push({
    type: "moved",
    unitId: unit.id,
    from,
    to: { ...unit.position },
  });
}
