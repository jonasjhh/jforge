import { meleeClassId } from "@jforge/content/catalogue";
import { type CombatantDef } from "@jforge/battle";
import { content as c } from "@jforge/melee/shared";

// jrpg owns how a class grows: the order each class learns its skills in.
// char only says which skills a class has. A class learns the first two at
// level 1 and one more every level after. When a class gains a skill, its
// order here is rebalanced in the same change.

/** Skills learned at level 1. */
export const FIRST_LEVEL_SKILLS = 2;

/** The order each of melee's classes learns its skills in, by class id. */
export const LEARNING_ORDER: Record<string, string[]> = {
  [meleeClassId(c.fighter.id)]: [
    c.cleave.id,
    c.provoke.id,
    c.ironStance.id,
    c.secondWind.id,
    c.warCry.id,
    c.rend.id,
  ],
  [meleeClassId(c.archer.id)]: [
    c.aimedShot.id,
    c.volley.id,
    c.pinningShot.id,
    c.quickShot.id,
    c.fireArrow.id,
  ],
  [meleeClassId(c.mage.id)]: [
    c.fireball.id,
    c.meteor.id,
    c.lightningBolt.id,
    c.manaTap.id,
    c.frostLance.id,
  ],
  [meleeClassId(c.healer.id)]: [
    c.heal.id,
    c.regen.id,
    c.cure.id,
    c.revive.id,
    c.smite.id,
  ],
  [meleeClassId(c.lancer.id)]: [
    c.skewer.id,
    c.hook.id,
    c.armourPierce.id,
    c.staggeringThrust.id,
    c.weakeningStrike.id,
  ],
  [meleeClassId(c.chronomancer.id)]: [
    c.haste.id,
    c.slow.id,
    c.quicken.id,
    c.timeBomb.id,
    c.rewind.id,
  ],
  [meleeClassId(c.warlock.id)]: [
    c.drain.id,
    c.bloodBolt.id,
    c.summonImp.id,
    c.curse.id,
    c.sacrifice.id,
  ],
  [meleeClassId(c.rogue.id)]: [
    c.vanish.id,
    c.shadowstep.id,
    c.poisonBlade.id,
    c.smokeBomb.id,
    c.coupDeGrace.id,
  ],
  [meleeClassId(c.paladin.id)]: [
    c.aegis.id,
    c.lastRites.id,
    c.consecrate.id,
    c.judgment.id,
    c.blessing.id,
  ],
  [meleeClassId(c.geomancer.id)]: [
    c.raiseBoulder.id,
    c.shatter.id,
    c.upheaval.id,
    c.stoneSkin.id,
    c.petrifySkill.id,
  ],
  [meleeClassId(c.knight.id)]: [
    c.shieldWall.id,
    c.guard.id,
    c.shieldBash.id,
    c.charge.id,
    c.rescue.id,
  ],
  [meleeClassId(c.sage.id)]: [
    c.expose.id,
    c.silence.id,
    c.manaBurn.id,
    c.rebuke.id,
    c.arcaneWave.id,
  ],
};

/** How many skills of its order a class has learned at `level`. */
export function skillsLearnedAt(level: number): number {
  return Math.max(0, FIRST_LEVEL_SKILLS + level - 1);
}

/**
 * `def` with only the skills its class has learned at `level`, in the
 * order learned. A class with no order here keeps every skill it has.
 */
export function withLearnedSkills(
  def: CombatantDef,
  classId: string,
  level: number,
): CombatantDef {
  const order = LEARNING_ORDER[classId];
  if (!order) return def;
  const learned = order.slice(0, skillsLearnedAt(level));
  const skills = learned.flatMap(
    (id) => def.skills?.filter((s) => s.id === id) ?? [],
  );
  return { ...def, skills };
}
