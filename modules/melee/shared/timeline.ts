import { timeToNextTick } from "./status";
import { effectiveStat, isAlive } from "./stats";
import type { BattleEvent, BattleState, Unit } from "./types";

export const GAUGE_FULL = 1000;
// Float tolerance for "the gauge is full".
const EPSILON = 1e-9;

/** Gauge filled per unit of game time. A casting unit's gauge waits. */
export function fillRate(unit: Unit): number {
  if (unit.casting) return 0;
  return effectiveStat(unit, "speed");
}

/**
 * Game time until the next thing happens: a unit's gauge fills or a
 * modifier expires. Infinity if nothing will ever happen.
 */
export function timeToNextEvent(state: BattleState): number {
  let next = Infinity;
  for (const unit of state.units) {
    if (!isAlive(unit)) continue;
    const rate = fillRate(unit);
    if (rate > 0) next = Math.min(next, (GAUGE_FULL - unit.gauge) / rate);
    if (unit.casting) {
      next = Math.min(next, unit.casting.readyAt - state.time);
    }
    for (const m of unit.modifiers) {
      if (m.expiresAt !== undefined) {
        next = Math.min(next, m.expiresAt - state.time);
      }
    }
  }
  return Math.max(0, Math.min(next, timeToNextTick(state)));
}

/**
 * Moves game time forward by `dt`, filling gauges, expiring modifiers and
 * queueing units that became ready (fastest first, then by ID). Mutates
 * `state`, which the caller owns.
 */
export function advanceTime(
  state: BattleState,
  dt: number,
  events: BattleEvent[],
): void {
  if (dt > 0) {
    state.time += dt;
    events.push({ type: "timeAdvanced", time: state.time });
  }

  const newlyReady: Unit[] = [];
  for (const unit of state.units) {
    if (!isAlive(unit) || state.ready.includes(unit.id)) continue;
    // Gauges fill at the rate from before any modifier expires this step:
    // timeToNextEvent never steps past an expiry.
    unit.gauge = Math.min(GAUGE_FULL, unit.gauge + fillRate(unit) * dt);
    if (unit.gauge >= GAUGE_FULL - EPSILON) {
      unit.gauge = GAUGE_FULL;
      newlyReady.push(unit);
    }
  }

  for (const unit of state.units) {
    const kept = unit.modifiers.filter(
      (m) => m.expiresAt === undefined || m.expiresAt > state.time + EPSILON,
    );
    for (const m of unit.modifiers) {
      if (!kept.includes(m)) {
        events.push({
          type: "modifierExpired",
          unitId: unit.id,
          source: m.source,
        });
      }
    }
    unit.modifiers = kept;
  }

  newlyReady.sort(
    (a, b) => fillRate(b) - fillRate(a) || a.id.localeCompare(b.id),
  );
  for (const unit of newlyReady) {
    state.ready.push(unit.id);
    events.push({ type: "turnReady", unitId: unit.id });
  }
}

/**
 * A forecast of the next `count` turns, as unit IDs in order (a unit can
 * appear more than once). Units already ready come first; then gauges fill
 * at today's speed, a caster's after its spell lands, and every turn is
 * assumed to empty the gauge. Modifiers that expire, Quicken, half-turn
 * actions and knockouts can change it, so it is only a forecast.
 */
export function turnOrder(state: BattleState, count: number): string[] {
  const order = state.ready.slice(0, count);
  const queue: { id: string; at: number; rate: number }[] = [];
  for (const unit of state.units) {
    if (!isAlive(unit) || unit.obstacle || unit.vanished) continue;
    const rate = effectiveStat(unit, "speed");
    if (rate <= 0) continue;
    const full = GAUGE_FULL / rate;
    const at = state.ready.includes(unit.id)
      ? state.time + full
      : (unit.casting?.readyAt ?? state.time) +
        (GAUGE_FULL - unit.gauge) / rate;
    queue.push({ id: unit.id, at, rate });
  }
  while (order.length < count && queue.length > 0) {
    // Soonest first; at the same moment, faster first, then by ID (as
    // advanceTime queues them).
    queue.sort(
      (a, b) => a.at - b.at || b.rate - a.rate || a.id.localeCompare(b.id),
    );
    const next = queue[0]!;
    order.push(next.id);
    next.at += GAUGE_FULL / next.rate;
  }
  return order;
}
