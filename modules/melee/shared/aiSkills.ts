import {
  DEFENSE_K,
  ROW_TAKEN,
  defenseFactor,
  expectedPhysicalDamage,
  resistance,
  wouldKnockOut,
} from "./damage";
import { previewDamage } from "./preview";
import { blastCells } from "./bomb";
import { CHILL_SLOW } from "./chill";
import { isCoated } from "./coat";
import { mostHurtAlly } from "./judgment";
import { isRooted } from "./stoneSkin";
import { isPetrified } from "./petrify";
import { strengthsOf } from "./strengths";
import { POISON } from "./poison";
import { IGNITE_BURN } from "./ignite";
import { BLEED } from "./bleed";
import { PIN_SLOW } from "./pin";
import { staggeredGauge } from "./stagger";
import { WEAKEN_STATUS } from "./weaken";
import { pushDestination } from "./push";
import { RESCUE_BRACE } from "./rescue";
import { healAmount, skillCells, skillVictims } from "./skills";
import { cellOf, farness, unitAt } from "./grid";
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
// plain attack on a healthy, unarmoured target is worth about 1 (see
// targetScore). Every effect lands on friend and foe alike, so each victim
// counts for its side: good for the caster's side is positive.

/** A buff on an ally or a debuff on a foe, worth about one plain attack. */
export const SUPPORT_VALUE = 1;
/** Healing: weight x share of max HP restored x share of max HP missing. */
const HEAL_WEIGHT = 4;
/** Damage and healing over time are worth less than up front. */
const OVER_TIME = 0.6;
/** A delayed skill may land on an empty cell; it is worth this much. */
export const CAST_DISCOUNT = 0.75;
/** Spending all of its MP costs the AI this much score; less, pro rata. */
const MP_WEIGHT = 0.5;
/** Paying all of its current HP would cost this much score. */
const HP_WEIGHT = 2;
/** A full gauge given to an ally (or taken from a foe). */
const GAUGE_WEIGHT = 1.2;
/** A summoned creature; an obstacle (a boulder) is worth less. */
export const SUMMON_VALUE = 1.5;
const OBSTACLE_VALUE = 0.4;
/** An ally back in the fight, on top of the HP it comes back with. */
export const REVIVE_VALUE = 2;

/**
 * What hitting `target` for `amount` is worth to `unit`: the finish bonus
 * if it would knock the target out, plus the wounded and soft factors less
 * the distance cost (never below 0, so hitting one more foe never hurts),
 * scaled by how the hit compares with a plain weapon attack on it. A plain
 * attack scores exactly targetScore without its noise, unless that is
 * below 0.
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
  const far = (p.near ?? 0) * farness(unit, target);
  const worth = Math.max(0, p.wounded * wounded + p.soft * soft - far);
  return finish + (amount / plain) * worth;
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
 * A bomb is worth the damage its blast would do to everyone now around the
 * carrier, as damage over time is. Nothing on a unit already carrying one.
 */
function bombValue(
  state: BattleState,
  p: TargetingProfile,
  unit: Unit,
  carrier: Unit,
  status: StatusDef,
): number {
  if (carrier.statuses.some((s) => s.effect === "bomb")) return 0;
  const amount = Math.max(
    1,
    Math.round(status.power * effectiveStat(unit, status.stat)),
  );
  const type = status.damageType ?? "arcane";
  let value = 0;
  for (const cell of blastCells(cellOf(carrier))) {
    const victim = unitAt(state, cell);
    if (!victim || !isAlive(victim)) continue;
    value += hitValue(p, unit, victim, amount * resistance(victim, type));
  }
  return OVER_TIME * value;
}

/**
 * Giving up a summon is worth the healing its HP gives the caster and the
 * boost (unless it is already on), less the summon, which counts for as
 * much of SUMMON_VALUE as it has HP left.
 */
