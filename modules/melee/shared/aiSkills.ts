import {
  DEFENSE_K,
  ROW_TAKEN,
  defenseFactor,
  expectedPhysicalDamage,
  resistance,
  wouldKnockOut,
} from "./damage";
import { previewDamage } from "./preview";
import { pushDestination } from "./push";
import { RESCUE_BRACE } from "./rescue";
import { healAmount, skillCells, skillVictims } from "./skills";
import { unitAt } from "./grid";
import { effectiveStat, isAlive } from "./stats";
import { GAUGE_FULL } from "./timeline";
import { findSkill } from "./units";
import type {
  BattleState,
  Cell,
  Skill,
  SkillEffect,
  StatusDef,
  TargetingProfile,
  Unit,
} from "./types";

// How much a skill is worth to the AI, in the units of a target score: a
// plain attack on a healthy, unarmored target is worth about 1 (see
// targetScore). Every effect lands on friend and foe alike, so each victim
// counts for its side: good for the caster's side is positive.

/** A buff on an ally or a debuff on a foe, worth about one plain attack. */
export const SUPPORT_VALUE = 1;
/** Healing: weight x share of max HP restored x share of max HP missing. */
export const HEAL_WEIGHT = 4;
/** Damage and healing over time are worth less than up front. */
export const OVER_TIME = 0.6;
/** A delayed skill may land on an empty cell; it is worth this much. */
export const CAST_DISCOUNT = 0.75;
/** Spending all of its MP costs the AI this much score; less, pro rata. */
export const MP_WEIGHT = 0.5;
/** Paying all of its current HP would cost this much score. */
export const HP_WEIGHT = 2;
/** A full gauge given to an ally (or taken from a foe). */
export const GAUGE_WEIGHT = 1.2;
/** A summoned creature; an obstacle (a boulder) is worth less. */
export const SUMMON_VALUE = 1.5;
export const OBSTACLE_VALUE = 0.4;
/** An ally back in the fight, on top of the HP it comes back with. */
export const REVIVE_VALUE = 2;

/**
 * What hitting `target` for `amount` is worth to `unit`: the finish bonus
 * if it would knock the target out, plus the wounded and soft factors
 * scaled by how the hit compares with a plain weapon attack on it. A plain
 * attack scores exactly targetScore without its noise.
 */
export function hitValue(
  p: TargetingProfile,
  unit: Unit,
  target: Unit,
  amount: number,
): number {
  if (amount <= 0) return 0;
  const plain = Math.max(1, expectedPhysicalDamage(unit, target));
  const wounded = 1 - target.hp / target.base.maxHp;
  const soft = defenseFactor(effectiveStat(target, "defense"));
  const finish = wouldKnockOut(target, amount) ? p.finish : 0;
  return finish + (amount / plain) * (p.wounded * wounded + p.soft * soft);
}

/** HP actually restored by `amount` of healing, as a weighted share. */
function healValue(target: Unit, amount: number): number {
  const max = target.base.maxHp;
  const restored = Math.min(max - target.hp, Math.max(0, amount));
  return HEAL_WEIGHT * (restored / max) * (1 - target.hp / max);
}

function statusValue(
  p: TargetingProfile,
  unit: Unit,
  target: Unit,
  status: StatusDef,
  friend: boolean,
): number {
  // Refreshing a running status adds little; the AI leaves it be.
  if (target.statuses.some((s) => s.id === status.id)) return 0;
  const perTick = Math.max(
    1,
    Math.round(status.power * effectiveStat(unit, status.stat)),
  );
  const total = perTick * status.ticks;
  const sign = friend ? 1 : -1;
  if (status.effect === "damage") {
    const multiplier = status.damageType
      ? resistance(target, status.damageType)
      : 1;
    return -sign * OVER_TIME * hitValue(p, unit, target, total * multiplier);
  }
  if (status.effect === "heal") {
    return sign * OVER_TIME * healValue(target, total);
  }
  // Shield, ward, stealth: helpful on the side it's meant for.
  return (status.harmful ? -sign : sign) * SUPPORT_VALUE;
}

/**
 * Drawing the enemies' attacks is worth as much as the allies it shields
 * are frail next to the taunter: nothing alone, little for a hurt taunter.
 */
