import { DEFENSE_K } from "./damage";
import { resistancesFor } from "./traits";
import type { CombatantDef, Skill, SkillArea } from "./types";
import { DAMAGE_TYPES } from "./types";

// An estimate of how dangerous a combatant is, in the units of the
// encounter threat budget, for combatants designed elsewhere (char). The
// built-in monsters keep their hand-tuned threat.
//
// Strength in a fight grows with how fast a unit deals damage times how
// much it takes to bring down, so threat is the square root of the two
// multiplied: twice the stats all round is twice the threat.

/**
 * Fitted to auto-played battles: for each of a range of monsters (stronger
 * and weaker goblins, the built-ins, the party types), how many copies the
 * built-in party beats about half the time on the Hard budget. A pool of
 * designed monsters then plays about as hard as the built-in one.
 */
export const THREAT_SCALE = 0.023;
/** Lowest estimate: even a harmless unit takes up a cell and a turn. */
export const MIN_THREAT = 1;
/** Bites that poison add this share of the poison's total damage. */
const ON_HIT_SHARE = 0.25;
/** How many foes an area usually catches. */
const AREA_REACH: Record<SkillArea, number> = {
  single: 1,
  line: 1.5,
  plus: 3,
  square: 4,
  reach: 2,
};
/** A skill it can cast this many times on its MP counts in full. */
const FULL_CASTS = 4;
/**
 * Each support skill (heals, buffs, summons) multiplies offense by this
 * much more: keeping allies up is worth about as much as hitting.
 */
const SUPPORT_BONUS = 0.4;
const MAX_SUPPORT_BONUS = 1.6;
/** Durability of a unit that can revive: its fallen allies come back. */
const REVIVE_DURABILITY = 1.4;

/** Damage per action of a damaging skill, scaled by how often it can pay. */
function skillDamage(def: CombatantDef, skill: Skill): number {
  const { effect } = skill;
  let damage: number;
  if (effect.type === "strike") damage = def.stats.attack * effect.power;
  else if (effect.type === "damage" || effect.type === "shatter") {
    damage = def.stats.magic * effect.power;
  } else return 0;
  damage *= AREA_REACH[skill.area];
  if (skill.castTime) damage *= 0.75;
  if (skill.mpCost > 0) {
    const casts = def.stats.maxMp / skill.mpCost;
    damage *= Math.min(1, casts / FULL_CASTS);
  }
  return damage;
}

/** Damage per game time: its best action times its speed. */
export function offenseOf(def: CombatantDef): number {
  const { stats, weapon } = def;
  let weaponDamage = stats.attack;
  const onHit = weapon.onHit;
  if (onHit?.effect === "damage") {
    weaponDamage +=
      ON_HIT_SHARE * onHit.power * onHit.ticks * stats[onHit.stat];
  }
  const skills = def.skills ?? [];
  const affordable = skills.filter((s) => s.mpCost <= stats.maxMp);
  const best = Math.max(
    weaponDamage,
    ...affordable.map((s) => skillDamage(def, s)),
  );
  // Heals, buffs, summons and the like: anything but damage and movement.
  const support = affordable.filter(
    (s) => s.effect.type !== "teleport" && skillDamage(def, s) === 0,
  ).length;
  const bonus = Math.min(MAX_SUPPORT_BONUS, SUPPORT_BONUS * support);
  return best * (1 + bonus) * stats.speed;
}

/**
 * How much damage it takes to bring down: max HP, raised by defense and
 * spirit (the damage formula's K / (K + defense), averaged) and by its
 * resistances averaged over every damage type.
 */
export function durabilityOf(def: CombatantDef): number {
  const { stats } = def;
  const guard = 1 + (stats.defense + stats.spirit) / 2 / DEFENSE_K;
  const resistances = resistancesFor(def);
  const taken =
    DAMAGE_TYPES.reduce((sum, type) => sum + (resistances[type] ?? 1), 0) /
    DAMAGE_TYPES.length;
  // A side that can bring its fallen back has to be beaten twice.
  const revives = (def.skills ?? []).some(
    (s) => s.effect.type === "revive" && s.mpCost <= stats.maxMp,
  );
  // Immune to everything would be unbeatable; cap it at 10x.
  return (
    (stats.maxHp * guard * (revives ? REVIVE_DURABILITY : 1)) /
    Math.max(0.1, taken)
  );
}

/** Estimated threat, rounded to a tenth, at least MIN_THREAT. */
export function estimateThreat(def: CombatantDef): number {
  const raw = THREAT_SCALE * Math.sqrt(offenseOf(def) * durabilityOf(def));
  return Math.max(MIN_THREAT, Math.round(raw * 10) / 10);
}
