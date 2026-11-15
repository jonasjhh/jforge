import { isOnGrid } from "./grid";
import type { BattleEvent, BattleState, Position, Unit } from "./types";

/** Damage multiplier when a push or pull is blocked. */
export const COLLISION_POWER = 1.5;

/**
 * Where `rows` of push would move `unit` (negative pulls it forward), or
 * null if the way is blocked: off the grid, or a unit (knocked out or not)
 * stands in the destination.
 */
export function pushDestination(
  state: BattleState,
  unit: Unit,
  rows: number,
): Position | null {
  const to = { col: unit.position.col, row: unit.position.row + rows };
  if (!isOnGrid(to)) return null;
  const occupied = state.units.some(
    (u) =>
      u !== unit &&
      u.side === unit.side &&
      u.position.col === to.col &&
      u.position.row === to.row,
  );
  return occupied ? null : to;
}

/** The unit standing where `rows` of push would move `unit`, if any. */
export function pushBlocker(
  state: BattleState,
  unit: Unit,
  rows: number,
): Unit | undefined {
  const row = unit.position.row + rows;
  return state.units.find(
    (u) =>
      u !== unit &&
      u.side === unit.side &&
      u.position.col === unit.position.col &&
      u.position.row === row,
  );
}

/** Moves a unit to a destination returned by `pushDestination`. */
export function moveBy(unit: Unit, to: Position, events: BattleEvent[]): void {
  const from = { ...unit.position };
  unit.position = { ...to };
  events.push({ type: "pushed", unitId: unit.id, from, to: { ...to } });
}