function tauntValue(state: BattleState, taunter: Unit): number {
  if (taunter.statuses.some((s) => s.effect === "taunt")) return 0;
  const allies = state.units.filter(
    (u) =>
      u.side === taunter.side &&
      u.id !== taunter.id &&
      !u.obstacle &&
      isAlive(u),
  );
  if (allies.length === 0) return 0;
  const health = taunter.hp / taunter.base.maxHp;
  return SUPPORT_VALUE * health;
}

/**
 * Standing guard over an ally is worth as much as the ally is frailer than
 * the guardian, and less the more the guardian is hurt. Nothing for an
 * ally already guarded.
 */
function guardValue(guardian: Unit, ally: Unit): number {
  if (ally.statuses.some((s) => s.effect === "guard")) return 0;
  const health = guardian.hp / guardian.base.maxHp;
  return 2 * SUPPORT_VALUE * frailer(ally, guardian) * health;
}

/**
 * Silencing a foe is worth SUPPORT_VALUE if it has a skill it could use,
 * and a cast it is in the middle of as much as that cast is worth to its
 * side (its price is already paid). Nothing on a foe already silenced.
 */
function silenceValue(state: BattleState, foe: Unit): number {
  if (foe.statuses.some((s) => s.effect === "silence")) return 0;
  const usable = foe.skills.some((s) => s.mpCost <= foe.mp);
  let value = usable ? SUPPORT_VALUE : 0;
  const cast = foe.casting && findSkill(foe, foe.casting.skillId);
  if (foe.casting && cast) {
    const worth =
      skillValue(state, foe, cast, foe.casting.cell) + skillCost(foe, cast);
    value += Math.max(SUPPORT_VALUE, worth);
  }
  return value;
}

/** How much frailer `ally` is than `protector`: 0 (as tough) to 1. */
function frailer(ally: Unit, protector: Unit): number {
  const toughness = (u: Unit) =>
    effectiveStat(u, "maxHp") * (1 + effectiveStat(u, "defense") / DEFENSE_K);
  return Math.max(0, 1 - toughness(ally) / toughness(protector));
}

/**
 * Pulling an ally back to the back row is worth the damage it no longer
 * takes there, the more so the more it is hurt and the frailer it is than
 * the rescuer; nothing while it is above half HP. Half as much for a melee
 * ally, whose blows weaken back there, and less the gauge it loses. The
 * rescuer's brace counts like any helpful modifier, but only on top: it
 * alone is no reason to rescue.
 */
function rescueValue(rescuer: Unit, ally: Unit): number {
  const hurt = 1 - ally.hp / effectiveStat(ally, "maxHp");
  if (hurt < 0.5) return 0;
  const shelter = ROW_TAKEN[ally.position.row] - ROW_TAKEN[2];
  const melee = ally.weapon.kind === "melee" ? 0.5 : 1;
  const gaugeLost = (GAUGE_WEIGHT * Math.max(0, ally.gauge)) / 2 / GAUGE_FULL;
  const gain = 4 * SUPPORT_VALUE * shelter * frailer(ally, rescuer) * hurt;
  const value = gain * melee - gaugeLost;
  if (value <= 0) return value;
  const braced = rescuer.modifiers.some((m) => m.source === RESCUE_BRACE.name);
  return value + (braced ? 0 : SUPPORT_VALUE);
}

