import { nextRandom } from "./rng";
import { effectiveStat } from "./stats";
import type { BattleEvent, BattleState, Unit } from "./types";

/** Higher K means defense matters less. */
export const DEFENSE_K = 50;
const VARIANCE = 0.1;

/** raw x K / (K + defense) x random(0.9..1.1), at least 1. */
function mitigate(state: BattleState, raw: number, defense: number): number {
  const variance = 1 - VARIANCE + nextRandom(state) * VARIANCE * 2;
  const amount = raw * (DEFENSE_K / (DEFENSE_K + defense)) * variance;
  return Math.max(1, Math.round(amount));
}

/** Basic weapon attack: attack against defense. */
export function physicalDamage(
  state: BattleState,
  attacker: Unit,
  target: Unit,
): number {
  return mitigate(
    state,
    effectiveStat(attacker, "attack"),
    effectiveStat(target, "defense"),
  );
}

/** Spell damage: power x magic against the target's spirit. */
export function magicalDamage(
  state: BattleState,
  caster: Unit,
  target: Unit,
  power: number,
): number {
  return mitigate(
    state,
    power * effectiveStat(caster, "magic"),
    effectiveStat(target, "spirit"),
  );
}

/** Takes HP off a unit and knocks it out at 0. */
export function applyDamage(
  state: BattleState,
  target: Unit,
  amount: number,
  events: BattleEvent[],
): void {
  target.hp = Math.max(0, target.hp - amount);
  events.push({ type: "damage", unitId: target.id, amount, hp: target.hp });
  if (target.hp === 0) {
    target.gauge = 0;
    state.ready = state.ready.filter((id) => id !== target.id);
    events.push({ type: "knockedOut", unitId: target.id });
  }
}
