import type { BattleEvent, BattleState, Unit } from "./types";
import { isAlive } from "./stats";
import { restoreHp } from "./units";

// Judgment (Paladin): a strike that heals the caster's most-hurt ally by
// a share of the damage dealt. Built into the strike, not a general
// second effect.

/**
 * The living ally (the caster included, obstacles not) missing the
 * largest share of its max HP, or undefined if none is hurt.
 */
export function mostHurtAlly(state: BattleState, unit: Unit): Unit | undefined {
  let best: Unit | undefined;
  for (const ally of state.units) {
    if (ally.side !== unit.side || ally.obstacle || !isAlive(ally)) continue;
    if (ally.hp >= ally.base.maxHp) continue;
    if (!best || ally.hp / ally.base.maxHp < best.hp / best.base.maxHp) {
      best = ally;
    }
  }
  return best;
}

/** Heals the most-hurt ally by `share` of the `lost` HP the hit dealt. */
export function mendMostHurt(
  state: BattleState,
  unit: Unit,
  lost: number,
  share: number,
  events: BattleEvent[],
): void {
  const ally = mostHurtAlly(state, unit);
  if (!ally) return;
  const amount = restoreHp(ally, Math.floor(lost * share));
  if (amount > 0) {
    events.push({ type: "heal", unitId: ally.id, amount, hp: ally.hp });
  }
}
