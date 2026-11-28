import { GAUGE_FULL } from "./timeline";
import type { BattleEvent, BattleState, Unit } from "./types";
import { dropReady } from "./units";

// A staggering hit (the Lancer's Staggering Thrust) knocks part of the
// target's turn gauge away, so its next turn comes later. A unit busy
// casting is not affected (its gauge waits anyway), and a gauge already
// below 0 (a bow's late start) is not lowered further.

/** The gauge `unit` would be left with after losing `share` of a full one. */
export function staggeredGauge(unit: Unit, share: number): number {
  return Math.max(Math.min(unit.gauge, 0), unit.gauge - share * GAUGE_FULL);
}

/** Knocks `share` of a full gauge off `target`, if it isn't casting. */
export function stagger(
  state: BattleState,
  target: Unit,
  share: number,
  events: BattleEvent[],
): void {
  if (target.casting) return;
  const gauge = staggeredGauge(target, share);
  if (gauge === target.gauge) return;
  target.gauge = gauge;
  if (gauge < GAUGE_FULL) dropReady(state, target.id);
  events.push({ type: "gaugeChanged", unitId: target.id, gauge });
}
