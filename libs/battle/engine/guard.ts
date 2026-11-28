import { isAlive } from "./stats";
import type { BattleState, Unit } from "./types";

/**
 * The unit guarding `target` from `attacker`: the living ally that put a
 * guard status on it (the Knight's Guard). Null for an attacker on the
 * target's own side, or when no one stands guard.
 */
export function guardianOf(
  state: BattleState,
  attacker: Unit,
  target: Unit,
): Unit | null {
  if (attacker.side === target.side) return null;
  const guard = target.statuses.find((s) => s.effect === "guard");
  if (!guard) return null;
  const guardian = state.units.find((u) => u.id === guard.sourceId);
  return guardian &&
    guardian !== target &&
    guardian.side === target.side &&
    isAlive(guardian)
    ? guardian
    : null;
}

/**
 * Who a single-target hit from `attacker` aimed at `target` lands on: its
 * guardian if it has one, else the target itself.
 */
export function hitVictim(
  state: BattleState,
  attacker: Unit,
  target: Unit,
): Unit {
  return guardianOf(state, attacker, target) ?? target;
}