function sacrificeValue(caster: Unit, summoned: Unit, boost: string): number {
  const share = summoned.hp / summoned.base.maxHp;
  const boosted = caster.modifiers.some((m) => m.source === boost);
  return (
    healValue(caster, summoned.hp) +
    (boosted ? 0 : SUPPORT_VALUE) -
    SUMMON_VALUE * share
  );
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
/**
 * Petrify on `foe`: the share of an ally's HP its weapon would take in the
 * turns it loses (valued like that much healing), minus what the caster's
 * next blow loses on stone at half (a knockout put off counts), plus a
 * broken cast. Low or negative for a foe about to fall, so the AI
 * finishes it instead.
 */
function petrifyValue(
  state: BattleState,
  p: TargetingProfile,
  unit: Unit,
  foe: Unit,
  status: StatusDef,
): number {
  if (isPetrified(foe)) return 0;
  const duration = status.interval * status.ticks;
  const turns = (duration * effectiveStat(foe, "speed")) / GAUGE_FULL;
  let worst = 0;
  for (const ally of state.units) {
    if (ally.side !== unit.side || ally.obstacle || !isAlive(ally)) continue;
    const share = expectedPhysicalDamage(foe, ally) / ally.base.maxHp;
    worst = Math.max(worst, Math.min(1, share));
  }
  const plain = expectedPhysicalDamage(unit, foe);
  const softened =
    hitValue(p, unit, foe, plain) -
    hitValue(
      p,
      unit,
      foe,
      Math.round(plain * (strengthsOf(status).taken ?? 1)),
    );
  // Others can strike elsewhere meanwhile: only the caster's own next
  // blow on the stone counts against it.
  let value = HEAL_WEIGHT * worst * turns - softened;
  const cast = foe.casting && findSkill(foe, foe.casting.skillId);
  if (foe.casting && cast) {
    const worth =
      skillValue(state, foe, cast, foe.casting.cell) + skillCost(foe, cast);
    value += Math.max(SUPPORT_VALUE, worth);
  }
  return value;
}

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

/**
 * MP burned off a unit is worth SUPPORT_VALUE per its whole MP bar, and
 * only if it has skills to spend MP on.
 */
function burnValue(
  victim: Unit,
  effect: Extract<SkillEffect, { type: "damage" }>,
): number {
  if (!effect.burnMp || victim.skills.length === 0) return 0;
  const maxMp = effectiveStat(victim, "maxMp");
  if (maxMp <= 0) return 0;
  return (SUPPORT_VALUE * Math.min(victim.mp, effect.burnMp)) / maxMp;
}

/**
 * What a strike leaves behind on a foe it doesn't knock out: a stagger
 * (worth the gauge lost, as a gauge effect is), a pin, a burn (worth its
 * damage over time, as a status is).
 */
function strikeExtra(
  p: TargetingProfile,
  unit: Unit,
  victim: Unit,
  effect: Extract<SkillEffect, { type: "strike" }>,
  amount: number,
): number {
  if (amount >= victim.hp) return 0;
  const staggered =
    effect.stagger && !victim.casting
      ? (GAUGE_WEIGHT *
          (victim.gauge - staggeredGauge(victim, effect.stagger))) /
        GAUGE_FULL
      : 0;
  return (
    staggered +
    (effect.pin ? pinValue(victim, amount) : 0) +
    (effect.ignite ? statusValue(p, unit, victim, IGNITE_BURN, false) : 0) +
    (effect.bleed ? statusValue(p, unit, victim, BLEED, false) : 0) +
    (effect.weaken ? statusValue(p, unit, victim, WEAKEN_STATUS, false) : 0) +
    (isCoated(unit) ? statusValue(p, unit, victim, POISON, false) : 0)
  );
}

/**
 * MP back is worth SUPPORT_VALUE once the unit can't afford any of its
 * other MP skills, and nothing before.
 */
function restoreMpValue(unit: Unit): number {
  const spells = unit.skills.filter(
    (s) => s.mpCost > 0 && s.effect.type !== "restoreMp",
  );
  return spells.length > 0 && spells.every((s) => s.mpCost > unit.mp)
    ? SUPPORT_VALUE
    : 0;
}

/**
 * Pinning a unit is worth SUPPORT_VALUE, as a slowing modifier is, unless
 * the hit knocks it out or it is already pinned.
 */
function pinValue(victim: Unit, amount: number): number {
  if (amount >= victim.hp) return 0;
  return victim.modifiers.some((m) => m.source === PIN_SLOW.name)
    ? 0
    : SUPPORT_VALUE;
}

/**
 * A chill is a small slow: worth half SUPPORT_VALUE, unless the hit knocks
 * the foe out or it is already chilled.
 */
function chillValue(
  victim: Unit,
  effect: Extract<SkillEffect, { type: "damage" }>,
  amount: number,
): number {
  if (!effect.chill || amount >= victim.hp) return 0;
  return victim.modifiers.some((m) => m.source === CHILL_SLOW.name)
    ? 0
    : SUPPORT_VALUE / 2;
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

/** Judgment's heal of `amount` on the caster's most-hurt ally. */
function mendValue(state: BattleState, unit: Unit, amount: number): number {
  const ally = mostHurtAlly(state, unit);
  return ally ? healValue(ally, Math.floor(amount)) : 0;
}

/** What the skill's effect on one victim is worth to the caster's side. */
function victimValue(
  state: BattleState,
  unit: Unit,
  skill: Skill,
  victim: Unit,
  shared: number,
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
      const amount = previewDamage(unit, victim, skill, shared)?.amount ?? 0;
      const extra =
        effect.type === "damage"
          ? burnValue(victim, effect) + chillValue(victim, effect, amount)
          : effect.type === "strike"
            ? strikeExtra(p, unit, victim, effect, amount)
            : 0;
      const mend =
        effect.type === "strike" && effect.mend && !friend
          ? mendValue(state, unit, Math.min(amount, victim.hp) * effect.mend)
          : 0;
      return -sign * (hitValue(p, unit, victim, amount) + extra) + mend;
    }
    case "heal":
      return sign * healValue(victim, healAmount(unit, victim, effect));
    case "status":
      if (effect.status.effect === "taunt") return tauntValue(state, victim);
      if (effect.status.effect === "guard") return guardValue(unit, victim);
      if (effect.status.effect === "silence") {
        return silenceValue(state, victim);
      }
      if (effect.status.effect === "petrify") {
        return friend ? 0 : petrifyValue(state, p, unit, victim, effect.status);
      }
      if (effect.status.effect === "bomb") {
        return -sign * bombValue(state, p, unit, victim, effect.status);
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
      if (friend || victim.weapon.kind !== "melee" || isRooted(victim)) {
        return 0;
      }
      return pushDestination(state, victim, effect.rows)
        ? SUPPORT_VALUE / 2
        : 0;
    }
    case "rescue":
      return rescueValue(unit, victim);
    case "restoreMp":
      return restoreMpValue(victim);
    case "rewind":
      return sign * healValue(victim, victim.rewindHp - victim.hp);
    case "sacrifice":
      return sacrificeValue(unit, victim, effect.modifier.name);
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
    const victims = skillVictims(state, unit, skill, cell);
    for (const victim of victims) {
      value += victimValue(state, unit, skill, victim, victims.length);
    }
  }
  if (skill.castTime) value *= CAST_DISCOUNT;
  // Half a turn: twice the effect for the gauge it spends.
  if (skill.halfTurn) value *= 2;
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

interface SkillChoice {
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
