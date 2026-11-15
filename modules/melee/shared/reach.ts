import { isAlive } from "./stats";
import type { BattleState, Unit } from "./types";

/**
 * The enemies `attacker` can hit with its weapon.
 *
 * - Columns: weapons with a column limit reach that many columns on each
 *   side of the attacker's own column. Until units can move, a melee unit
 *   with no enemy in range may attack the nearest occupied column instead,
 *   so a battle can never get stuck.
 * - Depth: within a column, living units are counted from the front. A
 *   weapon with depth 1 reaches only the front-most; the rest are covered.
 *   An empty front cell leaves the unit behind it exposed.
 */
export function reachableTargets(state: BattleState, attacker: Unit): Unit[] {
  const enemies = state.units.filter(
    (u) => u.side !== attacker.side && isAlive(u),
  );
  const { columns, depth } = attacker.weapon;

  const exposed = enemies.filter((target) => {
    if (depth === "any") return true;
    const inFront = enemies.filter(
      (u) =>
        u.position.col === target.position.col &&
        u.position.row < target.position.row,
    ).length;
    return inFront < depth;
  });
  if (columns === "any") return exposed;

  const distance = (u: Unit) =>
    Math.abs(u.position.col - attacker.position.col);
  const inRange = exposed.filter((u) => distance(u) <= columns);
  if (inRange.length > 0 || exposed.length === 0) return inRange;

  const nearest = Math.min(...exposed.map(distance));
  return exposed.filter((u) => distance(u) === nearest);
}

export function canReach(
  state: BattleState,
  attacker: Unit,
  target: Unit,
): boolean {
  return reachableTargets(state, attacker).some((u) => u.id === target.id);
}