/** What the skill's effect on one victim is worth to the caster's side. */
function victimValue(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  victim: Unit,
): number {
  // Obstacles don't fight: hurting or helping them changes nothing.
  if (victim.obstacle) return 0;
  const p = unit.targeting;
  const friend = victim.side === unit.side;
  const sign = friend ? 1 : -1;
  const effect = skill.effect;
  switch (effect.type) {
    case "strike":
    case "damage":
    case "shatter": {
      const amount = previewDamage(unit, victim, skill)?.amount ?? 0;
      return -sign * hitValue(p, unit, victim, amount);
    }
    case "heal":
      return sign * healValue(victim, healAmount(unit, victim, effect));
    case "status":
      if (effect.status.effect === "taunt") return tauntValue(state, victim);
      if (effect.status.effect === "guard") return guardValue(unit, victim);
      if (effect.status.effect === "silence") {
        return silenceValue(state, victim);
      }
      return statusValue(p, unit, victim, effect.status, friend);
    case "modify": {
      const { modifier } = effect;
      if (victim.modifiers.some((m) => m.source === modifier.name)) return 0;
      return (modifier.harmful ? -sign : sign) * SUPPORT_VALUE;
    }
    case "cleanse": {
      const harmful =
        victim.statuses.filter((s) => s.harmful).length +
        victim.modifiers.filter((m) => m.harmful).length;
      return sign * SUPPORT_VALUE * harmful;
    }
    case "gauge":
      // An ally sooner is good, a foe later is good.
      return sign * GAUGE_WEIGHT * (effect.to - victim.gauge / GAUGE_FULL);
    case "heave": {
      // Pushing a melee foe back weakens its blows; nothing else is worth it.
      if (friend || victim.weapon.kind !== "melee") return 0;
      return pushDestination(state, victim, effect.rows)
        ? SUPPORT_VALUE / 2
        : 0;
    }
    case "rescue":
      return rescueValue(unit, victim);
    case "summon":
    case "teleport":
    case "revive":
      return 0;
  }
}

/**
 * How much using `skill` aimed at `cell` is worth to `unit`, after its MP
 * and HP cost. Positive means worth doing. Teleports are movement and are
 * worth only their cost here (see aiMove). Assumes the aim is valid.
 */
export function skillValue(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  cell: Cell,
): number {
  const effect = skill.effect;
  let value = 0;
  if (effect.type === "summon") value = summonValue(state, unit, effect, cell);
  else if (effect.type === "revive") {
    value = reviveValue(state, unit, effect.power, cell);
  } else if (effect.type !== "teleport") {
    for (const victim of skillVictims(state, unit, skill, cell)) {
      value += victimValue(state, unit, skill, victim);
    }
  }
  if (skill.castTime) value *= CAST_DISCOUNT;
  return value - skillCost(unit, skill);
}

/**
 * A fallen ally back: REVIVE_VALUE plus its HP the way healing it from 0
 * would count. Validation already ruled out foes and obstacles.
 */
function reviveValue(
  state: BattleState,
  unit: Unit,
  power: number,
  cell: Cell,
): number {
  const fallen = unitAt(state, cell);
  if (!fallen || isAlive(fallen)) return 0;
  return REVIVE_VALUE + healValue(fallen, power * effectiveStat(unit, "magic"));
}

/** A fresh summon on its own side; replacing one gains nothing. */
function summonValue(
  state: BattleState,
  unit: Unit,
  effect: Extract<SkillEffect, { type: "summon" }>,
  cell: Cell,
): number {
  if (cell.side !== unit.side) return 0;
  const mine = state.units.filter(
    (u) =>
      u.summonedBy === unit.id && u.defId === effect.creature.id && !u.vanished,
  ).length;
  if (mine >= (effect.limit ?? 1)) return 0;
  return effect.creature.obstacle ? OBSTACLE_VALUE : SUMMON_VALUE;
}

/** The score a skill's price costs: a share of MP left and of HP. */
export function skillCost(unit: Unit, skill: Skill): number {
  const maxMp = unit.base.maxMp;
  const mp = maxMp > 0 ? (MP_WEIGHT * skill.mpCost) / maxMp : 0;
  const hp = skill.hpCost ? (HP_WEIGHT * skill.hpCost) / unit.hp : 0;
  return mp + hp;
}

export interface SkillChoice {
  skill: Skill;
  cell: Cell;
  value: number;
}

/**
 * The most valuable skill `unit` can use now and where to aim it, or null
 * if no skill is worth its cost. Cells are tried in a fixed order, so the
 * first of equally good aims wins.
 */
export function bestSkill(state: BattleState, unit: Unit): SkillChoice | null {
  let best: SkillChoice | null = null;
  for (const skill of unit.skills) {
    for (const cell of skillCells(state, unit, skill)) {
      const value = skillValue(state, unit, skill, cell);
      if (value > 0 && (!best || value > best.value)) {
        best = { skill, cell, value };
      }
    }
  }
  return best;
}
