import { nextRandom } from "./rng";
import { effectiveStat } from "./stats";
import type { BattleEvent, BattleState, DamageType, Unit } from "./types";

/** Higher K means defense matters less. */
export const DEFENSE_K = 50;
const VARIANCE = 0.1;

/** Share of raw damage that gets through `defense`: K / (K + defense). */
export function defenseFactor(defense: number): number {
  return DEFENSE_K / (DEFENSE_K + defense);
}

/** A hit about to land: its amount and what the target's resistance did. */
export interface Hit {
  amount: number;
  damageType: DamageType;
  multiplier: number;
}

/** The target's multiplier for a damage type (1 if not listed). */
export function resistance(target: Unit, type: DamageType): number {
  return target.resistances[type] ?? 1;
}

/**
 * raw x K / (K + defense) x resistance x random(0.9..1.1). At least 1,
 * unless the target is immune (multiplier 0).
 */
function mitigate(
  state: BattleState,
  raw: number,
  defense: number,
  target: Unit,
  damageType: DamageType,
): Hit {
  const variance = 1 - VARIANCE + nextRandom(state) * VARIANCE * 2;
  const multiplier = resistance(target, damageType);
  const amount =
    multiplier === 0
      ? 0
      : Math.max(
          1,
          Math.round(raw * defenseFactor(defense) * multiplier * variance),
        );
  return { amount, damageType, multiplier };
}

/** A weapon hit without the random spread, for the AI to plan with. */
export function expectedPhysicalDamage(attacker: Unit, target: Unit): number {
  const multiplier = resistance(target, attacker.weapon.damageType);
  if (multiplier === 0) return 0;
  const raw =
    effectiveStat(attacker, "attack") *
    defenseFactor(effectiveStat(target, "defense")) *
    multiplier;
  return Math.max(1, Math.round(raw));
}

/** Basic weapon attack: attack against defense, typed by the weapon. */
export function physicalHit(
  state: BattleState,
  attacker: Unit,
  target: Unit,
): Hit {
  return mitigate(
    state,
    effectiveStat(attacker, "attack"),
    effectiveStat(target, "defense"),
    target,
    attacker.weapon.damageType,
  );
}

/** Spell damage: power x magic against the target's spirit. */
export function magicalHit(
  state: BattleState,
  caster: Unit,
  target: Unit,
  power: number,
  element: DamageType,
): Hit {
  return mitigate(
    state,
    power * effectiveStat(caster, "magic"),
    effectiveStat(target, "spirit"),
    target,
    element,
  );
}

/** Takes HP off a unit and knocks it out at 0. */
export function applyDamage(
  state: BattleState,
  target: Unit,
  hit: Hit,
  events: BattleEvent[],
): void {
  target.hp = Math.max(0, target.hp - hit.amount);
  events.push({
    type: "damage",
    unitId: target.id,
    amount: hit.amount,
    hp: target.hp,
    damageType: hit.damageType,
    multiplier: hit.multiplier,
  });
  if (target.hp === 0) {
    target.gauge = 0;
    state.ready = state.ready.filter((id) => id !== target.id);
    events.push({ type: "knockedOut", unitId: target.id });
  }
}
