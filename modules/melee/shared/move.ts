import { GAUGE_FULL } from "./timeline";
import { isOnGrid, unitAt } from "./grid";
import { dropReady } from "./units";
import type { BattleEvent, BattleState, Position, Unit } from "./types";

/** Moving costs half a turn: the gauge drops to half instead of empty. */
export const MOVE_GAUGE_LEFT = GAUGE_FULL / 2;

/** Why `unit` cannot step to `to` on its own side, or null if it can. */
export function validateMove(
  state: BattleState,
  unit: Unit,
  to: Position,
): string | null {
  if (!isOnGrid(to)) return "That cell is off the grid";
  const steps =
    Math.abs(to.col - unit.position.col) + Math.abs(to.row - unit.position.row);
  if (steps !== 1) return "Can only step to an adjacent cell";
  // Knocked-out units still lie in their cell and block it.
  if (unitAt(state, { side: unit.side, ...to })) return "That cell is occupied";
  return null;
}

/** Moves a unit whose move has already been validated. */
export function resolveMove(
  state: BattleState,
  unit: Unit,
  to: Position,
  events: BattleEvent[],
): void {
  const from = { ...unit.position };
  unit.position = { ...to };
  events.push({ type: "moved", unitId: unit.id, from, to: { ...to } });
  unit.gauge = MOVE_GAUGE_LEFT;
  dropReady(state, unit.id);
}
