import { GAUGE_FULL } from "./timeline";
import { dropReady } from "./units";
import type { BattleEvent, BattleState, Unit } from "./types";

/** A defending unit takes this share of every hit. */
export const DEFEND_FACTOR = 0.5;

/** Waiting hands the turn on cheaply: the gauge keeps three quarters. */
export const WAIT_GAUGE_LEFT = GAUGE_FULL * 0.75;

/** How a target's stance scales a hit: halved while it defends. */
export function stanceFactor(target: Unit): number {
  return target.defending ? DEFEND_FACTOR : 1;
}

/** A unit's guard drops the moment it acts again. */
export function dropGuard(unit: Unit): void {
  unit.defending = undefined;
}

/** Spends the turn bracing: hits are halved until the unit's next action. */
export function resolveDefend(
  state: BattleState,
  unit: Unit,
  events: BattleEvent[],
): void {
  unit.defending = true;
  events.push({ type: "defended", unitId: unit.id });
  unit.gauge = 0;
  dropReady(state, unit.id);
}

/** Lets others go first: the unit acts again after a short while. */
export function resolveWait(
  state: BattleState,
  unit: Unit,
  events: BattleEvent[],
): void {
  events.push({ type: "waited", unitId: unit.id });
  unit.gauge = WAIT_GAUGE_LEFT;
  dropReady(state, unit.id);
}
