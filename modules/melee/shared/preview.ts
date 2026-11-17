import { charged } from "./charge";
import { expectedDamage, resistance, wouldKnockOut } from "./damage";
import { AMBUSH_POWER, isStealthed } from "./stealth";
import { spellPower } from "./status";
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
 * the random spread and collisions from pushes. A charge is previewed from
 * the front row.
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
    hit = ["magical", spellPower(effect, target) * ambush, effect.element];
  } else if (effect.type === "shatter") {
    hit = ["magical", effect.power, effect.element];
  } else return null;

  const [delivery, power, damageType] = hit;
  // A charge strikes from the front row it runs to.
  const from =
    effect?.type === "strike" && effect.advance ? charged(attacker) : attacker;
  const amount = expectedDamage(from, target, delivery, power, damageType);
  return {
    amount,
    multiplier: resistance(target, damageType),
    knocksOut: wouldKnockOut(target, amount),
  };
}
