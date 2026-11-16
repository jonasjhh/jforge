import { nextRandom } from "./rng";
import { dropReady, vanish } from "./units";
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

/**
 * A hit without the random spread: weapon hits (physical, scaled by rows)
 * use attack against defense, spells (magical) magic against spirit.
 */
export function expectedDamage(
  attacker: Unit,
  target: Unit,
  delivery: "physical" | "magical",
  power: number,
  damageType: DamageType,
): number {
  const multiplier = resistance(target, damageType);
  if (multiplier === 0) return 0;
  const raw =
    delivery === "physical"
      ? effectiveStat(attacker, "attack") *
        rowFactor(attacker, target) *
        defenseFactor(effectiveStat(target, "defense"))
      : effectiveStat(attacker, "magic") *
        defenseFactor(effectiveStat(target, "spirit"));
  return Math.max(1, Math.round(raw * power * multiplier));
}

/** A weapon attack without the random spread, for the AI to plan with. */
export function expectedPhysicalDamage(attacker: Unit, target: Unit): number {
  return expectedDamage(
    attacker,
    target,
    "physical",
    1,
    attacker.weapon.damageType,
  );
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
  /** Overrides the weapon's type, e.g. impact for a collision. */
  damageType: DamageType = attacker.weapon.damageType,
): Hit {
  return mitigate(
    state,
    effectiveStat(attacker, "attack") * rowFactor(attacker, target) * power,
    effectiveStat(target, "defense"),
    target,
    damageType,
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
): Suffered {
  const suffered = sufferDamage(target, hit.amount);
  events.push({
    type: "damage",
    unitId: target.id,
    amount: suffered.lost,
    hp: target.hp,
    damageType: hit.damageType,
    multiplier: hit.multiplier,
    ...(suffered.absorbed ? { absorbed: suffered.absorbed } : {}),
  });
  reportDefenses(target, suffered, events);
  knockOutIfDown(state, target, events);
  return suffered;
}

/** What happened to a unit's damage: HP lost, shield used, ward saved it. */
export interface Suffered {
  lost: number;
  absorbed: number;
  shieldName?: string;
  shieldBroken: boolean;
  wardName?: string;
}

/**
 * The one place damage meets a unit: a shield absorbs first, the rest
 * comes off HP, and a ward keeps a lethal blow at 1 HP. Every source
 * (weapons, spells, collisions, poison) goes through here.
 */
export function sufferDamage(target: Unit, amount: number): Suffered {
  let rest = amount;
  let absorbed = 0;
  let shieldBroken = false;
  const shield = target.statuses.find((s) => s.effect === "shield");
  if (shield && rest > 0) {
    absorbed = Math.min(shield.amount, rest);
    shield.amount -= absorbed;
    rest -= absorbed;
    if (shield.amount <= 0) {
      target.statuses = target.statuses.filter((s) => s !== shield);
      shieldBroken = true;
    }
  }
  const ward = target.statuses.find((s) => s.effect === "ward");
  const saved = ward !== undefined && rest >= target.hp && target.hp > 0;
  const lost = saved ? target.hp - 1 : Math.min(target.hp, rest);
  target.hp -= lost;
  return {
    lost,
    absorbed,
    shieldBroken,
    ...(shield ? { shieldName: shield.name } : {}),
    ...(saved && ward ? { wardName: ward.name } : {}),
  };
}

/** Log events for a shield breaking or a ward holding. */
export function reportDefenses(
  target: Unit,
  suffered: Suffered,
  events: BattleEvent[],
): void {
  if (suffered.shieldBroken && suffered.shieldName) {
    events.push({
      type: "shieldBroken",
      unitId: target.id,
      name: suffered.shieldName,
    });
  }
  if (suffered.wardName) {
    events.push({ type: "warded", unitId: target.id, name: suffered.wardName });
  }
}

/**
 * Whether an expected hit of `amount` would knock `target` out: its shield
 * soaks part of it first, and a ward means it can't be finished.
 */
export function wouldKnockOut(target: Unit, amount: number): boolean {
  const shield =
    target.statuses.find((s) => s.effect === "shield")?.amount ?? 0;
  const warded = target.statuses.some((s) => s.effect === "ward");
  return !warded && amount > 0 && amount - shield >= target.hp;
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
  dropReady(state, target.id);
  events.push({ type: "knockedOut", unitId: target.id });
  if (target.summonedBy) {
    vanish(target);
    events.push({ type: "vanished", unitId: target.id });
  }
}
