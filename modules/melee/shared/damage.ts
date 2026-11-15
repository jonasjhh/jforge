import { nextRandom } from "./rng";
import { vanish } from "./units";
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

/** Melee damage dealt from each row (front, middle, back). */
export const ROW_DEALT = [1, 0.75, 0.5];
/** Melee damage taken in each row (front, middle, back). */
export const ROW_TAKEN = [1, 0.75, 0.5];

/**
 * How rows scale a weapon hit: for melee, the attacker's row times the
 * target's row (a back-row swordsman hitting the back row deals x0.25).
 * Ranged weapons ignore rows.
 */
export function rowFactor(attacker: Unit, target: Unit): number {
  if (attacker.weapon.kind !== "melee") return 1;
  return (
    (ROW_DEALT[attacker.position.row] ?? 1) *
    (ROW_TAKEN[target.position.row] ?? 1)
  );
}

/** A weapon hit without the random spread, for the AI to plan with. */
export function expectedPhysicalDamage(attacker: Unit, target: Unit): number {
  const multiplier = resistance(target, attacker.weapon.damageType);
  if (multiplier === 0) return 0;
  const raw =
    effectiveStat(attacker, "attack") *
    rowFactor(attacker, target) *
    defenseFactor(effectiveStat(target, "defense")) *
    multiplier;
  return Math.max(1, Math.round(raw));
}

/**
 * Weapon attack: attack (scaled by rows for melee, and by `power` for
 * weapon skills) against defense, typed by the weapon.
 */
export function physicalHit(
  state: BattleState,
  attacker: Unit,
  target: Unit,
  power = 1,
): Hit {
  return mitigate(
    state,
    effectiveStat(attacker, "attack") * rowFactor(attacker, target) * power,
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
  knockOutIfDown(state, target, events);
}

/** At 0 HP: clear the unit's turn, statuses and cast, and report it. */
export function knockOutIfDown(
  state: BattleState,
  target: Unit,
  events: BattleEvent[],
): void {
  if (target.hp > 0) return;
  target.gauge = 0;
  target.statuses = [];
  if (target.casting) {
    events.push({
      type: "castFizzled",
      unitId: target.id,
      skillName: target.casting.skillName,
    });
    target.casting = undefined;
  }
  state.ready = state.ready.filter((id) => id !== target.id);
  events.push({ type: "knockedOut", unitId: target.id });
  if (target.summonedBy) {
    vanish(target);
    events.push({ type: "vanished", unitId: target.id });
  }
}
