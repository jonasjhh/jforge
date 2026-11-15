import { expectedDamage, resistance } from "./damage";
import { AMBUSH_POWER, isStealthed } from "./stealth";
import type { DamageType, Skill, Unit } from "./types";

/** What a hit on one target would likely do, for the targeting UI. */
export interface DamagePreview {
  /** Expected damage, before any shield. */
  amount: number;
  /** The target's resistance to the hit's type: 2 weak, 0.5 resists. */
  multiplier: number;
  /** The expected hit would knock it out (after its shield, if no ward). */
  knocksOut: boolean;
}

/**
 * The expected damage of `attacker`'s weapon attack (no skill) or damaging
 * skill on `target`, or null for skills that deal no damage. Leaves out
 * the random spread and collisions from pushes.
 */
export function previewDamage(
  attacker: Unit,
  target: Unit,
  skill?: Skill,
): DamagePreview | null {
  // The first damaging action out of stealth is an ambush.
  const ambush = isStealthed(attacker) ? AMBUSH_POWER : 1;
  const effect = skill?.effect;
  let hit: ["physical" | "magical", number, DamageType];
  if (!effect) hit = ["physical", ambush, attacker.weapon.damageType];
  else if (effect.type === "strike") {
    hit = ["physical", effect.power * ambush, attacker.weapon.damageType];
  } else if (effect.type === "damage") {
    hit = ["magical", effect.power * ambush, effect.element];
  } else if (effect.type === "shatter") {
    hit = ["magical", effect.power, effect.element];
  } else return null;

  const [delivery, power, damageType] = hit;
  const amount = expectedDamage(attacker, target, delivery, power, damageType);
  const shield =
    target.statuses.find((s) => s.effect === "shield")?.amount ?? 0;
  const warded = target.statuses.some((s) => s.effect === "ward");
  return {
    amount,
    multiplier: resistance(target, damageType),
    knocksOut: !warded && amount > 0 && amount - shield >= target.hp,
  };
}
