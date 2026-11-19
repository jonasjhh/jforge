import { unitAt } from "./grid";
import { applyModifier } from "./status";
import { GAUGE_FULL } from "./timeline";
import type { BattleEvent, BattleState, Position, Unit } from "./types";
import { dropReady } from "./units";

// A rescue (the Knight's Rescue) pulls an ally back out of the line: in
// the ally's column, the rescuer takes the middle row and the ally the
// back row behind it. Being dragged back costs the ally half its gauge;
// the rescuer braces for the blows it now takes in the ally's place.

/** The rescuer's brace: defense x1.3 until about its next turn. */
export const RESCUE_BRACE = {
  name: "Braced",
  stat: "defense",
  op: "mul",
  value: 1.3,
  duration: 125,
  harmful: false,
} as const;

/** Where the rescuer and the ally end up. */
function rescueCells(ally: Unit): { rescuer: Position; ally: Position } {
  const { col } = ally.position;
  return { rescuer: { col, row: 1 }, ally: { col, row: 2 } };
}

/**
 * Why `rescuer` can't pull `ally` back, or null if it can: a cell it needs
 * is taken by someone else (standing or knocked out), or the two already
 * stand there.
 */
export function rescueBlock(
  state: BattleState,
  rescuer: Unit,
  ally: Unit,
): string | null {
  const to = rescueCells(ally);
  const same = (a: Position, b: Position) => a.col === b.col && a.row === b.row;
  if (same(rescuer.position, to.rescuer) && same(ally.position, to.ally)) {
    return `${ally.name} is already behind you`;
  }
  for (const cell of [to.rescuer, to.ally]) {
    const there = unitAt(state, { side: ally.side, ...cell });
    if (there && there !== rescuer && there !== ally) {
      return "No room to pull back there";
    }
  }
  return null;
}

/**
 * Pulls `ally` back behind `rescuer`; the ally's gauge halves and the
 * rescuer braces (RESCUE_BRACE).
 */
export function rescue(
  state: BattleState,
  rescuer: Unit,
  ally: Unit,
  events: BattleEvent[],
): void {
  const to = rescueCells(ally);
  const moves: [Unit, Position][] = [
    [rescuer, to.rescuer],
    [ally, to.ally],
  ];
  for (const [unit, cell] of moves) {
    const from = { ...unit.position };
    unit.position = { ...cell };
    if (from.col !== cell.col || from.row !== cell.row) {
      events.push({ type: "moved", unitId: unit.id, from, to: { ...cell } });
    }
  }
  events.push({ type: "rescued", unitId: ally.id, byId: rescuer.id });
  // Half of a gauge still below 0 (a bow's late start) would be a gain.
  ally.gauge = Math.min(ally.gauge, ally.gauge / 2);
  if (ally.gauge < GAUGE_FULL) dropReady(state, ally.id);
  events.push({ type: "gaugeChanged", unitId: ally.id, gauge: ally.gauge });
  applyModifier(state, rescuer, RESCUE_BRACE, events);
}
